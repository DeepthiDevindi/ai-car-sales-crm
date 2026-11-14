import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './env.validation.js';

const environmentKeys = ['DATABASE_URL', 'REDIS_URL', 'CORS_ORIGIN'] as const;

function withEnvironment(
  values: Record<(typeof environmentKeys)[number], string>,
  run: () => void,
): void {
  const original = Object.fromEntries(
    environmentKeys.map((key) => [key, process.env[key]]),
  ) as Record<(typeof environmentKeys)[number], string | undefined>;

  try {
    Object.assign(process.env, values);
    run();
  } finally {
    for (const key of environmentKeys) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  }
}

describe('validateEnvironment', () => {
  it('accepts the default PostgreSQL and Redis URLs', () => {
    withEnvironment(
      {
        DATABASE_URL:
          'postgresql://crm_app:crm_password@127.0.0.1:55432/ai_car_sales_crm',
        REDIS_URL: 'redis://localhost:6379',
        CORS_ORIGIN: 'http://localhost:3000',
      },
      () => expect(() => validateEnvironment()).not.toThrow(),
    );
  });

  it('rejects invalid database URLs', () => {
    withEnvironment(
      {
        DATABASE_URL: 'mysql://user:pass@localhost:3306/app',
        REDIS_URL: 'redis://localhost:6379',
        CORS_ORIGIN: 'http://localhost:3000',
      },
      () =>
        expect(() =>
          validateEnvironment(),
        ).toThrow('DATABASE_URL must point to a PostgreSQL connection string.'),
    );
  });
});
