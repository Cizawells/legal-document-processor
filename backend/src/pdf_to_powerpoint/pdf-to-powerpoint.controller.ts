// src/pdf_to_powerpoint/pdf-to-powerpoint.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import * as path from 'path';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  ConvertRequest,
  PdfToPowerpointService,
} from './pdf-to-powerpoint.service';

@Controller('pdf-to-powerpoint')
export class PdfToPowerpointController {
  constructor(
    private readonly pdfToPowerpointService: PdfToPowerpointService,
  ) {}

  @Post()
  async convertPdfToPowerpoint(@Body() convertRequest: ConvertRequest) {
    console.log('Converting PDF to PowerPoint', convertRequest);
    const {
      fileName,
      ...response
    }: {
      status: string;
      fileName: string;
      pageCount: number | string;
      timestamp: Date;
    } =
      await this.pdfToPowerpointService.convertPdfToPowerpoint(convertRequest);
    console.log('resulttt  controller', { fileName, ...response });
    return {
      message: 'PDF converted to PowerPoint successfully',
      fileName,
      downloadUrl: `/pdf-to-powerpoint/download/${fileName}`,
    };
  }

  @Get('download/:fileName')
  downloadConvertedFile(
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    const filePath = path.join(process.cwd(), 'temp', fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Set headers for file download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Send file
    res.sendFile(filePath);
  }

  @Get('info/:fileName')
  getFileInfo(@Param('fileName') fileName: string) {
    return this.pdfToPowerpointService.getFileInfo(fileName);
  }

  // Alternative: Single-step upload and convert
  @Post('upload-convert')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new BadRequestException('Only PDF files allowed'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  )
  async uploadAndConvert(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    console.log('Upload and converting PDF to PowerPoint', file.filename);

    const result = await this.pdfToPowerpointService.convertPdfToPowerpoint({
      fileId: file.filename,
    });

    return {
      message: 'PDF uploaded and converted to PowerPoint successfully',
      originalName: file.originalname,
      fileName: result.fileName,
      downloadUrl: `/pdf-to-powerpoint/download/${result.fileName}`,
    };
  }
}
