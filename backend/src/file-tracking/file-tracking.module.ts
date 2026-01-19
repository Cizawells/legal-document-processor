import { Module } from '@nestjs/common';
import { FileTrackingService } from './file-tracking.service';
import { CleanupService } from './cleanup.service';
import { FileTrackingController } from './file-tracking.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [FileTrackingController],
  providers: [FileTrackingService, CleanupService],
  exports: [FileTrackingService, CleanupService],
})
export class FileTrackingModule {}
