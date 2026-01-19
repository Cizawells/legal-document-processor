import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(
      dto.name,
      dto.email,
      dto.password,
    );
    return user; // { id, name, email, createdAt, updatedAt }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, access_token } = await this.authService.login(
      dto.email,
      dto.password,
    );

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('access_token', access_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      // match the JWT expiresIn; default 15m
      maxAge: parseExpiryToMs(process.env.JWT_EXPIRES_IN || '15m'),
      path: '/',
    });

    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    });
    return { success: true };
  }

  @Post('oauth')
  @HttpCode(HttpStatus.OK)
  async oauthLogin(
    @Body() dto: { email: string; name: string; provider: string },
  ) {
    const user = await this.authService.oauthLogin(
      dto.email,
      dto.name,
      dto.provider,
    );
    return user;
  }
}

// helper to convert simple expires like '15m', '1h', '7d' to ms
function parseExpiryToMs(value: string): number {
  const match = /^([0-9]+)([smhd])$/.exec(value);
  if (!match) return 15 * 60 * 1000; // default 15m
  const amount = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'd':
      return amount * 24 * 60 * 60 * 1000;
    default:
      return 15 * 60 * 1000;
  }
}
