import { Injectable, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class DownloadService {
  private readonly tempDir = path.join(process.cwd(), 'temp');

  constructor(private readonly storageService: StorageService) {}

  async downloadFile(
    fileName: string,
    res: Response,
    folder: 'uploads' | 'temp' = 'temp',
  ): Promise<void> {
    try {
      console.log('filenameeeeee', fileName);
      if (this.storageService.isUsingS3()) {
        // Proxy through server to avoid CORS issues
        try {
          const fileBuffer = await this.storageService.getFile(fileName, folder);
          
          // Determine MIME type
          const mimeType = mime.lookup(fileName) || 'application/octet-stream';
          
          // Set headers for file download
          res.setHeader('Content-Type', mimeType);
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
          res.setHeader('Content-Length', fileBuffer.length.toString());
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          
          // Send the file buffer
          res.send(fileBuffer);
        } catch (error) {
          console.error('Error downloading file from S3:', error);
          res.status(404).json({ message: 'File not found' });
        }
      } else {
        // For local storage, serve the file directly
        const baseDir =
          folder === 'uploads'
            ? path.join(process.cwd(), 'uploads')
            : this.tempDir;
        const filePath = path.join(baseDir, fileName);

        if (!fs.existsSync(filePath)) {
          res.status(404).json({ message: 'File not found' });
          return;
        }

        // Get file stats for additional info
        const stats = fs.statSync(filePath);

        // Determine MIME type based on file extension
        const lookupResult = mime.lookup(fileName);
        const mimeType: string =
          typeof lookupResult === 'string'
            ? lookupResult
            : 'application/octet-stream';

        // Set headers for file download
        res.setHeader('Content-Type', mimeType);
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${fileName}"`,
        );
        res.setHeader('Content-Length', stats.size.toString());

        // Send file
        res.sendFile(filePath);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      res.status(500).json({ message: 'Error downloading file' });
    }
  }

  async getFileInfo(fileName: string, folder: 'uploads' | 'temp' = 'temp') {
    try {
      if (this.storageService.isUsingS3()) {
        // For S3, we can't get detailed file stats without downloading
        // Return basic info and a signed URL
        const mimeType: string =
          mime.lookup(fileName) || 'application/octet-stream';
        const fileExtension = path.extname(fileName).toLowerCase();
        const downloadUrl = await this.storageService.getDownloadUrl(
          fileName,
          folder,
        );

        return {
          fileName,
          mimeType,
          extension: fileExtension,
          downloadUrl,
          storageType: 's3',
        };
      } else {
        // For local storage, get full file stats
        const baseDir =
          folder === 'uploads'
            ? path.join(process.cwd(), 'uploads')
            : this.tempDir;
        const filePath = path.join(baseDir, fileName);

        if (!fs.existsSync(filePath)) {
          throw new NotFoundException('File not found');
        }

        const stats = fs.statSync(filePath);
        const mimeType: string =
          mime.lookup(fileName) || 'application/octet-stream';
        const fileExtension = path.extname(fileName).toLowerCase();

        return {
          fileName,
          filePath,
          size: stats.size,
          mimeType,
          extension: fileExtension,
          created: stats.birthtime,
          modified: stats.mtime,
          isFile: stats.isFile(),
          storageType: 'local',
        };
      }
    } catch (error) {
      console.error('Error getting file info:', error);
      throw new NotFoundException('File not found or error accessing file');
    }
  }

  listFiles() {
    if (!fs.existsSync(this.tempDir)) {
      return [];
    }

    const files = fs.readdirSync(this.tempDir);
    return files.map((fileName) => {
      const filePath = path.join(this.tempDir, fileName);
      const stats = fs.statSync(filePath);
      const mimeType: string =
        mime.lookup(fileName) || 'application/octet-stream';

      return {
        fileName,
        size: stats.size,
        mimeType,
        extension: path.extname(fileName).toLowerCase(),
        created: stats.birthtime,
        modified: stats.mtime,
      };
    });
  }
}
