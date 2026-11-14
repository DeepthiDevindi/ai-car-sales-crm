import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes a password and verifies it without accepting a different password', async () => {
    const password = 'correct-horse-battery-staple';
    const hash = await service.hash(password);

    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(hash).not.toContain(password);
    await expect(service.verify(hash, password)).resolves.toBe(true);
    await expect(service.verify(hash, `${password}!`)).resolves.toBe(false);
  });

  it('uses the dummy hash path for an unknown account and enforces the password policy', async () => {
    await expect(service.verify(null, 'some-long-password')).resolves.toBe(false);
    expect(() => service.assertPolicy('short')).toThrow(BadRequestException);
    expect(() => service.assertPolicy('password1234')).toThrow(BadRequestException);
  });
});
