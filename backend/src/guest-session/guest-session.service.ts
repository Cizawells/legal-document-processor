import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

export interface GuestSession {
  id: string;
  ipAddress: string;
  createdAt: Date;
  expiresAt: Date;
  redactionCount: number;
  mergeCount: number;
  conversionCount: number;
  splitCount: number;
  compressionCount: number;
  lastActivity: Date;
}

@Injectable()
export class GuestSessionService {
  constructor(private prisma: PrismaService) {}

  async createSession(ipAddress: string): Promise<GuestSession> {
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

    const session = await this.prisma.guestSession.create({
      data: {
        id: sessionId,
        ipAddress,
        expiresAt,
        redactionCount: 0,
        mergeCount: 0,
        conversionCount: 0,
        splitCount: 0,
        compressionCount: 0,
        lastActivity: now,
      },
    });

    return session;
  }

  async getSession(sessionId: string): Promise<GuestSession | null> {
    const session = await this.prisma.guestSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      // Delete expired session
      await this.prisma.guestSession.delete({
        where: { id: sessionId },
      });
      return null;
    }

    return session;
  }

  async findActiveSessionByIp(ipAddress: string): Promise<GuestSession | null> {
    const session = await this.prisma.guestSession.findFirst({
      where: {
        ipAddress,
        expiresAt: {
          gt: new Date(), // Only get non-expired sessions
        },
      },
      orderBy: {
        lastActivity: 'desc', // Get the most recently active session
      },
    });

    return session;
  }

  async updateLastActivity(sessionId: string): Promise<void> {
    await this.prisma.guestSession.update({
      where: { id: sessionId },
      data: { lastActivity: new Date() },
    });
  }

  async incrementMergeCount(sessionId: string): Promise<GuestSession> {
    return await this.prisma.guestSession.update({
      where: { id: sessionId },
      data: {
        mergeCount: { increment: 1 },
        lastActivity: new Date(),
      },
    });
  }

  async incrementRedactionCount(sessionId: string): Promise<GuestSession> {
    return await this.prisma.guestSession.update({
      where: { id: sessionId },
      data: {
        redactionCount: { increment: 1 },
        lastActivity: new Date(),
      },
    });
  }

  async canPerformMerge(
    sessionId: string,
  ): Promise<{ allowed: boolean; currentCount: number; maxCount: number }> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return { allowed: false, currentCount: 0, maxCount: 3 };
    }

    const maxMerges = 3;
    const allowed = session.mergeCount < maxMerges;

    return {
      allowed,
      currentCount: session.mergeCount,
      maxCount: maxMerges,
    };
  }

  async canPerformRedaction(
    sessionId: string,
  ): Promise<{ allowed: boolean; currentCount: number; maxCount: number }> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return { allowed: false, currentCount: 0, maxCount: 3 };
    }

    const maxRedactions = 3;
    const allowed = session.redactionCount < maxRedactions;

    return {
      allowed,
      currentCount: session.redactionCount,
      maxCount: maxRedactions,
    };
  }

  async incrementConversionCount(sessionId: string): Promise<GuestSession> {
    return await this.prisma.guestSession.update({
      where: { id: sessionId },
      data: {
        conversionCount: { increment: 1 },
        lastActivity: new Date(),
      },
    });
  }

  async canPerformConversion(
    sessionId: string,
  ): Promise<{ allowed: boolean; currentCount: number; maxCount: number }> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return { allowed: false, currentCount: 0, maxCount: 3 };
    }

    const maxConversions = 3;
    const allowed = session.conversionCount < maxConversions;

    return {
      allowed,
      currentCount: session.conversionCount,
      maxCount: maxConversions,
    };
  }

  async incrementSplitCount(sessionId: string): Promise<GuestSession> {
    return await this.prisma.guestSession.update({
      where: { id: sessionId },
      data: {
        splitCount: { increment: 1 },
        lastActivity: new Date(),
      },
    });
  }

  async canPerformSplit(
    sessionId: string,
  ): Promise<{ allowed: boolean; currentCount: number; maxCount: number }> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return { allowed: false, currentCount: 0, maxCount: 3 };
    }

    const maxSplits = 3;
    const allowed = session.splitCount < maxSplits;

    return {
      allowed,
      currentCount: session.splitCount,
      maxCount: maxSplits,
    };
  }

  async incrementCompressionCount(sessionId: string): Promise<GuestSession> {
    return await this.prisma.guestSession.update({
      where: { id: sessionId },
      data: {
        compressionCount: { increment: 1 },
        lastActivity: new Date(),
      },
    });
  }

  async canPerformCompression(
    sessionId: string,
  ): Promise<{ allowed: boolean; currentCount: number; maxCount: number }> {
    const session = await this.getSession(sessionId);

    if (!session) {
      return { allowed: false, currentCount: 0, maxCount: 3 };
    }

    const maxCompressions = 3;
    const allowed = session.compressionCount < maxCompressions;

    return {
      allowed,
      currentCount: session.compressionCount,
      maxCount: maxCompressions,
    };
  }

  // Cleanup expired sessions (can be called by a cron job)
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.guestSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }
}
