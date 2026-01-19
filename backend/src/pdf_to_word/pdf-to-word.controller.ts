// src/pdf_to_word/pdf-to-word.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import * as path from 'path';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ConvertRequest, PdfToWordService } from './pdf-to-word.service';
import { StorageService } from '../storage/storage.service';

@Controller('pdf-to-word')
export class PdfToWordController {
  constructor(
    private readonly pdfToWordService: PdfToWordService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  async convertPdfToWord(@Body() convertRequest: ConvertRequest, @Req() req: any) {
    // Get guest session ID from request (set by middleware)
    const guestSessionId = req.guestSession?.id;

    // Check if user is authenticated (from headers or JWT)
    let userId: string | undefined;

    // Check for user ID in headers (OAuth users)
    const userIdFromHeader = req.headers['x-user-id'];
    const userEmailFromHeader = req.headers['x-user-email'];

    if (userIdFromHeader && userEmailFromHeader) {
      userId = userIdFromHeader;
    }

    console.log('Converting PDF to Word', convertRequest, {
      guestSessionId,
      userId,
      isAuthenticated: !!userId,
      isGuest: !userId && !!guestSessionId,
    });

    const {
      fileName,
      ...response
    }: {
      status: string;
      fileName: string;
      pageCount: number | string;
      timestamp: Date;
    } = await this.pdfToWordService.convertPdfToWord(convertRequest, guestSessionId, userId);

    return {
      message: 'PDF converted to Word successfully',
      fileName,
      downloadUrl: `/pdf-to-word/download/${fileName}`,
    };
  }

  @Get('download/:fileName')
  async downloadConvertedFile(
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    try {
      if (this.storageService.isUsingS3()) {
        // For S3, get a signed URL and redirect
        const signedUrl = await this.storageService.getDownloadUrl(
          fileName,
          'temp',
        );
        res.redirect(signedUrl);
      } else {
        // For local storage, serve the file directly
        const filePath = path.join(process.cwd(), 'temp', fileName);

        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ message: 'File not found' });
        }

        // Set headers for file download
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${fileName}"`,
        );

        // Send file
        res.sendFile(filePath);
      }
    } catch (error) {
      console.error('Error downloading converted file:', error);
      res.status(404).json({ message: 'File not found' });
    }
  }

  @Get('info/:fileName')
  getFileInfo(@Param('fileName') fileName: string) {
    return this.pdfToWordService.getFileInfo(fileName);
  }

  // Alternative: Single-step upload and convert
  @Post('upload-convert')
  @UseInterceptors(
    FileInterceptor('file', {
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
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  )
  async uploadAndConvert(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    console.log('Upload and converting PDF to Word', file.filename);

    const result = await this.pdfToWordService.convertPdfToWord({
      fileId: file.filename,
    });

    return {
      message: 'PDF uploaded and converted to Word successfully',
      originalName: file.originalname,
      fileName: result.fileName,
      downloadUrl: `/pdf-to-word/download/${result.fileName}`,
    };
  }
}
