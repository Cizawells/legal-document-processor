import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { FileTrackingService, TrackFileRequest } from './file-tracking.service';
import { CleanupService } from './cleanup.service';

export interface CrossServiceFileTrackingRequest {
  fileId: string;
  folder: 'uploads' | 'temp';
  userId?: string;
  guestSessionId?: string;
  fileSize: number;
  originalName: string;
  mimeType: string;
  service: string;
}

@Controller('file-tracking')
export class FileTrackingController {
  constructor(
    private readonly fileTrackingService: FileTrackingService,
    private readonly cleanupService: CleanupService,
  ) {}

  /**
   * Track a file from any service (pdf-redaction-service, etc.)
   * This endpoint will be called by other microservices
   */
  @Post('track')
  async trackFile(@Body() request: CrossServiceFileTrackingRequest) {
    const fileRecord = await this.fileTrackingService.trackFile(request);

    return {
      success: true,
      message: 'File tracked successfully',
      fileRecord: {
        id: fileRecord.id,
        fileId: fileRecord.fileId,
        expiresAt: fileRecord.expiresAt,
        userType: fileRecord.userType,
      },
    };
  }

  /**
   * Get file information
   */
  @Get('file/:fileId')
  async getFileInfo(@Param('fileId') fileId: string) {
    const fileRecord = await this.fileTrackingService.getFileRecord(fileId);

    if (!fileRecord) {
      return { success: false, message: 'File not found' };
    }

    return {
      success: true,
      fileRecord,
    };
  }

  /**
   * Get user files (for authenticated users)
   */
  @Get('user/:userId/files')
  async getUserFiles(@Param('userId') userId: string) {
    const files = await this.fileTrackingService.getUserFiles(userId);

    return {
      success: true,
      files,
      count: files.length,
    };
  }

  /**
   * Get guest session files
   */
  @Get('guest/:sessionId/files')
  async getGuestFiles(@Param('sessionId') sessionId: string) {
    const files = await this.fileTrackingService.getGuestFiles(sessionId);

    return {
      success: true,
      files,
      count: files.length,
    };
  }

  /**
   * Manual cleanup trigger (admin endpoint)
   */
  @Post('cleanup')
  async performCleanup() {
    const result = await this.cleanupService.performCleanup();

    return {
      success: true,
      message: 'Cleanup completed',
      ...result,
    };
  }

  /**
   * Get cleanup statistics (admin endpoint)
   */
  @Get('stats')
  async getCleanupStats() {
    const stats = await this.cleanupService.getCleanupStats();

    return {
      success: true,
      stats,
    };
  }

  /**
   * Delete specific file (admin endpoint)
   */
  @Delete('file/:fileId')
  async deleteFile(@Param('fileId') fileId: string) {
    try {
      await this.fileTrackingService.markAsDeleted(fileId);

      return {
        success: true,
        message: 'File marked as deleted',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
