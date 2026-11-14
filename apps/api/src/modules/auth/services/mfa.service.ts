import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;

function encodeBase32(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }

  return output;
}

function decodeBase32(value: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = value.replace(/=+$/g, '').toUpperCase();
  let bits = 0;
  let accumulator = 0;
  const bytes: number[] = [];

  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) {
      throw new Error('Invalid encrypted MFA secret.');
    }
    accumulator = (accumulator << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 255);
      bits -= 8;
      accumulator &= (1 << bits) - 1;
    }
  }

  return Buffer.from(bytes);
}

function totp(secret: Buffer, counter: bigint): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', secret).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary =
    ((digest[offset] & 127) << 24) |
    ((digest[offset + 1] & 255) << 16) |
    ((digest[offset + 2] & 255) << 8) |
    (digest[offset + 3] & 255);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

@Injectable()
export class MfaService {
  createSecret(): string {
    return encodeBase32(randomBytes(20));
  }

  createOtpAuthUri(email: string, secret: string): string {
    const label = encodeURIComponent(`AI Car Sales CRM:${email}`);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent('AI Car Sales CRM')}&algorithm=SHA1&digits=6&period=30`;
  }

  encrypt(secret: string): string {
    const key = this.encryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
  }

  decrypt(value: string): string {
    const [version, ivText, tagText, ciphertextText] = value.split('.');
    if (version !== 'v1' || !ivText || !tagText || !ciphertextText) {
      throw new ServiceUnavailableException('MFA secret could not be decrypted.');
    }

    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey(),
        Buffer.from(ivText, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextText, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException('MFA secret could not be decrypted.');
    }
  }

  matchingCounter(secretText: string, code: string, now = Date.now()): bigint | null {
    if (!/^\d{6}$/.test(code)) {
      return null;
    }

    const secret = decodeBase32(secretText);
    const currentCounter = BigInt(Math.floor(now / 1000 / TOTP_PERIOD_SECONDS));
    for (const offset of [-1n, 0n, 1n]) {
      const counter = currentCounter + offset;
      if (counter < 0n) {
        continue;
      }
      const expected = Buffer.from(totp(secret, counter));
      const supplied = Buffer.from(code);
      if (timingSafeEqual(expected, supplied)) {
        return counter;
      }
    }

    return null;
  }

  private encryptionKey(): Buffer {
    const configured = process.env.AUTH_MFA_ENCRYPTION_KEY;
    if (!configured) {
      throw new ServiceUnavailableException('MFA encryption is not configured.');
    }

    const key = Buffer.from(configured, 'base64');
    if (key.length !== 32 || key.toString('base64') !== configured) {
      throw new ServiceUnavailableException('MFA encryption is not configured.');
    }
    return key;
  }
}
