import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { GetActivitiesDto } from './dto/get-activities.dto';

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private prisma: PrismaService) {}

  async create(createActivityDto: CreateActivityDto) {
    try {
      const activity = await this.prisma.activity.create({
        data: createActivityDto,
      });
      
      this.logger.log(`Created activity: ${activity.type} - ${activity.action} for user ${activity.userId}`);
      return activity;
    } catch (error) {
      this.logger.error('Failed to create activity:', error);
      throw error;
    }
  }

  async findAll(userId: string, query: GetActivitiesDto) {
    try {
      const { type, status, limit = 20, offset = 0 } = query;

      const where: any = { userId };
      if (type) where.type = type;
      if (status) where.status = status;

      const [activities, total] = await Promise.all([
        this.prisma.activity.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.activity.count({ where }),
      ]);

      return {
        activities,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      };
    } catch (error) {
      this.logger.error('Failed to fetch activities:', error);
      throw error;
    }
  }

  async findOne(id: string, userId: string) {
    try {
      return await this.prisma.activity.findFirst({
        where: { id, userId },
      });
    } catch (error) {
      this.logger.error('Failed to fetch activity:', error);
      throw error;
    }
  }

  async update(id: string, userId: string, updateActivityDto: UpdateActivityDto) {
    try {
      const activity = await this.prisma.activity.updateMany({
        where: { id, userId },
        data: {
          ...updateActivityDto,
          updatedAt: new Date(),
        },
      });

      if (activity.count === 0) {
        throw new Error('Activity not found or not authorized');
      }

      this.logger.log(`Updated activity: ${id}`);
      return await this.findOne(id, userId);
    } catch (error) {
      this.logger.error('Failed to update activity:', error);
      throw error;
    }
  }

  async remove(id: string, userId: string) {
    try {
      const activity = await this.prisma.activity.deleteMany({
        where: { id, userId },
      });

      if (activity.count === 0) {
        throw new Error('Activity not found or not authorized');
      }

      this.logger.log(`Deleted activity: ${id}`);
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to delete activity:', error);
      throw error;
    }
  }

  // Helper methods for common activity tracking
  async trackRedactionStart(userId: string, fileName: string, fileId: string, fileSize: string) {
    return this.create({
      userId,
      type: 'redaction',
      action: 'created',
      fileName,
      fileId,
      fileSize,
      status: 'pending',
    });
  }

  async trackRedactionComplete(activityId: string, userId: string, redactionCount: number, duration: number) {
    return this.update(activityId, userId, {
      action: 'completed',
      status: 'completed',
      duration,
      metadata: { redactionCount },
    });
  }

  async trackRedactionError(activityId: string, userId: string, errorMessage: string) {
    return this.update(activityId, userId, {
      action: 'failed',
      status: 'failed',
      errorMessage,
    });
  }

  async trackFileDownload(userId: string, fileName: string, fileId: string, type: string) {
    return this.create({
      userId,
      type,
      action: 'downloaded',
      fileName,
      fileId,
      status: 'completed',
    });
  }

  // Get recent documents for dashboard
  async getRecentDocuments(userId: string, limit: number = 10) {
    try {
      const activities = await this.prisma.activity.findMany({
        where: {
          userId,
          action: { in: ['completed', 'downloaded'] },
          status: 'completed',
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        distinct: ['fileName'],
      });

      return activities.map(activity => ({
        id: activity.id,
        name: activity.fileName,
        size: activity.fileSize || 'Unknown',
        type: activity.type,
        lastModified: activity.updatedAt.getTime(),
        timestamp: activity.createdAt.getTime(),
        redactionCount: (activity.metadata as any)?.redactionCount || 0,
        fileId: activity.fileId,
      }));
    } catch (error) {
      this.logger.error('Failed to fetch recent documents:', error);
      throw error;
    }
  }

  // Get activity statistics for dashboard
  async getActivityStats(userId: string) {
    try {
      const [
        totalDocuments,
        thisMonthActivities,
        completedActivities,
        redactionActivities,
      ] = await Promise.all([
        this.prisma.activity.count({
          where: {
            userId,
            action: 'completed',
            status: 'completed',
          },
        }),
        this.prisma.activity.count({
          where: {
            userId,
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        }),
        this.prisma.activity.aggregate({
          where: {
            userId,
            status: 'completed',
            duration: { not: null },
          },
          _avg: {
            duration: true,
          },
        }),
        // Get redaction activities to manually sum redaction counts
        this.prisma.activity.findMany({
          where: {
            userId,
            type: 'redaction',
            action: 'completed',
            status: 'completed',
          },
          select: {
            metadata: true,
          },
        }),
      ]);

      // Manually calculate total redactions from metadata
      const totalRedactions = redactionActivities.reduce((sum, activity) => {
        const redactionCount = (activity.metadata as any)?.redactionCount || 0;
        return sum + redactionCount;
      }, 0);

      return {
        documentsProcessed: totalDocuments,
        pagesRedacted: totalRedactions,
        thisMonth: thisMonthActivities,
        avgProcessingTime: Math.round((completedActivities._avg?.duration || 0) / 1000), // Convert to seconds
      };
    } catch (error) {
      this.logger.error('Failed to fetch activity stats:', error);
      throw error;
    }
  }
}
