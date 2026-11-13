import { Module } from '@nestjs/common';
import { DatabaseHealthService } from './database-health.service.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import { RedisHealthService } from './redis-health.service.js';

@Module({
  controllers: [HealthController],
  providers: [DatabaseHealthService, RedisHealthService, HealthService],
  exports: [HealthService],
})
export class HealthModule {}
