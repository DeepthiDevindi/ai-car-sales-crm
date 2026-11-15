import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { BranchController } from './branch.controller.js';
import { BranchService } from './branch.service.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [BranchController],
  providers: [BranchService],
})
export class BranchesModule {}
