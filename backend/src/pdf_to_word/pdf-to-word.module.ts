// src/pdf_to_word/pdf-to-word.module.ts
import { Module } from '@nestjs/common';
import { PdfToWordController } from './pdf-to-word.controller';
import { PdfToWordService } from './pdf-to-word.service';
import { StorageModule } from '../storage/storage.module';
import { GuestSessionModule } from '../guest-session/guest-session.module';
import { ActivityModule } from '../activity/activity.module';
import { FileTrackingModule } from '../file-tracking/file-tracking.module';

@Module({
  imports: [
    StorageModule,
    GuestSessionModule,
    ActivityModule,
    FileTrackingModule,
  ],
  controllers: [PdfToWordController],
  providers: [PdfToWordService],
})
export class PdfToWordModule {}
