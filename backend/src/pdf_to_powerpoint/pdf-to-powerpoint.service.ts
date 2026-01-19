// src/pdf_to_powerpoint/pdf-to-powerpoint.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface ConvertRequest {
  fileId: string;
  outputName?: string;
}

@Injectable()
export class PdfToPowerpointService {
  private readonly uploadsPath = './uploads';
  private readonly tempPath = './temp';
  private readonly pythonServiceUrl: string;

  constructor() {
    // Python PyMuPDF conversion service URL
    this.pythonServiceUrl = process.env.PYTHON_SERVICE_URL!;
    if (!this.pythonServiceUrl) {
      throw new Error('PYTHON_SERVICE_URL environment variable is required');
    }
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempPath)) {
      fs.mkdirSync(this.tempPath, { recursive: true });
    }
  }

  async convertPdfToPowerpoint(convertRequest: ConvertRequest): Promise<{
    status: string;
    fileName: string;
    pageCount: number | string;
    timestamp: Date;
  }> {
    const { fileId, outputName } = convertRequest;

    if (!fileId) {
      throw new BadRequestException('File ID is required for conversion');
    }

    try {
      const filePath = path.join(this.uploadsPath, fileId);

      if (!fs.existsSync(filePath)) {
        throw new BadRequestException(`File not found: ${fileId}`);
      }

      // Generate output filename
      const outputFileName = outputName || `converted-${uuidv4()}.pptx`;

      //call python service
      const response = await axios.post(
        `${this.pythonServiceUrl}/convert/pdf-to-powerpoint`,
        {
          fileId: fileId,
          outputFileName,
        },
        {
          timeout: 30000,
        },
      );

      // Clean up original file (optional)
      this.scheduleCleanup([fileId], outputFileName);

      return response.data;
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(
          `Failed to convert PDF to PowerPoint: ${error.message}`,
        );
      }
      throw new BadRequestException(
        'Failed to convert PDF to PowerPoint: Unknown error',
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

        // Clean up converted file after 2 hours
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
}
