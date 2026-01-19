// src/split/split.module.ts
import { Module } from '@nestjs/common';
import { SplitController } from './split.controller';
import { SplitService } from './split.service';
import { GuestSessionModule } from '../guest-session/guest-session.module';
import { ActivityModule } from '../activity/activity.module';
import { FileTrackingModule } from '../file-tracking/file-tracking.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    GuestSessionModule,
    ActivityModule,
    FileTrackingModule,
    StorageModule,
  ],
  controllers: [SplitController],
  providers: [SplitService],
  exports: [SplitService],
})
export class SplitModule {}
