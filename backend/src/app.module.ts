// src/app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadModule } from './upload/upload.module';
import { MergeModule } from './merge/merge.module';
import { PdfToWordModule } from './pdf_to_word/pdf-to-word.module';
import { DownloadModule } from './download/download.module';
import { SplitModule } from './split/split.module';
import { PdfToPowerpointModule } from './pdf_to_powerpoint/pdf-to-powerpoint.module';
import { AuthModule } from './auth/auth.module';
import { RedactionModule } from './redaction/redaction.module';
import { CompressionModule } from './compression/compression.module';
import { StorageModule } from './storage/storage.module';
import { LemonSqueezyModule } from './stripe/stripe.module';
import { ActivityModule } from './activity/activity.module';
import { GuestSessionModule } from './guest-session/guest-session.module';
import { GuestSessionMiddleware } from './guest-session/guest-session.middleware';
import { FileTrackingModule } from './file-tracking/file-tracking.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    StorageModule,
    UploadModule,
    MergeModule,
    PdfToWordModule,
    DownloadModule,
    SplitModule,
    PdfToPowerpointModule,
    AuthModule,
    RedactionModule,
    CompressionModule,
    LemonSqueezyModule,
    ActivityModule,
    GuestSessionModule,
    FileTrackingModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(GuestSessionMiddleware).forRoutes('*'); // Apply to all routes
  }
}
