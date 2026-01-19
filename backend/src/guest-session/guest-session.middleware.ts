import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { GuestSessionService, GuestSession } from './guest-session.service';

// Extend Express Request interface to include guestSession
declare global {
  namespace Express {
    interface Request {
      guestSession?: GuestSession;
    }
  }
}

@Injectable()
export class GuestSessionMiddleware implements NestMiddleware {
  constructor(private guestSessionService: GuestSessionService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Check if user is authenticated (skip guest session for authenticated users)
      const userIdFromHeader = req.headers['x-user-id'];
      const userEmailFromHeader = req.headers['x-user-email'];
      const isAuthenticated = userIdFromHeader && userEmailFromHeader;
      console.log(
        'is Authenticatttttttttt',
        isAuthenticated,
        userIdFromHeader,
        userEmailFromHeader,
      );
      if (isAuthenticated) {
        console.log(
          `Authenticated user detected (${userIdFromHeader}), skipping guest session`,
        );
        // Clear guest session cookie for authenticated users
        res.clearCookie('guestSessionId');
        req.guestSession = undefined;
        next();
        return;
      }

      // Only create/manage guest sessions for non-authenticated users
      const sessionId = req.cookies?.guestSessionId;
      const ipAddress = this.getClientIpAddress(req);
      let session: GuestSession | null = null;

      if (sessionId) {
        // Try to load existing session by cookie ID
        session = await this.guestSessionService.getSession(sessionId);
        console.log(`Checked session by cookie ID ${sessionId}:`, session ? 'found' : 'not found');
      }

      if (!session) {
        // If no session found by cookie, check for existing session by IP address
        session = await this.guestSessionService.findActiveSessionByIp(ipAddress);
        console.log(`Checked session by IP ${ipAddress}:`, session ? `found ${session.id}` : 'not found');
        
        if (session) {
          // Update cookie with the existing session ID
          res.cookie('guestSessionId', session.id, {
            maxAge: 60 * 60 * 1000, // 1 hour
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
          });
          console.log(`Reusing existing session ${session.id} for IP: ${ipAddress}`);
        }
      }

      if (!session) {
        // Create new session only if no existing session found for this IP
        session = await this.guestSessionService.createSession(ipAddress);
        console.log('Created new guest session:', session.id);
        // Set cookie with new session ID
        res.cookie('guestSessionId', session.id, {
          maxAge: 60 * 60 * 1000, // 1 hour
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        });

        console.log(
          `Created new guest session: ${session.id} for IP: ${ipAddress}`,
        );
      } else {
        // Update last activity for existing session
        await this.guestSessionService.updateLastActivity(session.id);
        console.log(`Updated guest session activity: ${session.id}`);
      }

      // Attach session to request object
      req.guestSession = session;
      next();
    } catch (error) {
      console.error('Error in guest session middleware:', error);
      // Continue without session if there's an error
      next();
    }
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
