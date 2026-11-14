import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { TenancyModule } from './modules/tenancy/tenancy.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: ['.env', '.env.local'],
    }),
    PrismaModule,
    TenancyModule,
    HealthModule,
    AuthModule,
  ],
})
export class AppModule {}
