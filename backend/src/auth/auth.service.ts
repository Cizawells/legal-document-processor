import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async register(name: string, email: string, password: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new BadRequestException('Email is already registered');
    }

    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
    const hash = await bcrypt.hash(password, saltRounds);

    const user = await this.usersService.create({
      name,
      email,
      password: hash,
    });

    // Send welcome email (async, don't wait for it to complete)
    console.log(`🔄 Attempting to send welcome email to: ${user.email}`);
    this.emailService
      .sendWelcomeEmail({
        name: user.name,
        email: user.email,
        loginUrl: `${process.env.FRONTEND_URL}/signin`,
      })
      .then(() => {
        console.log(`✅ Welcome email queued successfully for: ${user.email}`);
      })
      .catch((error) => {
        console.error('❌ Failed to send welcome email:', error);
        // Don't throw error - user registration should still succeed
      });

    // Never return password hash
    const { password: _, ...safe } = user as any;
    return safe;
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    // Do not reveal whether email exists for security, but still act safely
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { password: _, ...safe } = user as any;
    const payload = { sub: user.id, email: user.email };
    const access_token = await this.jwtService.signAsync(payload);
    return { user: safe, access_token };
  }

  async oauthLogin(email: string, name: string, provider: string) {
    // Check if user exists
    let user = await this.usersService.findByEmail(email);
    let isNewUser = false;

    // If user doesn't exist, create them with OAuth
    if (!user) {
      isNewUser = true;
      // For OAuth users, we don't have a password, so we generate a random one
      // They won't be able to use password login unless they set one later
      const randomPassword = Math.random().toString(36).slice(-16);
      const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
      const hash = await bcrypt.hash(randomPassword, saltRounds);

      user = await this.usersService.create({
        name,
        email,
        password: hash,
      });

      // Send welcome email for new OAuth users (async, don't wait for it to complete)
      const userEmail = user.email; // Capture email to avoid null reference in async callback
      console.log(
        `🔄 Attempting to send OAuth welcome email to: ${userEmail} (provider: ${provider})`,
      );
      this.emailService
        .sendCustomEmail(
          user.email,
          'Welcome to LegalRedactor - Your Account is Ready!',
          'welcome',
          {
            name: user.name,
            email: user.email,
            loginUrl: `${process.env.FRONTEND_URL}/signin`,
            dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
            isOAuth: true,
            provider: provider.charAt(0).toUpperCase() + provider.slice(1), // Capitalize provider name
          },
        )
        .then(() => {
          console.log(
            `✅ OAuth welcome email queued successfully for: ${userEmail}`,
          );
        })
        .catch((error) => {
          console.error(
            '❌ Failed to send welcome email to OAuth user:',
            error,
          );
          // Don't throw error - user registration should still succeed
        });
    }

    // Return user without password
    const { password: _, ...safe } = user as any;
    return safe;
  }
}
