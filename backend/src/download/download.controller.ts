import {
  Controller,
  Get,
  Param,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { DownloadService } from './download.service';

@Controller('download')
export class DownloadController {
  constructor(private readonly downloadService: DownloadService) {}

  @Get(':fileName')
  async downloadFile(
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.downloadService.downloadFile(fileName, res, 'temp');
  }

  @Get(':folder/:fileName')
  async downloadFileFromFolder(
    @Param('folder') folder: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ): Promise<void> {
    // Validate folder parameter
    if (folder !== 'uploads' && folder !== 'temp') {
      res
        .status(400)
        .json({ message: 'Invalid folder. Must be "uploads" or "temp"' });
      return;
    }
    await this.downloadService.downloadFile(
      fileName,
      res,
      folder as 'uploads' | 'temp',
    );
  }

  @Get('info/:fileName')
  async getFileInfo(@Param('fileName') fileName: string) {
    return await this.downloadService.getFileInfo(fileName, 'temp');
  }

  @Get('info/:folder/:fileName')
  async getFileInfoFromFolder(
    @Param('folder') folder: string,
    @Param('fileName') fileName: string,
  ) {
    // Validate folder parameter
    if (folder !== 'uploads' && folder !== 'temp') {
      throw new BadRequestException(
        'Invalid folder. Must be "uploads" or "temp"',
      );
    }
    return await this.downloadService.getFileInfo(
      fileName,
      folder as 'uploads' | 'temp',
    );
  }
}
