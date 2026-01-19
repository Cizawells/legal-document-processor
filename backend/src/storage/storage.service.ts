// src/storage/storage.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Readable } from 'stream';

export interface UploadResult {
  fileId: string;
  originalName: string;
  size: number;
  url?: string;
}

@Injectable()
export class StorageService {
  private s3Client: S3Client | null = null;
  private readonly useS3: boolean;
  private readonly bucketName: string;
  private readonly uploadsDir: string;
  private readonly tempDir: string;

  constructor(private configService: ConfigService) {
    const storageType = this.configService.get('STORAGE_TYPE');
    this.useS3 = storageType === 's3' || storageType === 'r2';

    // Support both S3 and R2 bucket name configurations
    this.bucketName = this.configService.get(
      storageType === 'r2' ? 'R2_BUCKET_NAME' : 'S3_BUCKET_NAME',
      'pdf-app-files-' + Date.now(),
    );
    this.uploadsDir = path.resolve(process.cwd(), 'uploads');
    this.tempDir = path.resolve(process.cwd(), 'temp');

    if (this.useS3) {
      let accessKeyId: string;
      let secretAccessKey: string;
      let region: string;
      let endpoint: string | undefined;

      if (storageType === 'r2') {
        // Cloudflare R2 configuration
        const r2AccessKeyId =
          this.configService.get<string>('R2_ACCESS_KEY_ID');
        const r2SecretAccessKey = this.configService.get<string>(
          'R2_SECRET_ACCESS_KEY',
        );
        const accountId = this.configService.get<string>('R2_ACCOUNT_ID');

        if (!r2AccessKeyId || !r2SecretAccessKey || !accountId) {
          throw new Error(
            'Cloudflare R2 credentials are required when STORAGE_TYPE is set to "r2". ' +
              'Please set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ACCOUNT_ID environment variables.',
          );
        }

        accessKeyId = r2AccessKeyId;
        secretAccessKey = r2SecretAccessKey;
        region = 'auto'; // R2 uses 'auto' as region
        endpoint =
          this.configService.get<string>('R2_ENDPOINT') ||
          `https://${accountId}.r2.cloudflarestorage.com`;
      } else {
        // AWS S3 configuration
        const awsAccessKeyId =
          this.configService.get<string>('AWS_ACCESS_KEY_ID');
        const awsSecretAccessKey = this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        );

        if (!awsAccessKeyId || !awsSecretAccessKey) {
          throw new Error(
            'AWS credentials are required when STORAGE_TYPE is set to "s3". ' +
              'Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.',
          );
        }

        accessKeyId = awsAccessKeyId;
        secretAccessKey = awsSecretAccessKey;
        region = this.configService.get('AWS_REGION', 'us-west-2');
        endpoint = undefined; // Use default AWS S3 endpoint
      }

      this.s3Client = new S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        // Force path-style addressing for R2 compatibility
        forcePathStyle: storageType === 'r2',
      });
    } else {
      // Ensure local directories exist
      this.ensureLocalDirectories();
    }
  }

  private async ensureLocalDirectories() {
    await fs.mkdir(this.uploadsDir, { recursive: true });
    await fs.mkdir(this.tempDir, { recursive: true });
  }

  /**
   * Upload a file to storage (S3/R2 or local)
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: 'uploads' | 'temp' = 'uploads',
  ): Promise<UploadResult> {
    if (this.useS3) {
      return this.uploadToS3(file, folder);
    } else {
      return this.uploadToLocal(file, folder);
    }
  }

  /**
   * Get a file from storage
   */
  async getFile(
    fileId: string,
    folder: 'uploads' | 'temp' = 'uploads',
  ): Promise<Buffer> {
    if (this.useS3) {
      return this.getFromS3(fileId, folder);
    } else {
      return this.getFromLocal(fileId, folder);
    }
  }

  /**
   * Get a signed URL for downloading (S3/R2 only, returns local path for local storage)
   */
  async getDownloadUrl(
    fileId: string,
    folder: 'uploads' | 'temp' = 'temp',
    expiresIn = 3600,
  ): Promise<string> {
    if (this.useS3) {
      if (!this.s3Client) {
        throw new Error('Cloud storage client is not initialized');
      }
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: `${folder}/${fileId}`,
      });
      return getSignedUrl(this.s3Client, command, { expiresIn });
    } else {
      // For local storage, return a path that the download endpoint can use
      return `/api/files/download/${folder}/${fileId}`;
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(
    fileId: string,
    folder: 'uploads' | 'temp' = 'uploads',
  ): Promise<void> {
    if (this.useS3) {
      await this.deleteFromS3(fileId, folder);
    } else {
      await this.deleteFromLocal(fileId, folder);
    }
  }

  /**
   * Get the absolute path for Python service (works for S3, R2, and local)
   */
  getStoragePath(folder: 'uploads' | 'temp'): string {
    if (this.useS3) {
      const storageType = this.configService.get('STORAGE_TYPE');
      return `${storageType}://${this.bucketName}/${folder}`;
    } else {
      return folder === 'uploads' ? this.uploadsDir : this.tempDir;
    }
  }

  /**
   * Check if using cloud storage (S3 or R2)
   */
  isUsingS3(): boolean {
    return this.useS3;
  }

  // Cloud Storage Methods (S3/R2)
  private async uploadToS3(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadResult> {
    if (!this.s3Client) {
      throw new Error('Cloud storage client is not initialized');
    }

    const key = `${folder}/${file.filename}`;

    const storageType = this.configService.get('STORAGE_TYPE');
    console.log(`Attempting ${storageType?.toUpperCase()} upload:`, {
      bucket: this.bucketName,
      key: key,
      region:
        storageType === 'r2'
          ? 'auto'
          : this.configService.get('AWS_REGION', 'us-west-2'),
      fileSize: file.size,
      storageType,
    });

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer || (await fs.readFile(file.path)),
      ContentType: file.mimetype,
    });

    // Retry logic for time skew and other transient errors
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.s3Client.send(command);
        console.log(
          `${storageType?.toUpperCase()} upload successful for key: ${key} (attempt ${attempt})`,
        );
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error;
        const errorCode = error.Code || error.name;

        console.error(
          `${storageType?.toUpperCase()} upload failed (attempt ${attempt}/${maxRetries}):`,
          {
            bucket: this.bucketName,
            key: key,
            error: error.message,
            code: errorCode,
            storageType,
          },
        );

        // Check if it's a retryable error
        const retryableErrors = [
          'RequestTimeTooSkewed',
          'ServiceUnavailable',
          'SlowDown',
          'RequestTimeout',
          'InternalError',
        ];

        if (retryableErrors.includes(errorCode) && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(
            `Retrying ${storageType?.toUpperCase()} upload in ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // If not retryable or max retries reached, throw the error
        throw error;
      }
    }

    // Clean up local file if it exists
    if (file.path) {
      await fs.unlink(file.path).catch(() => {});
    }

    return {
      fileId: file.filename,
      originalName: file.originalname,
      size: file.size,
      url: `${storageType}://${this.bucketName}/${key}`,
    };
  }

  private async getFromS3(fileId: string, folder: string): Promise<Buffer> {
    if (!this.s3Client) {
      throw new Error('Cloud storage client is not initialized');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: `${folder}/${fileId}`,
    });

    const response = await this.s3Client.send(command);
    const stream = response.Body as Readable;

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  private async deleteFromS3(fileId: string, folder: string): Promise<void> {
    if (!this.s3Client) {
      throw new Error('Cloud storage client is not initialized');
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: `${folder}/${fileId}`,
    });

    await this.s3Client.send(command);
  }

  // Local Methods
  private async uploadToLocal(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadResult> {
    const targetDir = folder === 'uploads' ? this.uploadsDir : this.tempDir;
    const targetPath = path.join(targetDir, file.filename);

    // If file is already in the right place, skip
    if (file.path !== targetPath) {
      if (file.buffer) {
        await fs.writeFile(targetPath, file.buffer);
      } else {
        await fs.rename(file.path, targetPath);
      }
    }

    return {
      fileId: file.filename,
      originalName: file.originalname,
      size: file.size,
      url: targetPath,
    };
  }

  private async getFromLocal(fileId: string, folder: string): Promise<Buffer> {
    const targetDir = folder === 'uploads' ? this.uploadsDir : this.tempDir;
    const filePath = path.join(targetDir, fileId);
    return fs.readFile(filePath);
  }

  private async deleteFromLocal(fileId: string, folder: string): Promise<void> {
    const targetDir = folder === 'uploads' ? this.uploadsDir : this.tempDir;
    const filePath = path.join(targetDir, fileId);
    await fs.unlink(filePath).catch(() => {});
  }
}
