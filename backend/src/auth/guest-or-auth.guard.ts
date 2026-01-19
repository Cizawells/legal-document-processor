import {
  Injectable,
  ExecutionContext,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GuestOrAuthGuard {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Try JWT token first
    const token = this.extractTokenFromHeader(request);
    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync(token, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });
        console.log('JWT auth successful:', payload);
        request.user = payload;
        return true;
      } catch (error) {
        console.log('JWT auth failed:', error.message);
        // JWT failed, try user ID headers
      }
    }

    // Fallback to user ID headers (for OAuth users)
    const userId = request.headers['x-user-id'];
    const userEmail = request.headers['x-user-email'];

    if (userId && userEmail) {
      try {
        // Verify user exists in database
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });

        if (user && user.email === userEmail) {
          console.log('User ID auth successful');
          request.user = { id: user.id, email: user.email };
          return true;
        }
      } catch (error) {
        console.log('Database lookup error:', error.message);
        // Database lookup failed
      }
    }

    // If no authentication found, allow as guest user
    console.log('No authentication found - allowing as guest user');
    request.user = null; // Explicitly set to null for guest users
    request.isGuest = true; // Flag to identify guest users
    return true;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
