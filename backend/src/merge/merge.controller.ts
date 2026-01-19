// src/merge/merge.controller.ts
import { Body, Controller, Get, Param, Post, Res, Req } from '@nestjs/common';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { MergeRequest, MergeService } from './merge.service';
import { StorageService } from '../storage/storage.service';

@Controller('merge')
export class MergeController {
  constructor(
    private readonly mergeService: MergeService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  async mergePDFs(@Body() mergeRequest: MergeRequest, @Req() req: any) {
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

    // TODO: Add JWT token validation if needed
    // For now, we'll rely on header-based authentication

    const fileName = await this.mergeService.mergePDFs(
      mergeRequest,
      guestSessionId,
      userId,
    );

    return {
      message: 'PDFs merged successfully',
      fileName,
      downloadUrl: `/merge/download/${fileName}`,
    };
  }

  @Get('download/:fileName')
  async downloadMergedPDF(
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
      console.error('Error downloading merged file:', error);
      res.status(404).json({ message: 'File not found' });
    }
  }

  @Get('info/:fileName')
  getFileInfo(@Param('fileName') fileName: string) {
    return this.mergeService.getFileInfo(fileName);
  }
}
