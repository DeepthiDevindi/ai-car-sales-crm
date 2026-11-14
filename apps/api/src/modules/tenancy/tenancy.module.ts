import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { TenantScopedCrmRepository } from './tenant-scoped-crm.repository.js';

@Module({
  imports: [PrismaModule],
  providers: [TenantScopedCrmRepository],
  exports: [TenantScopedCrmRepository],
})
export class TenancyModule {}
