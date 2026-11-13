import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ServiceStatus } from '@ai-car-sales-crm/shared-types';

@Injectable()
export class RedisHealthService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisHealthService.name);
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  }

  async check(): Promise<ServiceStatus> {
    try {
      await this.client.connect();
      await this.client.ping();
      return 'up';
    } catch {
      this.logger.warn('Redis health check failed');
      return 'down';
    } finally {
      await this.client.quit().catch(() => undefined);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }
}
