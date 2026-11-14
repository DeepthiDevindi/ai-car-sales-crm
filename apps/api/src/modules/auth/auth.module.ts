import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { StaffController } from './staff.controller.js';
import { AuthService } from './auth.service.js';
import { AuthSessionGuard } from './guards/auth-session.guard.js';
import { CsrfGuard } from './guards/csrf.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { TenantContextGuard } from './guards/tenant-context.guard.js';
import { AuthEmailService } from './services/auth-email.service.js';
import { AuthRateLimitService } from './services/auth-rate-limit.service.js';
import { MfaService } from './services/mfa.service.js';
import { PasswordService } from './services/password.service.js';
import { TokenService } from './services/token.service.js';
import { StaffService } from './services/staff.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController, StaffController],
  providers: [
    AuthService,
    AuthSessionGuard,
    CsrfGuard,
    PermissionsGuard,
    TenantContextGuard,
    AuthEmailService,
    AuthRateLimitService,
    MfaService,
    PasswordService,
    TokenService,
    StaffService,
  ],
  exports: [
    AuthService,
    AuthSessionGuard,
    CsrfGuard,
    PermissionsGuard,
    TenantContextGuard,
  ],
})
export class AuthModule {}
