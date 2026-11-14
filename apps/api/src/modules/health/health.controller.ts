import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import type { HealthResponse } from '@ai-car-sales-crm/shared-types' with {
  'resolution-mode': 'import',
};
import { DatabaseHealthService } from './database-health.service.js';
import { HealthService } from './health.service.js';
import { RedisHealthService } from './redis-health.service.js';

@Controller('health')
export class HealthController {
  private readonly healthService: HealthService;

  constructor() {
    this.healthService = new HealthService(
      new DatabaseHealthService(),
      new RedisHealthService(),
    );
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getHealth(): Promise<HealthResponse> {
    return this.healthService.getHealth();
  }
}
