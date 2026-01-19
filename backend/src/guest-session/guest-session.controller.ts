import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { GuestSessionService } from './guest-session.service';

@Controller('guest-session')
export class GuestSessionController {
  constructor(private guestSessionService: GuestSessionService) {}

  @Get('info')
  async getSessionInfo(@Req() req: Request) {
    const session = req.guestSession;

    if (!session) {
      return { error: 'No guest session found' };
    }

    return session;
  }

  @Post('create')
  async createSession(@Req() req: Request, @Res() res: Response) {
    const ipAddress = this.getClientIpAddress(req);
    const session = await this.guestSessionService.createSession(ipAddress);

    // Set cookie with session ID
    res.cookie('guestSessionId', session.id, {
      maxAge: 60 * 60 * 1000, // 1 hour
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.json(session);
  }

  @Get('merge-limit')
  async checkMergeLimit(@Req() req: Request) {
    const sessionId = req.guestSession?.id;

    if (!sessionId) {
      // No session means no usage yet, allow first operations
      return {
        allowed: true,
        currentCount: 0,
        maxCount: 3,
      };
    }

    return await this.guestSessionService.canPerformMerge(sessionId);
  }

  @Get('redaction-limit')
  async checkRedactionLimit(@Req() req: Request) {
    const sessionId = req.guestSession?.id;

    if (!sessionId) {
      // No session means no usage yet, allow first operations
      return {
        allowed: true,
        currentCount: 0,
        maxCount: 3,
      };
    }

    return await this.guestSessionService.canPerformRedaction(sessionId);
  }

  private getClientIpAddress(req: Request): string {
    // Check various headers for the real IP address
    const forwarded = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    const cfConnectingIp = req.headers['cf-connecting-ip'];

    if (forwarded) {
      // x-forwarded-for can contain multiple IPs, take the first one
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return ips.split(',')[0].trim();
    }

    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    if (cfConnectingIp) {
      return Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp;
    }

    // Fallback to req.ip
    return req.ip || 'unknown';
  }
}
