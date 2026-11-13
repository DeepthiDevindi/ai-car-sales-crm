import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { ServiceStatus } from '@ai-car-sales-crm/shared-types';

@Injectable()
export class DatabaseHealthService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseHealthService.name);
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
      statement_timeout: 2000,
    });
  }

  async check(): Promise<ServiceStatus> {
    try {
      await this.pool.query('SELECT 1');
      return 'up';
    } catch {
      this.logger.warn('Database health check failed');
      return 'down';
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
