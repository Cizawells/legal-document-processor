// src/upload/upload.controller.ts
import {
  Controller,
  Post,
  UseInterceptors,
  BadRequestException,
  Get,
  Param,
  Res,
  UploadedFiles,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Express, Response } from 'express';
import { diskStorage, memoryStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import { StorageService } from '../storage/storage.service';
import { GuestOrAuthGuard } from '../auth/guest-or-auth.guard';
import { FileTrackingService } from '../file-tracking/file-tracking.service';

@Controller('upload')
export class UploadController {
  constructor(
    private readonly storageService: StorageService,
    private readonly fileTrackingService: FileTrackingService,
  ) {}

  // Multiple PDF upload endpoint (can handle single or multiple files)
  @Post('pdfs')
  @UseGuards(GuestOrAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      // Allow up to 10 files at once
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new BadRequestException('Only PDF files allowed'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB per file (will be validated per user type)
        files: 10, // Maximum 10 files
      },
    }),
  )
  async uploadMultiplePDFs(@UploadedFiles() files: Express.Multer.File[], @Request() req) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    // Validate that all files are PDFs
    const nonPdfFiles = files.filter(
      (file) => file.mimetype !== 'application/pdf',
    );
    if (nonPdfFiles.length > 0) {
      throw new BadRequestException('All files must be PDF format');
    }

    // Guest user file size validation
    if (req.isGuest) {
      const maxGuestFileSize = 5 * 1024 * 1024; // 5MB for guests
      const oversizedFiles = files.filter(file => file.size > maxGuestFileSize);
      
      if (oversizedFiles.length > 0) {
        const oversizedFileNames = oversizedFiles.map(f => f.originalname).join(', ');
        throw new BadRequestException(
          `Guest users are limited to 5MB per file. The following files exceed this limit: ${oversizedFileNames}. Please sign up for files up to 50MB.`
        );
      }

      console.log(`Processing upload for guest user: ${files.length} files`);
    } else {
      console.log(`Processing upload for authenticated user (${req.user?.id}): ${files.length} files`);
    }

    // Upload files using storage service (sequential to avoid S3 rate limits)
    const uploadedFiles: any[] = [];
    for (const file of files) {
      try {
        console.log(`Uploading file: ${file.originalname} (${file.size} bytes)`);
        const result = await this.storageService.uploadFile(file, 'uploads');
        uploadedFiles.push(result);
        console.log(`Successfully uploaded: ${file.originalname} -> ${result.fileId}`);

        // Track the uploaded file for cleanup
        try {
          await this.fileTrackingService.trackFile({
            fileId: result.fileId,
            folder: 'uploads',
            userId: req.isGuest ? undefined : req.user?.id,
            guestSessionId: req.isGuest ? req.guestSession?.id : undefined,
            fileSize: file.size,
            originalName: file.originalname,
            mimeType: file.mimetype,
            service: 'upload', // This indicates it's an uploaded file (input)
          });
          console.log(`Tracked uploaded file: ${result.fileId}`);
        } catch (trackingError) {
          console.warn(`Failed to track uploaded file ${result.fileId}:`, trackingError);
          // Don't fail the upload if tracking fails
        }
      } catch (error) {
        console.error(`Failed to upload ${file.originalname}:`, error);
        throw new BadRequestException(`Failed to upload ${file.originalname}: ${error.message}`);
      }
    }

    return {
      message: `${files.length} files uploaded successfully`,
      files: uploadedFiles,
      totalFiles: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
    };
  }

  @Get('file/:fileId')
  async getFile(@Param('fileId') fileId: string, @Res() res: Response) {
    try {
      if (this.storageService.isUsingS3()) {
        // For S3, get a signed URL and redirect
        const signedUrl = await this.storageService.getDownloadUrl(
          fileId,
          'uploads',
        );
        res.redirect(signedUrl);
      } else {
        // For local storage, serve the file directly
        const filePath = join(process.cwd(), 'uploads', fileId);

        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ message: 'File not found' });
        }

        res.sendFile(filePath);
      }
    } catch (error) {
      console.error('Error serving file:', error);
      res.status(404).json({ message: 'File not found' });
    }
  }
}
