import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { HealthResponse } from '@ai-car-sales-crm/shared-types' with {
  'resolution-mode': 'import',
};
import { DatabaseHealthService } from './database-health.service.js';
import { RedisHealthService } from './redis-health.service.js';

@Injectable()
export class HealthService {
  constructor(
    @Inject(DatabaseHealthService) private readonly databaseCheck: DatabaseHealthService,
    @Inject(RedisHealthService) private readonly redisCheck: RedisHealthService,
  ) {}

  async getHealth(): Promise<HealthResponse> {
    const database = await this.databaseCheck.check();
    const redis = await this.redisCheck.check();

    const response: HealthResponse = {
      status: database === 'up' && redis === 'up' ? 'ok' : 'error',
      services: { database, redis },
      timestamp: new Date().toISOString(),
    };

    if (response.status !== 'ok') {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }
}
