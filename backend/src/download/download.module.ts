import { Module } from '@nestjs/common';
import { DownloadController } from './download.controller';
import { DownloadService } from './download.service';
import { StorageService } from '../storage/storage.service';

@Module({
  controllers: [DownloadController],
  providers: [DownloadService, StorageService],
  exports: [DownloadService],
})
export class DownloadModule {}
