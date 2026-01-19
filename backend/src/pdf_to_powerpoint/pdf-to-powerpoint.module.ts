// src/pdf_to_word/pdf-to-word.module.ts
import { Module } from '@nestjs/common';
import { PdfToPowerpointController } from './pdf-to-powerpoint.controller';
import { PdfToPowerpointService } from './pdf-to-powerpoint.service';

@Module({
  controllers: [PdfToPowerpointController],
  providers: [PdfToPowerpointService],
})
export class PdfToPowerpointModule {}
