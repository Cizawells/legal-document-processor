import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Logger,
  UseGuards,
  Request,
} from '@nestjs/common';
import { RedactionService } from './redaction.service';
import { FlexibleAuthGuard } from '../auth/flexible-auth.guard';
import { GuestOrAuthGuard } from '../auth/guest-or-auth.guard';

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

@Controller('redaction')
export class RedactionController {
  private readonly logger = new Logger(RedactionController.name);

  constructor(private readonly redactionService: RedactionService) {}

  @Post()
  @UseGuards(GuestOrAuthGuard)
  async redactPDF(@Body() redactionRequest: RedactionRequest, @Request() req) {
    this.logger.log('Received redaction request', {
      fileId: redactionRequest.fileId,
      areasCount: redactionRequest.areas?.length || 0,
      complianceMode: redactionRequest.settings?.complianceMode,
    });

    try {
      // Validate request
      if (!redactionRequest.fileId) {
        throw new HttpException('File ID is required', HttpStatus.BAD_REQUEST);
      }

      if (!redactionRequest.areas || redactionRequest.areas.length === 0) {
        throw new HttpException(
          'No redaction areas provided',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Guest user limitations
      if (req.isGuest) {
        // Limit to 3 redaction areas for guests
        if (redactionRequest.areas.length > 3) {
          throw new HttpException(
            'Guest users are limited to 3 redaction areas. Please sign up for unlimited access.',
            HttpStatus.FORBIDDEN,
          );
        }

        this.logger.log('Processing redaction for guest user', {
          fileId: redactionRequest.fileId,
          areasCount: redactionRequest.areas.length,
        });
      } else {
        this.logger.log('Processing redaction for authenticated user', {
          fileId: redactionRequest.fileId,
          userId: req.user?.id,
          areasCount: redactionRequest.areas.length,
        });
      }

      // Process redaction with user context for activity tracking
      const result = await this.redactionService.processRedaction(
        redactionRequest,
        req.user?.id,
        redactionRequest.outputName || `redacted-${Date.now()}.pdf`,
        'Unknown', // We don't have file size here, could be enhanced later
      );

      this.logger.log('Redaction completed successfully', {
        fileId: redactionRequest.fileId,
        outputFile: result.fileName,
      });

      return result;
    } catch (error) {
      this.logger.error('Redaction failed', {
        fileId: redactionRequest.fileId,
        error: error.message,
        stack: error.stack,
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error during redaction',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('detect-pii')
  @UseGuards(FlexibleAuthGuard)
  async detectPII(
    @Body() request: PIIDetectionRequest,
  ): Promise<PIIDetectionResponse> {
    this.logger.log('Received PII detection request', {
      fileId: request.fileId,
      categories: request.categories,
      threshold: request.confidenceThreshold,
    });

    try {
      // Validate request
      if (!request.fileId) {
        throw new HttpException('File ID is required', HttpStatus.BAD_REQUEST);
      }

      if (!request.categories || request.categories.length === 0) {
        throw new HttpException(
          'Categories are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Process PII detection
      const result = await this.redactionService.detectPII(request);

      this.logger.log('PII detection completed', {
        fileId: request.fileId,
        findingsCount: result.findings.length,
        categories: Object.keys(result.statistics.by_category),
      });

      return result;
    } catch (error) {
      this.logger.error('PII detection failed', {
        fileId: request.fileId,
        error: error.message,
        stack: error.stack,
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error during PII detection',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
