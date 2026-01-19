// src/merge/merge.module.ts
import { Module } from '@nestjs/common';
import { MergeController } from './merge.controller';
import { MergeService } from './merge.service';
import { StorageModule } from '../storage/storage.module';
import { GuestSessionModule } from '../guest-session/guest-session.module';
import { ActivityModule } from '../activity/activity.module';
import { FileTrackingModule } from '../file-tracking/file-tracking.module';

@Module({
  imports: [StorageModule, GuestSessionModule, ActivityModule, FileTrackingModule],
  controllers: [MergeController],
  providers: [MergeService],
})
export class MergeModule {}
