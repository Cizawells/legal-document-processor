import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FileRecord } from '@prisma/client';

export interface TrackFileRequest {
  fileId: string;
  folder: 'uploads' | 'temp';
  userId?: string;
  guestSessionId?: string;
  fileSize: number;
  originalName: string;
  mimeType: string;
  service: string; // 'merge', 'redaction', 'conversion', 'compression', etc.
}

@Injectable()
export class FileTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Track a new file in the system
   */
  async trackFile(request: TrackFileRequest): Promise<FileRecord> {
    const userType = await this.determineUserType(
      request.userId,
      request.guestSessionId,
    );
    const expiresAt = this.calculateExpiration(userType);

    console.log(
      `Tracking file: ${request.fileId} for ${userType} user, expires at: ${expiresAt}`,
    );

    return await this.prisma.fileRecord.create({
      data: {
        fileId: request.fileId,
        folder: request.folder,
        userId: request.userId,
        guestSessionId: request.guestSessionId,
        userType,
        fileSize: request.fileSize,
        originalName: request.originalName,
        mimeType: request.mimeType,
        service: request.service,
        expiresAt,
      },
    });
  }

  /**
   * Get files that are ready for cleanup (expired and not deleted)
   */
  async getExpiredFiles(): Promise<FileRecord[]> {
    const now = new Date();
    return await this.prisma.fileRecord.findMany({
      where: {
        expiresAt: {
          lte: now,
        },
        isDeleted: false,
      },
      orderBy: {
        expiresAt: 'asc',
      },
    });
  }

  /**
   * Mark a file as deleted
   */
  async markAsDeleted(fileId: string): Promise<void> {
    await this.prisma.fileRecord.update({
      where: { fileId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Get file record by fileId
   */
  async getFileRecord(fileId: string): Promise<FileRecord | null> {
    return await this.prisma.fileRecord.findUnique({
      where: { fileId },
    });
  }

  /**
   * Get files by user (for dashboard/analytics)
   */
  async getUserFiles(userId: string): Promise<FileRecord[]> {
    return await this.prisma.fileRecord.findMany({
      where: {
        userId,
        isDeleted: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get files by guest session
   */
  async getGuestFiles(guestSessionId: string): Promise<FileRecord[]> {
    return await this.prisma.fileRecord.findMany({
      where: {
        guestSessionId,
        isDeleted: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Determine user type based on userId or guestSessionId
   */
  private async determineUserType(
    userId?: string,
    guestSessionId?: string,
  ): Promise<string> {
    if (guestSessionId) {
      return 'guest';
    }

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true },
      });

      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      return user.plan === 'free' ? 'free' : 'paid';
    }

    throw new Error('Either userId or guestSessionId must be provided');
  }

  /**
   * Calculate file expiration based on user type
   */
  private calculateExpiration(userType: string): Date {
    const now = new Date();

    switch (userType) {
      case 'guest':
        // Guest users: 5 minutes (FOR TESTING)
        return new Date(now.getTime() + 5 * 60 * 1000);

      case 'free':
        // Free users: 10 minutes (FOR TESTING)
        return new Date(now.getTime() + 10 * 60 * 1000);

      case 'paid':
        // Paid users: 15 minutes (FOR TESTING)
        return new Date(now.getTime() + 15 * 60 * 1000);

      default:
        // Default to guest policy for safety
        return new Date(now.getTime() + 5 * 60 * 1000);
    }
  }

  /**
   * Update file expiration (useful for extending retention)
   */
  async updateExpiration(
    fileId: string,
    newExpirationDate: Date,
  ): Promise<void> {
    await this.prisma.fileRecord.update({
      where: { fileId },
      data: { expiresAt: newExpirationDate },
    });
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats(): Promise<{
    totalFiles: number;
    expiredFiles: number;
    deletedFiles: number;
    filesByUserType: Record<string, number>;
    filesByService: Record<string, number>;
  }> {
    const [
      totalFiles,
      expiredFiles,
      deletedFiles,
      filesByUserType,
      filesByService,
    ] = await Promise.all([
      this.prisma.fileRecord.count(),
      this.prisma.fileRecord.count({
        where: {
          expiresAt: { lte: new Date() },
          isDeleted: false,
        },
      }),
      this.prisma.fileRecord.count({
        where: { isDeleted: true },
      }),
      this.prisma.fileRecord.groupBy({
        by: ['userType'],
        _count: { id: true },
        where: { isDeleted: false },
      }),
      this.prisma.fileRecord.groupBy({
        by: ['service'],
        _count: { id: true },
        where: { isDeleted: false },
      }),
    ]);

    return {
      totalFiles,
      expiredFiles,
      deletedFiles,
      filesByUserType: Object.fromEntries(
        filesByUserType.map((item) => [item.userType, item._count.id]),
      ),
      filesByService: Object.fromEntries(
        filesByService.map((item) => [item.service, item._count.id]),
      ),
    };
  }
}
