import { ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const redis = vi.hoisted(() => ({
  status: 'wait',
  connect: vi.fn(),
  eval: vi.fn(),
  quit: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock('ioredis', () => ({
  default: vi.fn(function MockRedis() {
    return redis;
  }),
}));

import { AuthRateLimitService } from './auth-rate-limit.service.js';

describe('AuthRateLimitService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redis.status = 'wait';
    redis.connect.mockImplementation(async () => {
      redis.status = 'ready';
    });
  });

  it('increments an expiring counter and rejects requests beyond the limit', async () => {
    redis.eval.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const service = new AuthRateLimitService();

    await expect(service.assertAllowed('login', 'synthetic-user', 1, 60)).resolves.toBeUndefined();
    await expect(service.assertAllowed('login', 'synthetic-user', 1, 60)).rejects.toMatchObject({
      status: 429,
    });
    expect(redis.eval).toHaveBeenCalledTimes(2);
    expect(redis.eval.mock.calls[0][0]).toContain('EXPIRE');
    expect(redis.eval.mock.calls[0][2]).toMatch(/^auth-rate:login:[a-f0-9]{64}$/);

    await service.onModuleDestroy();
    expect(redis.quit).toHaveBeenCalledOnce();
  });

  it('fails closed when Redis is unavailable', async () => {
    redis.connect.mockRejectedValueOnce(new Error('synthetic Redis failure'));
    const service = new AuthRateLimitService();

    await expect(service.assertAllowed('login', 'synthetic-user', 5, 60)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(redis.eval).not.toHaveBeenCalled();

    await service.onModuleDestroy();
    expect(redis.disconnect).toHaveBeenCalledOnce();
  });
});
