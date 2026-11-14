export function validateEnvironment(): void {
  const required = ['DATABASE_URL', 'REDIS_URL', 'CORS_ORIGIN'];
  const missing = required.filter((key) => !process.env[key]?.trim());

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const databaseUrl = process.env.DATABASE_URL ?? '';
  const redisUrl = process.env.REDIS_URL ?? '';

  if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    throw new Error('DATABASE_URL must point to a PostgreSQL connection string.');
  }

  if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
    throw new Error('REDIS_URL must point to a Redis connection string.');
  }

  const mfaKey = process.env.AUTH_MFA_ENCRYPTION_KEY;
  if (process.env.NODE_ENV === 'production' && !mfaKey) {
    throw new Error('AUTH_MFA_ENCRYPTION_KEY is required in production.');
  }
  if (mfaKey) {
    const decodedKey = Buffer.from(mfaKey, 'base64');
    if (decodedKey.length !== 32 || decodedKey.toString('base64') !== mfaKey) {
      throw new Error('AUTH_MFA_ENCRYPTION_KEY must be a canonical base64-encoded 32-byte key.');
    }
  }
}
