import { Injectable, BadRequestException } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '../auth.constants.js';

const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;
const DUMMY_HASH =
  'scrypt$32768$8$1$Y3JtLWF1dGgtZHVtbXktc2FsdA$OEfBW9jTZau04eambU5Y_p5HAZVIz2-HxnDpUNDZh6Lz7seaYWJP0Ddim9CashmKr73eCAH1_7BVvZFEWgwXEw';
const COMMON_PASSWORDS = new Set([
  '123456789012',
  'password1234',
  'qwerty123456',
  'letmein12345',
  'welcome12345',
]);

function derive(password: string, salt: Buffer, length: number, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, length, { N: n, r, p, maxmem: MAX_MEMORY }, (error, key) => {
      if (error) {
        reject(error);
      } else {
        resolve(key);
      }
    });
  });
}

@Injectable()
export class PasswordService {
  assertPolicy(password: string): void {
    const length = Array.from(password).length;
    if (length < MIN_PASSWORD_LENGTH || length > MAX_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`,
      );
    }

    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      throw new BadRequestException('Choose a less common password.');
    }
  }

  async hash(password: string): Promise<string> {
    this.assertPolicy(password);
    const salt = randomBytes(16);
    const key = await derive(password, salt, KEY_LENGTH, SCRYPT_N, SCRYPT_R, SCRYPT_P);
    return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
  }

  async verify(storedHash: string | null, password: string): Promise<boolean> {
    const encoded = storedHash ?? DUMMY_HASH;
    const parts = encoded.split('$');
    const [algorithm, nText, rText, pText, saltText, keyText] = parts;

    const validFormat =
      algorithm === 'scrypt' &&
      nText === String(SCRYPT_N) &&
      rText === String(SCRYPT_R) &&
      pText === String(SCRYPT_P) &&
      Boolean(saltText) &&
      Boolean(keyText);

    const salt = validFormat ? Buffer.from(saltText, 'base64url') : Buffer.from(DUMMY_HASH.split('$')[4], 'base64url');
    const expected = validFormat
      ? Buffer.from(keyText, 'base64url')
      : Buffer.from(DUMMY_HASH.split('$')[5], 'base64url');
    const candidate = await derive(password, salt, KEY_LENGTH, SCRYPT_N, SCRYPT_R, SCRYPT_P);
    const matches =
      validFormat &&
      expected.length === candidate.length &&
      timingSafeEqual(expected, candidate);

    return Boolean(matches && storedHash);
  }
}
