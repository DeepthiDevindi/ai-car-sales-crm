import { Controller, Get, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import type { HealthResponse } from '@ai-car-sales-crm/shared-types' with {
  'resolution-mode': 'import',
};
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getHealth(): Promise<HealthResponse> {
    return this.healthService.getHealth();
  }
}
