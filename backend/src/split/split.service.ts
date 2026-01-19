// src/split/split.service.ts
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import * as archiver from 'archiver';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import { GuestSessionService } from '../guest-session/guest-session.service';
import { ActivityService } from '../activity/activity.service';
import { FileTrackingService } from '../file-tracking/file-tracking.service';
import { StorageService } from '../storage/storage.service';

export interface SplitByPatternRequest {
  fileId: string;
  splitByPattern: string;
  outputName?: string;
  options: {
    pages: [];
  };
}

export interface SplitByRangeRequest {
  fileId: string;
  splitByRange: string;
  outputName?: string;
}

export interface SplitByTextPatternRequest {
  fileId: string;
  splitByTextPattern: string;
  outputName?: string;
}

export interface SplitByBookmarkRequest {
  fileId: string;
  splitByBookmark: boolean;
  outputName?: string;
}

export interface ExtractPagesRequest {
  fileId: string;
  extractPages: string;
  outputName?: string;
}

export interface SplitResult {
  files: string[];
  zipFile?: string; // Optional ZIP file name
  fileName: string;
}

@Injectable()
export class SplitService {
  private readonly uploadsPath = './uploads';
  private readonly tempPath = './temp';
  private readonly pythonServiceUrl: string;

  constructor(
    private readonly guestSessionService: GuestSessionService,
    private readonly activityService: ActivityService,
    private readonly fileTrackingService: FileTrackingService,
    private readonly storageService: StorageService,
  ) {
    // Python PyMuPDF split service URL
    this.pythonServiceUrl = process.env.PYTHON_SERVICE_URL!;
    if (!this.pythonServiceUrl) {
      throw new Error('PYTHON_SERVICE_URL environment variable is required');
    }
    console.log('Python service URL for split:', this.pythonServiceUrl);
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempPath)) {
      fs.mkdirSync(this.tempPath, { recursive: true });
    }
  }

  /**
   * Creates a ZIP file from existing files and returns the ZIP as a stream
   */
  async createZipStream(
    fileNames: string[],
  ): Promise<{ stream: Readable; filename: string }> {
    const zipFileName = `split-files-${Date.now()}.zip`;
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    // Add each PDF file to the ZIP
    fileNames.forEach((fileName) => {
      const filePath = path.join(this.tempPath, fileName);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: fileName });
      }
    });

    await archive.finalize();

    return {
      stream: archive,
      filename: zipFileName,
    };
  }

  private async createZipFromFiles(
    fileNames: string[],
    zipBaseName: string,
  ): Promise<string> {
    console.log('in the createZipFromFiles', fileNames, zipBaseName);
    return new Promise((resolve, reject) => {
      const zipFileName = `${zipBaseName}.zip`;
      const zipPath = path.join(this.tempPath, zipFileName);
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', {
        zlib: { level: 9 }, // Maximum compression
      });

      output.on('close', () => {
        console.log(
          `ZIP file created: ${zipFileName} (${archive.pointer()} total bytes)`,
        );
        resolve(zipFileName);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      // Add each PDF file to the ZIP
      fileNames.forEach((fileName) => {
        const filePath = path.join(this.tempPath, fileName);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: fileName });
        }
      });

      archive.finalize();
    });
  }

  async splitByPattern(
    request: SplitByPatternRequest,
    createZip: boolean = true,
    guestSessionId?: string,
    userId?: string,
  ): Promise<SplitResult> {
    console.log('splittitng', request, createZip);
    const { fileId, splitByPattern, outputName } = request;

    if (!fileId || !splitByPattern) {
      throw new BadRequestException('File ID and split pattern are required');
    }

    const startTime = Date.now();
    let activityId: string | undefined;

    try {
      // Check guest session limits ONLY if user is not authenticated
      if (guestSessionId && !userId) {
        const canSplit = await this.guestSessionService.canPerformSplit(guestSessionId);
        if (!canSplit.allowed) {
          throw new ForbiddenException({
            message: `Guest users can only split ${canSplit.maxCount} files. You have already used ${canSplit.currentCount}/${canSplit.maxCount} splits.`,
            code: 'GUEST_LIMIT_EXCEEDED',
            currentCount: canSplit.currentCount,
            maxCount: canSplit.maxCount,
            feature: 'split',
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
          type: 'split',
          action: 'created',
          fileName: outputName || `split-${fileId}`,
          fileSize: 'Unknown', // We'll update this after split
          status: 'processing',
          metadata: {
            inputFileId: fileId,
            splitType: 'pattern',
            splitByPattern,
          },
        });
        activityId = activity.id;
        console.log(`Created split activity ${activityId} for user ${userId}`);
      }

      const filePath = path.join(this.uploadsPath, fileId);
      if (!fs.existsSync(filePath)) {
        throw new BadRequestException(`File not found: ${fileId}`);
      }

      // Prepare payload for Python service
      const payload = {
        fileId,
        splitByPattern,
        outputName: outputName || `split-${uuidv4()}`,
      };

      // Call Python split endpoint
      const response = await axios.post(
        `${this.pythonServiceUrl}/split/pattern`,
        payload,
        {
          timeout: 30000,
        },
      );

      if (
        !response.data ||
        response.data.status !== 'success' ||
        !response.data.files
      ) {
        throw new Error(
          `Unexpected response from Python service: ${JSON.stringify(response.data)}`,
        );
      }

      const outputFiles: string[] = response.data.files as string[];
      const baseOutputName = outputName || `split-${uuidv4()}`;

      // Verify all split files exist in temp storage
      for (const fileName of outputFiles) {
        try {
          await this.storageService.getFile(fileName, 'temp');
        } catch (error) {
          throw new Error(
            `Split file ${fileName} not found in temp storage after Python service response`,
          );
        }
      }

      console.log('about to zippp', createZip, outputFiles.length);

      let zipFile: string | undefined;
      if (createZip && outputFiles.length > 1) {
        console.log('zip filllesss', outputFiles.length);
        zipFile = await this.createZipFromFiles(
          outputFiles,
          `${baseOutputName}`,
        );
      }

      // Increment split count for guest session ONLY if user is not authenticated
      if (guestSessionId && !userId) {
        await this.guestSessionService.incrementSplitCount(guestSessionId);
        console.log(`Incremented split count for guest session: ${guestSessionId}`);
      }

      // Update activity record for authenticated users
      if (userId && activityId) {
        const duration = Date.now() - startTime;
        await this.activityService.update(activityId, userId, {
          action: 'completed',
          status: 'completed',
          duration,
          fileSize: `${outputFiles.length} files`,
          metadata: {
            inputFileId: fileId,
            splitType: 'pattern',
            splitByPattern,
            outputFiles: outputFiles.length,
          },
        });
        console.log(`Updated split activity ${activityId} as completed`);
      }

      // Track output files for cleanup
      for (const outputFile of outputFiles) {
        try {
          await this.fileTrackingService.trackFile({
            fileId: outputFile,
            folder: 'temp',
            userId,
            guestSessionId,
            fileSize: 0, // We don't have file size info from ConvertAPI
            originalName: outputFile,
            mimeType: 'application/pdf',
            service: 'split',
          });
          console.log(`Tracked split file: ${outputFile}`);
        } catch (error) {
          console.warn(`Failed to track split file ${outputFile}:`, error);
        }
      }

      return { files: outputFiles, zipFile, fileName: `${baseOutputName}.zip` };
    } catch (error) {
      // Update activity record as failed for authenticated users
      if (userId && activityId) {
        try {
          await this.activityService.update(activityId, userId, {
            action: 'failed',
            status: 'failed',
            duration: Date.now() - startTime,
            errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
          });
          console.log(`Updated split activity ${activityId} as failed`);
        } catch (activityError) {
          console.warn('Failed to update activity as failed:', activityError);
        }
      }
      if (error instanceof Error) {
        throw new BadRequestException(`Failed to split PDF: ${error.message}`);
      }
      throw new BadRequestException('Failed to split PDF');
    }
  }

  async splitByRange(
    request: SplitByRangeRequest,
    guestSessionId?: string,
    userId?: string,
  ): Promise<SplitResult> {
    const { fileId, splitByRange, outputName } = request;

    if (!fileId || !splitByRange) {
      throw new BadRequestException('File ID and split range are required');
    }

    const startTime = Date.now();
    let activityId: string | undefined;

    try {
      // Check guest session limits ONLY if user is not authenticated
      if (guestSessionId && !userId) {
        const canSplit = await this.guestSessionService.canPerformSplit(guestSessionId);
        if (!canSplit.allowed) {
          throw new ForbiddenException({
            message: `Guest users can only split ${canSplit.maxCount} files. You have already used ${canSplit.currentCount}/${canSplit.maxCount} splits.`,
            code: 'GUEST_LIMIT_EXCEEDED',
            currentCount: canSplit.currentCount,
            maxCount: canSplit.maxCount,
            feature: 'split',
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
          type: 'split',
          action: 'created',
          fileName: outputName || `split-range-${fileId}`,
          fileSize: 'Unknown', // We'll update this after split
          status: 'processing',
          metadata: {
            inputFileId: fileId,
            splitType: 'range',
            splitByRange,
          },
        });
        activityId = activity.id;
        console.log(`Created split activity ${activityId} for user ${userId}`);
      }

      const filePath = path.join(this.uploadsPath, fileId);
      if (!fs.existsSync(filePath)) {
        throw new BadRequestException(`File not found: ${fileId}`);
      }

      // Prepare payload for Python service
      const payload = {
        fileId,
        splitByRange,
        outputName: outputName || `split-range-${uuidv4()}`,
      };

      // Call Python split endpoint
      const response = await axios.post(
        `${this.pythonServiceUrl}/split/range`,
        payload,
        {
          timeout: 30000,
        },
      );

      if (
        !response.data ||
        response.data.status !== 'success' ||
        !response.data.files
      ) {
        throw new Error(
          `Unexpected response from Python service: ${JSON.stringify(response.data)}`,
        );
      }

      const outputFiles: string[] = response.data.files as string[];
      const baseOutputName = outputName || `split-range-${uuidv4()}`;

      // Verify all split files exist in temp storage
      for (const fileName of outputFiles) {
        try {
          await this.storageService.getFile(fileName, 'temp');
        } catch (error) {
          throw new Error(
            `Split file ${fileName} not found in temp storage after Python service response`,
          );
        }
      }

      // Increment split count for guest session ONLY if user is not authenticated
      if (guestSessionId && !userId) {
        await this.guestSessionService.incrementSplitCount(guestSessionId);
        console.log(`Incremented split count for guest session: ${guestSessionId}`);
      }

      // Update activity record for authenticated users
      if (userId && activityId) {
        const duration = Date.now() - startTime;
        await this.activityService.update(activityId, userId, {
          action: 'completed',
          status: 'completed',
          duration,
          fileSize: `${outputFiles.length} files`,
          metadata: {
            inputFileId: fileId,
            splitType: 'range',
            splitByRange,
            outputFiles: outputFiles.length,
          },
        });
        console.log(`Updated split activity ${activityId} as completed`);
      }

      // Track output files for cleanup
      for (const outputFile of outputFiles) {
        try {
          await this.fileTrackingService.trackFile({
            fileId: outputFile,
            folder: 'temp',
            userId,
            guestSessionId,
            fileSize: 0, // We don't have file size info from ConvertAPI
            originalName: outputFile,
            mimeType: 'application/pdf',
            service: 'split',
          });
          console.log(`Tracked split file: ${outputFile}`);
        } catch (error) {
          console.warn(`Failed to track split file ${outputFile}:`, error);
        }
      }

      return {
        files: outputFiles,
        fileName: baseOutputName,
      };
    } catch (error) {
      // Update activity record as failed for authenticated users
      if (userId && activityId) {
        try {
          await this.activityService.update(activityId, userId, {
            action: 'failed',
            status: 'failed',
            duration: Date.now() - startTime,
            errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
          });
          console.log(`Updated split activity ${activityId} as failed`);
        } catch (activityError) {
          console.warn('Failed to update activity as failed:', activityError);
        }
      }

      if (error instanceof Error) {
        throw new BadRequestException(`Failed to split PDF: ${error.message}`);
      }
      throw new BadRequestException('Failed to split PDF');
    }
  }

  async splitByTextPattern(
    request: SplitByTextPatternRequest,
  ): Promise<string[]> {
    // TODO: Update this method to use Python service and add guest session handling
    throw new BadRequestException('Text pattern splitting is not currently supported. Please use pattern or range splitting instead.');
  }
}
