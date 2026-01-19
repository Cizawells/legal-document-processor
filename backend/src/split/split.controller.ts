// src/split/split.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import {
  ExtractPagesRequest,
  SplitByBookmarkRequest,
  SplitByPatternRequest,
  SplitByRangeRequest,
  SplitBySizeRequest,
  SplitByTextPatternRequest,
} from './dto';
import { SplitService } from './split.service';

@Controller('split')
export class SplitController {
  constructor(private readonly splitService: SplitService) {}

  @Post('pattern')
  async splitByPattern(
    @Body() request: SplitByPatternRequest,
    @Req() req: any,
    @Query('createZip') createZip?: string,
  ) {
    // Get guest session ID from request (set by middleware)
    const guestSessionId = req.guestSession?.id;

    // Check if user is authenticated (from headers or JWT)
    let userId: string | undefined;

    // Check for user ID in headers (OAuth users)
    const userIdFromHeader = req.headers['x-user-id'];
    const userEmailFromHeader = req.headers['x-user-email'];

    if (userIdFromHeader && userEmailFromHeader) {
      userId = userIdFromHeader;
    }

    const shouldCreateZip = true;
    const result = await this.splitService.splitByPattern(
      request,
      shouldCreateZip,
      guestSessionId,
      userId,
    );
    return {
      success: true,
      files: result.files,
      downloadUrls: result.files.map(
        (fileName) => `/split/download/${fileName}`,
      ),
      zipFile: result.zipFile
        ? {
            name: result.zipFile,
            downloadUrl: `/split/download/${result.zipFile}`,
          }
        : null,
      message: `PDF split successfully into ${result.files.length} files`,
    };

    // return {
    //   message: 'PDF split by pattern successfully',
    //   files: fileNames.files,
    //   downloadUrls: fileNames.files.map(
    //     (fileName) => `/split/download/${fileName}`,
    //   ),
    // };
  }

  @Post('range')
  async splitByRange(@Body() request: SplitByRangeRequest, @Req() req: any) {
    // Get guest session ID from request (set by middleware)
    const guestSessionId = req.guestSession?.id;

    // Check if user is authenticated (from headers or JWT)
    let userId: string | undefined;

    // Check for user ID in headers (OAuth users)
    const userIdFromHeader = req.headers['x-user-id'];
    const userEmailFromHeader = req.headers['x-user-email'];

    if (userIdFromHeader && userEmailFromHeader) {
      userId = userIdFromHeader;
    }

    const result = await this.splitService.splitByRange(
      request,
      guestSessionId,
      userId,
    );
    return {
      success: true,
      files: result.files,
      downloadUrls: result.files.map(
        (fileName) => `/split/download/${fileName}`,
      ),
      message: `PDF split successfully into ${result.files.length} files`,
    };
  }

  @Post('text-pattern')
  async splitByTextPattern(@Body() request: SplitByTextPatternRequest) {
    console.log('Splitting PDF by text pattern:', request);
    const fileNames = await this.splitService.splitByTextPattern(request);

    return {
      message: 'PDF split by text pattern successfully',
      files: fileNames,
      downloadUrls: fileNames.map((fileName) => `/split/download/${fileName}`),
    };
  }

  @Post('extract')
  async extractPages(@Body() request: ExtractPagesRequest, @Req() req: any) {
    // Get guest session ID from request (set by middleware)
    const guestSessionId = req.guestSession?.id;

    // Check if user is authenticated (from headers or JWT)
    let userId: string | undefined;

    // Check for user ID in headers (OAuth users)
    const userIdFromHeader = req.headers['x-user-id'];
    const userEmailFromHeader = req.headers['x-user-email'];

    if (userIdFromHeader && userEmailFromHeader) {
      userId = userIdFromHeader;
    }

    // For now, we'll use the pattern method to handle extraction
    // Convert extract request to pattern request format
    const patternRequest: SplitByPatternRequest = {
      fileId: request.fileId,
      splitByPattern: "1", // Extract as individual pages
      outputName: request.outputName,
      options: {
        pages: [],
      },
    };

    const result = await this.splitService.splitByPattern(
      patternRequest,
      false, // Don't create zip for extraction
      guestSessionId,
      userId,
    );

    return {
      success: true,
      files: result.files,
      downloadUrls: result.files.map(
        (fileName) => `/split/download/${fileName}`,
      ),
      message: `Pages extracted successfully`,
    };
  }

  @Post('size')
  async splitBySize(@Body() request: SplitBySizeRequest, @Req() req: any) {
    // Get guest session ID from request (set by middleware)
    const guestSessionId = req.guestSession?.id;

    // Check if user is authenticated (from headers or JWT)
    let userId: string | undefined;

    // Check for user ID in headers (OAuth users)
    const userIdFromHeader = req.headers['x-user-id'];
    const userEmailFromHeader = req.headers['x-user-email'];

    if (userIdFromHeader && userEmailFromHeader) {
      userId = userIdFromHeader;
    }

    // For now, we'll use the pattern method as a placeholder
    // TODO: Implement actual size-based splitting logic
    const patternRequest: SplitByPatternRequest = {
      fileId: request.fileId,
      splitByPattern: "1", // Split into individual pages as fallback
      outputName: request.outputName,
      options: {
        pages: [],
      },
    };

    const result = await this.splitService.splitByPattern(
      patternRequest,
      true, // Create zip
      guestSessionId,
      userId,
    );

    return {
      success: true,
      files: result.files,
      downloadUrls: result.files.map(
        (fileName) => `/split/download/${fileName}`,
      ),
      zipFile: result.zipFile
        ? {
            name: result.zipFile,
            downloadUrl: `/split/download/${result.zipFile}`,
          }
        : null,
      message: `PDF split by size successfully into ${result.files.length} files`,
    };
  }

  @Get('download/:fileName')
  downloadSplitPDF(@Param('fileName') fileName: string, @Res() res: Response) {
    const filePath = path.join(process.cwd(), 'temp', fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Set headers for file download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Send file
    res.sendFile(filePath);
  }

  // TODO: Implement file info endpoint
  // @Get('info/:fileName')
  // getFileInfo(@Param('fileName') fileName: string) {
  //   return this.splitService.getFileInfo(fileName);
  // }
}
