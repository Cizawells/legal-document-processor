// src/compression/compression.service.ts
import { BadRequestException, Injectable, ForbiddenException } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { GuestSessionService } from '../guest-session/guest-session.service';
import { ActivityService } from '../activity/activity.service';
import { FileTrackingService } from '../file-tracking/file-tracking.service';
import { StorageService } from '../storage/storage.service';

export interface CompressRequest {
  fileId: string;
  compressionLevel: 'low' | 'medium' | 'high';
  outputName?: string;
}

export interface CompressResponse {
  status: string;
  fileName: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressionLevel: string;
  timestamp: string;
}

@Injectable()
export class CompressionService {
  private readonly uploadsPath = './uploads';
  private readonly tempPath = './temp';
  private readonly pythonServiceUrl: string;

  constructor(
    private readonly guestSessionService: GuestSessionService,
    private readonly activityService: ActivityService,
    private readonly fileTrackingService: FileTrackingService,
    private readonly storageService: StorageService,
  ) {
    // Python PyMuPDF compression service URL
    this.pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempPath)) {
      fs.mkdirSync(this.tempPath, { recursive: true });
    }
  }

  async compressPdf(
    compressRequest: CompressRequest,
    guestSessionId?: string,
    userId?: string,
  ): Promise<CompressResponse> {
    const { fileId, compressionLevel, outputName } = compressRequest;
    const startTime = Date.now();
    let activityId: string | undefined;

    if (!fileId) {
      throw new BadRequestException('File ID is required for compression');
    }

    if (!['low', 'medium', 'high'].includes(compressionLevel)) {
      throw new BadRequestException('Compression level must be low, medium, or high');
    }

    try {
      // Check guest session limits ONLY if user is not authenticated
      if (guestSessionId && !userId) {
        const canCompress =
          await this.guestSessionService.canPerformCompression(guestSessionId);
        if (!canCompress.allowed) {
          throw new ForbiddenException({
            message: `Guest users can only compress ${canCompress.maxCount} files. You have already used ${canCompress.currentCount}/${canCompress.maxCount} compressions.`,
            code: 'GUEST_LIMIT_EXCEEDED',
            currentCount: canCompress.currentCount,
            maxCount: canCompress.maxCount,
            feature: 'compression',
          });
        }
      }

      // Verify file exists before proceeding (using StorageService)
      try {
        await this.storageService.getFile(fileId, 'uploads');
      } catch (error) {
        throw new BadRequestException(`File not found: ${fileId}`);
      }

      // Create activity record for authenticated users (after all validations pass)
      if (userId) {
        const activity = await this.activityService.create({
          userId,
          type: 'compression',
          action: 'created',
          fileName: outputName || `compressed-${fileId}`,
          fileSize: 'Unknown', // We'll update this after compression
          status: 'processing',
          metadata: {
            inputFileId: fileId,
            compressionLevel,
          },
        });
        activityId = activity.id;
        console.log(`Created compression activity ${activityId} for user ${userId}`);
      }

      // Generate output filename
      const outputFileName = outputName || `compressed-${uuidv4()}.pdf`;

      // Call python service
      const response = await axios.post(
        `${this.pythonServiceUrl}/compress`,
        {
          fileId: fileId,
          compressionLevel: compressionLevel,
          outputName: outputFileName,
        },
        {
          timeout: 60000, // Longer timeout for compression
        },
      );

      if (
        !response.data ||
        response.data.status !== 'success' ||
        !response.data.fileName
      ) {
        throw new Error(
          `Unexpected response from Python service: ${JSON.stringify(response.data)}`,
        );
      }

      const compressedFileName = response.data.fileName as string;

      // Ensure the compressed file is present in shared temp storage
      try {
        await this.storageService.getFile(compressedFileName, 'temp');
      } catch (error) {
        throw new Error(
          'Compressed file not found in temp storage after Python service response',
        );
      }

      // Increment compression count for guest session ONLY if user is not authenticated
      if (guestSessionId && !userId) {
        await this.guestSessionService.incrementCompressionCount(guestSessionId);
        console.log(
          `Incremented compression count for guest session: ${guestSessionId}`,
        );
      }

      // Update activity record for authenticated users
      if (userId && activityId) {
        const duration = Date.now() - startTime;
        try {
          // Get file size of compressed output
          const outputFileStats = await this.storageService.getFile(compressedFileName, 'temp');
          const outputFileSize = outputFileStats ? this.formatFileSize(response.data.compressedSize || 0) : 'Unknown';

          await this.activityService.update(activityId, userId, {
            action: 'completed',
            status: 'completed',
            fileSize: outputFileSize,
            duration,
            metadata: {
              inputFileId: fileId,
              compressionLevel,
              originalSize: response.data.originalSize,
              compressedSize: response.data.compressedSize,
              compressionRatio: response.data.compressionRatio,
            },
          });
          console.log(`Updated compression activity ${activityId} as completed`);
        } catch (updateError) {
          console.error('Failed to update activity record:', updateError);
        }
      }

      // Track file for cleanup using FileTrackingService
      try {
        await this.fileTrackingService.trackFile({
          fileId: compressedFileName,
          folder: 'temp',
          userId,
          guestSessionId: guestSessionId && !userId ? guestSessionId : undefined,
          fileSize: response.data.compressedSize || 0,
          originalName: `compressed-${fileId}`,
          mimeType: 'application/pdf',
          service: 'compression',
        });
      } catch (trackingError) {
        console.error('Failed to track compressed file:', trackingError);
      }

      return response.data;
    } catch (error) {
      // Update activity record as failed for authenticated users
      if (userId && activityId) {
        const duration = Date.now() - startTime;
        try {
          await this.activityService.update(activityId, userId, {
            action: 'failed',
            status: 'failed',
            duration,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
          console.log(`Updated compression activity ${activityId} as failed`);
        } catch (updateError) {
          console.error('Failed to update activity record:', updateError);
        }
      }

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.detail || error.message;
        throw new BadRequestException(
          `Failed to compress PDF: ${errorMessage}`,
        );
      }
      if (error instanceof Error) {
        throw new BadRequestException(
          `Failed to compress PDF: ${error.message}`,
        );
      }
      throw new BadRequestException(
        'Failed to compress PDF: Unknown error',
      );
    }
  }

  private scheduleCleanup(fileIds: string[], outputFileName: string) {
    // Clean up uploaded files after 1 hour
    setTimeout(
      () => {
        fileIds.forEach((fileId) => {
          const filePath = path.join(this.uploadsPath, fileId);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });

        // Clean up compressed file after 2 hours
        setTimeout(
          () => {
            const outputPath = path.join(this.tempPath, outputFileName);
            if (fs.existsSync(outputPath)) {
              fs.unlinkSync(outputPath);
            }
          },
          2 * 60 * 60 * 1000,
        ); // 2 hours
      },
      60 * 60 * 1000,
    ); // 1 hour
  }

  getFileInfo(fileName: string) {
    const filePath = path.join(this.tempPath, fileName);

    if (!fs.existsSync(filePath)) {
      throw new BadRequestException('File not found');
    }

    const stats = fs.statSync(filePath);
    return {
      fileName,
      size: stats.size,
      createdAt: stats.birthtime,
    };
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
