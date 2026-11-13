import { registerAs } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  corsOrigin: string[];
  databaseUrl: string;
  redisUrl: string;
}

export default registerAs('app', (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.API_PORT ?? 4000),
  apiPrefix: '/api/v1',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgresql://crm_app:crm_password@127.0.0.1:55432/ai_car_sales_crm',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
}));
