import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FileTrackingService } from './file-tracking.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private readonly fileTrackingService: FileTrackingService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Scheduled cleanup job - runs every 2 minutes (FOR TESTING)
   */
  @Cron('0 */2 * * * *')
  async performScheduledCleanup(): Promise<void> {
    this.logger.log('Starting scheduled file cleanup...');

    try {
      const result = await this.performCleanup();
      this.logger.log(
        `Cleanup completed: ${result.deletedCount} files deleted, ${result.errorCount} errors`,
      );
    } catch (error) {
      this.logger.error('Scheduled cleanup failed:', error);
    }
  }

  /**
   * Manual cleanup method (can be called via API)
   */
  async performCleanup(): Promise<{
    deletedCount: number;
    errorCount: number;
    errors: string[];
  }> {
    const expiredFiles = await this.fileTrackingService.getExpiredFiles();
    console.log(
      'epxireeeeeeeeeeeeeeeeed files',
      expiredFiles.length,
      expiredFiles,
    );
    if (expiredFiles.length === 0) {
      this.logger.log('No expired files found for cleanup');
      return { deletedCount: 0, errorCount: 0, errors: [] };
    }

    this.logger.log(`Found ${expiredFiles.length} expired files for cleanup`);

    let deletedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process files in batches to avoid overwhelming the storage service
    const batchSize = 10;
    for (let i = 0; i < expiredFiles.length; i += batchSize) {
      const batch = expiredFiles.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (file) => {
          try {
            // Delete from storage (S3/R2 or local)
            await this.storageService.deleteFile(
              file.fileId,
              file.folder as 'uploads' | 'temp',
            );

            // Mark as deleted in database
            await this.fileTrackingService.markAsDeleted(file.fileId);

            deletedCount++;
            this.logger.debug(
              `Deleted file: ${file.fileId} (${file.service}, ${file.userType})`,
            );
          } catch (error) {
            errorCount++;
            const errorMsg = `Failed to delete ${file.fileId}: ${error.message}`;
            errors.push(errorMsg);
            this.logger.warn(errorMsg);
          }
        }),
      );
    }

    return { deletedCount, errorCount, errors };
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats(): Promise<any> {
    return await this.fileTrackingService.getCleanupStats();
  }

  /**
   * Emergency cleanup for a specific user type (admin function)
   */
  async emergencyCleanup(userType: 'guest' | 'free' | 'paid'): Promise<{
    deletedCount: number;
    errorCount: number;
  }> {
    this.logger.warn(`Performing emergency cleanup for ${userType} users`);

    // This would require a custom query to get files by user type
    // Implementation depends on specific requirements

    return { deletedCount: 0, errorCount: 0 };
  }

  /**
   * Cleanup files older than specified days (admin function)
   */
  async cleanupOlderThan(days: number): Promise<{
    deletedCount: number;
    errorCount: number;
  }> {
    this.logger.warn(`Performing cleanup for files older than ${days} days`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // This would require a custom query
    // Implementation depends on specific requirements

    return { deletedCount: 0, errorCount: 0 };
  }
}
