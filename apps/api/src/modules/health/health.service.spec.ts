import { describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('returns ok when database and redis are available', async () => {
    const service = new HealthService(
      { check: vi.fn().mockResolvedValue('up') } as any,
      { check: vi.fn().mockResolvedValue('up') } as any,
    );

    const response = await service.getHealth();

    expect(response.status).toBe('ok');
    expect(response.services.database).toBe('up');
    expect(response.services.redis).toBe('up');
  });

  it('throws a service unavailable exception when dependencies are down', async () => {
    const service = new HealthService(
      { check: vi.fn().mockResolvedValue('down') } as any,
      { check: vi.fn().mockResolvedValue('down') } as any,
    );

    await expect(service.getHealth()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
