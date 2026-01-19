import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LemonSqueezyService } from './stripe.service';
import { LemonSqueezyController } from './stripe.controller';
import { PrismaService } from '../prisma/prisma.service';
import { FlexibleAuthGuard } from '../auth/flexible-auth.guard';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule, JwtModule],
  controllers: [LemonSqueezyController],
  providers: [LemonSqueezyService, PrismaService, FlexibleAuthGuard],
  exports: [LemonSqueezyService],
})
export class LemonSqueezyModule {}
