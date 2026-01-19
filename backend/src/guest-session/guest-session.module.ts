import { Module } from '@nestjs/common';
import { GuestSessionService } from './guest-session.service';
import { GuestSessionController } from './guest-session.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GuestSessionController],
  providers: [GuestSessionService],
  exports: [GuestSessionService],
})
export class GuestSessionModule {}
