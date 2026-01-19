// src/merge/merge.service.ts
import {
  BadRequestException,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { StorageService } from '../storage/storage.service';
import { GuestSessionService } from '../guest-session/guest-session.service';
import { ActivityService } from '../activity/activity.service';
import { FileTrackingService } from '../file-tracking/file-tracking.service';

export interface MergeRequest {
  fileIds: string[];
  outputName?: string;
}

@Injectable()
export class MergeService {
  private readonly uploadsPath = './uploads';
  private readonly tempPath = './temp';
  private readonly pythonServiceUrl: string;

  constructor(
    private readonly storageService: StorageService,
    private readonly guestSessionService: GuestSessionService,
    private readonly activityService: ActivityService,
    private readonly fileTrackingService: FileTrackingService,
  ) {
    // Python PyMuPDF merge service URL
    this.pythonServiceUrl = process.env.PYTHON_SERVICE_URL!;
    console.log('Python service URL for merge:', this.pythonServiceUrl);
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempPath)) {
      fs.mkdirSync(this.tempPath, { recursive: true });
    }
  }

  async mergePDFs(
    mergeRequest: MergeRequest,
    guestSessionId?: string,
    userId?: string,
  ): Promise<string | undefined> {
    const { fileIds, outputName } = mergeRequest;

    if (!fileIds || fileIds.length < 2) {
      throw new BadRequestException(
        'At least 2 PDF files required for merging',
      );
    }

    const startTime = Date.now();
    let activityId: string | undefined;

    try {
      // Check guest session limits ONLY if user is not authenticated
      if (guestSessionId && !userId) {
        const canMerge =
          await this.guestSessionService.canPerformMerge(guestSessionId);
        if (!canMerge.allowed) {
          throw new ForbiddenException({
            message: `Guest users can only merge ${canMerge.maxCount} files. You have already used ${canMerge.currentCount}/${canMerge.maxCount} merges.`,
            code: 'GUEST_LIMIT_EXCEEDED',
            currentCount: canMerge.currentCount,
            maxCount: canMerge.maxCount,
            feature: 'merge',
          });
        }
      }

      // Verify all files exist before proceeding (in shared uploads)
      for (const fileId of fileIds) {
        try {
          await this.storageService.getFile(fileId, 'uploads');
        } catch (error) {
          throw new BadRequestException(`File not found: ${fileId}`);
        }
      }

      // Create activity record for authenticated users (after all validations pass)
      if (userId) {
        const activity = await this.activityService.create({
          userId,
          type: 'merge',
          action: 'created',
          fileName: outputName || `merged-${fileIds.length}-files.pdf`,
          fileSize: 'Unknown', // We'll update this after merge
          status: 'processing',
          metadata: {
            inputFileCount: fileIds.length,
            inputFileIds: fileIds,
          },
        });
        activityId = activity.id;
        console.log(`Created merge activity ${activityId} for user ${userId}`);
      }

      // Prepare payload for Python service
      const payload = {
        fileIds,
        outputName: `merged-${uuidv4()}.pdf`,
      };

      // Call Python merge endpoint (JSON body)
      const response = await axios.post(
        `${this.pythonServiceUrl}/merge`,
        payload,
        {
          timeout: 30000,
        },
      );

      if (
        !response.data ||
        response.data.status !== 'success' ||
        !response.data.fileId
      ) {
        throw new Error(
          `Unexpected response from Python service: ${JSON.stringify(response.data)}`,
        );
      }

      const outputFileName = response.data.fileId as string;

      // Ensure the merged file is present in shared temp storage
      try {
        await this.storageService.getFile(outputFileName, 'temp');
      } catch (error) {
        throw new Error(
          'Merged file not found in temp storage after Python service response',
        );
      }

      // Increment merge count for guest session ONLY if user is not authenticated
      if (guestSessionId && !userId) {
        await this.guestSessionService.incrementMergeCount(guestSessionId);
        console.log(
          `Incremented merge count for guest session: ${guestSessionId}`,
        );
      }

      // Update activity record for authenticated users
      if (userId && activityId) {
        const duration = Date.now() - startTime;
        try {
          // Get file size of merged output
          const fileBuffer = await this.storageService.getFile(
            outputFileName,
            'temp',
          );
          const fileSize = this.formatFileSize(fileBuffer.length);

          await this.activityService.update(activityId, userId, {
            action: 'completed',
            status: 'completed',
            duration,
            fileSize,
            fileId: outputFileName,
            metadata: {
              inputFileCount: fileIds.length,
              inputFileIds: fileIds,
              outputFileSize: fileBuffer.length,
            },
          });
          console.log(`Updated merge activity ${activityId} as completed`);
        } catch (error) {
          console.warn('Failed to update activity with file size:', error);
          // Still update the activity as completed even if we can't get file size
          await this.activityService.update(activityId, userId, {
            action: 'completed',
            status: 'completed',
            duration: Date.now() - startTime,
            fileId: outputFileName,
            metadata: {
              inputFileCount: fileIds.length,
              inputFileIds: fileIds,
            },
          });
        }
      }

      // Track the output file for cleanup
      try {
        const fileBuffer = await this.storageService.getFile(
          outputFileName,
          'temp',
        );
        await this.fileTrackingService.trackFile({
          fileId: outputFileName,
          folder: 'temp',
          userId,
          guestSessionId,
          fileSize: fileBuffer.length,
          originalName: outputName || `merged-${fileIds.length}-files.pdf`,
          mimeType: 'application/pdf',
          service: 'merge',
        });
        console.log(`Tracked merged file: ${outputFileName}`);
      } catch (error) {
        console.warn('Failed to track merged file:', error);
      }

      return outputFileName;
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
          console.log(`Updated merge activity ${activityId} as failed`);
        } catch (activityError) {
          console.warn('Failed to update activity as failed:', activityError);
        }
      }

      if (error instanceof Error) {
        throw new BadRequestException(`Failed to merge PDFs: ${error.message}`);
      }
    }
  }

  // Optionally, future fallback strategies (e.g., pdf-lib) could be added here if Python service is unavailable.

  async getFileInfo(fileName: string) {
    try {
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

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
