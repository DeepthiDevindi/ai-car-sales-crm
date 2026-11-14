import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ServiceStatus } from '@ai-car-sales-crm/shared-types' with {
  'resolution-mode': 'import',
};
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class DatabaseHealthService {
  private readonly logger = new Logger(DatabaseHealthService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async check(): Promise<ServiceStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      this.logger.warn('Database health check failed');
      return 'down';
    }
  }
}
