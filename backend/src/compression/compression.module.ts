// src/compression/compression.module.ts
import { Module } from '@nestjs/common';
import { CompressionController } from './compression.controller';
import { CompressionService } from './compression.service';
import { StorageModule } from '../storage/storage.module';
import { GuestSessionModule } from '../guest-session/guest-session.module';
import { ActivityModule } from '../activity/activity.module';
import { FileTrackingModule } from '../file-tracking/file-tracking.module';

@Module({
  imports: [StorageModule, GuestSessionModule, ActivityModule, FileTrackingModule],
  controllers: [CompressionController],
  providers: [CompressionService],
  exports: [CompressionService],
})
export class CompressionModule {}
