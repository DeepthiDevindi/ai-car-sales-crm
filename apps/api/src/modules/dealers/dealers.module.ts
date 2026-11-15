import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { DealershipController } from './dealership.controller.js';
import { DealershipService } from './dealership.service.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [DealershipController],
  providers: [DealershipService],
})
export class DealersModule {}
