import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('does not log verification tokens in the development sink', async () => {
    process.env.NODE_ENV = 'development';
    const warning = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const service = new AuthEmailService();

    await service.sendVerification('staff@example.test', 'synthetic-token');

    expect(warning).toHaveBeenCalledOnce();
    expect(warning.mock.calls[0][0]).not.toContain('synthetic-token');
    expect(warning.mock.calls[0][0]).not.toContain('token=');
    warning.mockRestore();
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
