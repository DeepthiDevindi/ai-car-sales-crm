import { randomBytes } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { MfaService } from './mfa.service.js';

const originalKey = process.env.AUTH_MFA_ENCRYPTION_KEY;

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.AUTH_MFA_ENCRYPTION_KEY;
  } else {
    process.env.AUTH_MFA_ENCRYPTION_KEY = originalKey;
  }
});

describe('MfaService', () => {
  const service = new MfaService();

  it('matches an RFC 6238 SHA-1 vector with six digits', () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

    expect(service.matchingCounter(secret, '287082', 59_000)).toBe(1n);
    expect(service.matchingCounter(secret, '287083', 59_000)).toBeNull();
  });

  it('encrypts MFA secrets and rejects modified ciphertext', () => {
    process.env.AUTH_MFA_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    const secret = service.createSecret();
    const encrypted = service.encrypt(secret);

    expect(service.decrypt(encrypted)).toBe(secret);
    const parts = encrypted.split('.');
    parts[2] = `${parts[2].startsWith('A') ? 'B' : 'A'}${parts[2].slice(1)}`;
    expect(() => service.decrypt(parts.join('.'))).toThrow(ServiceUnavailableException);
  });

  it('rejects missing and malformed encryption keys', () => {
    delete process.env.AUTH_MFA_ENCRYPTION_KEY;
    expect(() => service.encrypt('secret')).toThrow(ServiceUnavailableException);

    process.env.AUTH_MFA_ENCRYPTION_KEY = 'not-a-canonical-key';
    expect(() => service.encrypt('secret')).toThrow(ServiceUnavailableException);
  });
});
