import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthEmailService } from './auth-email.service.js';

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

describe('AuthEmailService', () => {
  it('captures links only in the test sink', async () => {
    process.env.NODE_ENV = 'test';
    const service = new AuthEmailService();

    await service.sendVerification('staff@example.test', 'synthetic-token');

    expect(service.getTestMessages()).toHaveLength(1);
    expect(service.getTestMessages()[0].link).toContain('token=synthetic-token');
  });

  it.each(['production', undefined])('fails closed outside development and tests (%s)', async (nodeEnv) => {
    if (nodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = nodeEnv;
    }

    const service = new AuthEmailService();
    await expect(service.sendVerification('staff@example.test', 'synthetic-token')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
