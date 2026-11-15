import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { StaffController } from '../auth/staff.controller.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [StaffController],
})
export class UsersModule {}
