// src/pdf_to_word/pdf-to-word.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { StorageService } from '../storage/storage.service';
import { GuestSessionService } from '../guest-session/guest-session.service';
import { ActivityService } from '../activity/activity.service';
import { FileTrackingService } from '../file-tracking/file-tracking.service';

export interface ConvertRequest {
  fileId: string;
  outputName?: string;
}

@Injectable()
export class PdfToWordService {
  private readonly pythonServiceUrl: string;

  constructor(
    private readonly storageService: StorageService,
    private readonly guestSessionService: GuestSessionService,
    private readonly activityService: ActivityService,
    private readonly fileTrackingService: FileTrackingService,
  ) {
    // Python PyMuPDF conversion service URL
    this.pythonServiceUrl = process.env.PYTHON_SERVICE_URL!;
    if (!this.pythonServiceUrl) {
      throw new Error('PYTHON_SERVICE_URL environment variable is required');
    }
  }

  async convertPdfToWord(
    convertRequest: ConvertRequest,
    guestSessionId?: string,
    userId?: string,
  ): Promise<{
    status: string;
    fileName: string;
    pageCount: number | string;
    timestamp: Date;
  }> {
    const { fileId, outputName } = convertRequest;

    if (!fileId) {
      throw new BadRequestException('File ID is required for conversion');
    }

    const startTime = Date.now();
    let activityId: string | undefined;

    try {
      // Check guest session limits ONLY if user is not authenticated
      if (guestSessionId && !userId) {
        const canConvert =
          await this.guestSessionService.canPerformConversion(guestSessionId);
        if (!canConvert.allowed) {
          throw new ForbiddenException({
            message: `Guest users can only convert ${canConvert.maxCount} files. You have already used ${canConvert.currentCount}/${canConvert.maxCount} conversions.`,
            code: 'GUEST_LIMIT_EXCEEDED',
            currentCount: canConvert.currentCount,
            maxCount: canConvert.maxCount,
            feature: 'conversion',
          });
        }
      }

      // Verify file exists in storage (this will work for both S3 and local)
      try {
        await this.storageService.getFile(fileId, 'uploads');
      } catch (error) {
        throw new BadRequestException(`File not found: ${fileId}`);
      }

      // Create activity record for authenticated users (after all validations pass)
      if (userId) {
        const activity = await this.activityService.create({
          userId,
          type: 'conversion',
          action: 'created',
          fileName: outputName || `converted-${fileId}.docx`,
          fileSize: 'Unknown', // We'll update this after conversion
          status: 'processing',
          metadata: {
            inputFileId: fileId,
            conversionType: 'pdf-to-word',
          },
        });
        activityId = activity.id;
        console.log(
          `Created conversion activity ${activityId} for user ${userId}`,
        );
      }

      // Generate output filename
      const outputFileName = `converted-${uuidv4()}.docx`;

      // Call python service
      const response = await axios.post(
        `${this.pythonServiceUrl}/convert/pdf-to-word`,
        {
          fileId: fileId,
          outputName: outputFileName,
        },
        {
          timeout: 30000,
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

      const outputFileId = response.data.fileName as string;

      // Increment conversion count for guest session ONLY if user is not authenticated
      if (guestSessionId && !userId) {
        await this.guestSessionService.incrementConversionCount(guestSessionId);
        console.log(
          `Incremented conversion count for guest session: ${guestSessionId}`,
        );
      }

      // Update activity record for authenticated users
      if (userId && activityId) {
        const duration = Date.now() - startTime;
        try {
          // Get file size of converted output
          const fileBuffer = await this.storageService.getFile(
            outputFileId,
            'temp',
          );
          const fileSize = this.formatFileSize(fileBuffer.length);

          await this.activityService.update(activityId, userId, {
            action: 'completed',
            status: 'completed',
            duration,
            fileSize,
            fileId: outputFileId,
            metadata: {
              inputFileId: fileId,
              conversionType: 'pdf-to-word',
            },
          });
          console.log(`Updated conversion activity ${activityId} as completed`);
        } catch (error) {
          console.warn('Failed to update activity with file size:', error);
          // Still update the activity as completed even if we can't get file size
          await this.activityService.update(activityId, userId, {
            action: 'completed',
            status: 'completed',
            duration: Date.now() - startTime,
            fileId: outputFileId,
            metadata: {
              inputFileId: fileId,
              conversionType: 'pdf-to-word',
            },
          });
        }
      }

      // Track the output file for cleanup
      try {
        const fileBuffer = await this.storageService.getFile(
          outputFileId,
          'temp',
        );
        await this.fileTrackingService.trackFile({
          fileId: outputFileId,
          folder: 'temp',
          userId,
          guestSessionId,
          fileSize: fileBuffer.length,
          originalName: outputName || `converted-${fileId}.docx`,
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          service: 'pdf-to-word',
        });
        console.log(`Tracked converted file: ${outputFileId}`);
      } catch (error) {
        console.warn('Failed to track converted file:', error);
      }

      return response.data;
    } catch (error) {
      // Update activity record as failed for authenticated users
      if (userId && activityId) {
        try {
          await this.activityService.update(activityId, userId, {
            action: 'failed',
            status: 'failed',
            duration: Date.now() - startTime,
            errorMessage:
              error instanceof Error ? error.message : 'Unknown error occurred',
          });
          console.log(`Updated conversion activity ${activityId} as failed`);
        } catch (activityError) {
          console.warn('Failed to update activity as failed:', activityError);
        }
      }

      if (error instanceof Error) {
        throw new BadRequestException(
          `Failed to convert PDF to Word: ${error.message}`,
        );
      }
      throw new BadRequestException(
        'Failed to convert PDF to Word: Unknown error',
      );
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async getFileInfo(fileName: string) {
    try {
      // This will throw an error if file doesn't exist
      const fileBuffer = await this.storageService.getFile(fileName, 'temp');

      return {
        fileName,
        size: fileBuffer.length,
        createdAt: new Date(), // For S3, we don't have creation time easily available
      };
    } catch (error) {
      throw new BadRequestException('File not found');
    }
  }
}
