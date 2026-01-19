// src/compression/compression.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  Req,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { CompressRequest, CompressionService } from './compression.service';
import { StorageService } from '../storage/storage.service';

@Controller('compression')
export class CompressionController {
  constructor(
    private readonly compressionService: CompressionService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  async compressPdf(@Body() compressRequest: CompressRequest, @Req() req: any) {
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

    console.log('Compressing PDF', {
      ...compressRequest,
      guestSessionId,
      userId,
      isAuthenticated: !!userId,
      isGuest: !!guestSessionId && !userId,
    });
    
    const result = await this.compressionService.compressPdf(
      compressRequest,
      guestSessionId,
      userId,
    );

    return {
      message: 'PDF compressed successfully',
      ...result,
      downloadUrl: `/compression/download/${result.fileName}`,
      originalSizeFormatted: this.compressionService.formatFileSize(result.originalSize),
      compressedSizeFormatted: this.compressionService.formatFileSize(result.compressedSize),
    };
  }

  @Get('download/:fileName')
  async downloadCompressedFile(
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
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${fileName}"`,
        );

        // Send file
        res.sendFile(filePath);
      }
    } catch (error) {
      console.error('Error downloading compressed file:', error);
      res.status(404).json({ message: 'File not found' });
    }
  }

  @Get('info/:fileName')
  getFileInfo(@Param('fileName') fileName: string) {
    return this.compressionService.getFileInfo(fileName);
  }

}
