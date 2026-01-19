import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { ActivityService } from '../activity/activity.service';
import axios from 'axios';
import * as FormData from 'form-data';

interface RedactionArea {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  type: 'text' | 'image' | 'custom';
  reason?: string;
  verified: boolean;
  category?: string;
  confidence?: number;
}

interface RedactionSettings {
  complianceMode: string;
  redactionColor: string;
  preserveFormatting: boolean;
  addWatermark: boolean;
  removeMetadata: boolean;
}

interface RedactionRequest {
  fileId: string;
  outputName?: string;
  areas: RedactionArea[];
  settings: RedactionSettings;
}

interface PIIDetectionRequest {
  fileId: string;
  categories: string[];
  confidenceThreshold: number;
}

interface PIIDetectionResponse {
  findings: Array<{
    id: string;
    category: string;
    name: string;
    text: string;
    confidence: number;
    page: number;
    bbox: [number, number, number, number];
  }>;
  statistics: {
    total: number;
    by_category: Record<string, number>;
    by_confidence: Record<string, number>;
  };
}

@Injectable()
export class RedactionService {
  private readonly logger = new Logger(RedactionService.name);
  private readonly pythonServiceUrl: string;

  constructor(
    private readonly storageService: StorageService,
    private readonly activityService: ActivityService,
  ) {
    this.pythonServiceUrl =
      process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';
  }

  async processRedaction(
    request: RedactionRequest,
    userId?: string,
    fileName?: string,
    fileSize?: string,
  ): Promise<{
    status: string;
    fileName: string;
    pageCount?: number | string;
    timestamp: Date;
  }> {
    const { fileId, outputName } = request;

    if (!fileId) {
      throw new BadRequestException('File ID is required for redaction');
    }

    if (!request.areas || request.areas.length === 0) {
      throw new BadRequestException('No redaction areas provided');
    }

    const startTime = Date.now();
    this.logger.log(`Starting redaction process for file: ${fileId}`);

    // Track activity start if userId is provided
    let activityId: string | undefined;
    if (userId && fileName) {
      try {
        const activity = await this.activityService.trackRedactionStart(
          userId,
          fileName,
          fileId,
          fileSize || 'Unknown',
        );
        activityId = activity.id;
      } catch (error) {
        this.logger.warn('Failed to track activity start:', error);
      }
    }

    try {
      // Verify file exists in storage (this will work for both S3 and local)
      try {
        await this.storageService.getFile(fileId, 'uploads');
      } catch (error) {
        throw new BadRequestException(`File not found: ${fileId}`);
      }

      // Generate output filename
      const outputFileName = `redacted-${Date.now()}.pdf`;

      // Convert areas to Python service format
      // Note: Python service expects 1-based page indexing and will convert internally
      const pythonAreas = request.areas.map((area) => ({
        page: area.page, // Keep 1-based, Python will convert to 0-based internally
        x: area.x,
        y: area.y,
        width: area.width,
        height: area.height,
      }));

      // Call python service
      const response = await axios.post(
        `${this.pythonServiceUrl}/redact`,
        {
          fileId: fileId,
          outputName: outputFileName,
          areas: pythonAreas, // Changed from 'redactions' to 'areas'
          settings: request.settings,
        },
        {
          timeout: 120000, // 2 minute timeout
        },
      );

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `Redaction completed successfully in ${processingTime}ms`,
      );

      // Track activity completion if tracking was started
      if (activityId && userId) {
        try {
          await this.activityService.trackRedactionComplete(
            activityId,
            userId,
            request.areas.length,
            processingTime,
          );
        } catch (error) {
          this.logger.warn('Failed to track activity completion:', error);
        }
      }

      return response.data;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      // Track error if activity was started
      if (activityId && userId) {
        try {
          await this.activityService.trackRedactionError(
            activityId,
            userId,
            error.message,
          );
        } catch (trackingError) {
          this.logger.warn('Failed to track activity error:', trackingError);
        }
      }

      this.logger.error(`Redaction failed after ${processingTime}ms`, {
        error: error.message,
        fileId: fileId,
        stack: error.stack,
      });

      if (error instanceof Error) {
        throw new BadRequestException(`Failed to redact PDF: ${error.message}`);
      }
      throw new BadRequestException('Failed to redact PDF: Unknown error');
    }
  }

  async detectPII(request: PIIDetectionRequest): Promise<PIIDetectionResponse> {
    this.logger.log(`Starting PII detection for file: ${request.fileId}`);

    try {
      // Call Python PII detection service with JSON payload
      const response = await axios.post(
        `${this.pythonServiceUrl}/detect-pii`,
        {
          fileId: request.fileId,
          categories: request.categories,
          confidenceThreshold: request.confidenceThreshold,
        },
        {
          timeout: 60000, // 60 second timeout
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error('PII detection failed', {
        error: error.message,
        fileId: request.fileId,
        response: error.response?.data,
        status: error.response?.status,
        url: `${this.pythonServiceUrl}/detect-pii`,
        stack: error.stack,
      });

      if (error.code === 'ECONNREFUSED') {
        throw new HttpException(
          'PII detection service is not running',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      if (error.response?.status === 404) {
        throw new HttpException(
          'PII detection service not available',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      if (error.response?.status >= 400 && error.response?.status < 500) {
        const errorMessage =
          error.response?.data?.detail ||
          error.response?.data?.message ||
          'Bad request to PII service';
        throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
      }

      throw new HttpException(
        `PII detection failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
