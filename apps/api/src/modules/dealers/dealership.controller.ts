import {
  Body,
  Controller,
  Get,
  Inject,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthSessionGuard } from '../auth/guards/auth-session.guard.js';
import { CsrfGuard } from '../auth/guards/csrf.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { TenantContextGuard } from '../auth/guards/tenant-context.guard.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { authBodyPipe } from '../auth/dto/auth-body.pipe.js';
import {
  UpdateDealershipDto,
  UpdateDealershipSettingsDto,
} from './dto/dealership.dto.js';
import { DealershipService } from './dealership.service.js';

@Controller('dealerships/current')
@UseGuards(AuthSessionGuard, CsrfGuard, TenantContextGuard, PermissionsGuard)
export class DealershipController {
  constructor(
    @Inject(DealershipService) private readonly dealerships: DealershipService,
  ) {}

  @Get()
  @RequirePermissions('dealership.read')
  getCurrent(@Req() request: AuthenticatedRequest) {
    return this.dealerships.getCurrent(request.tenant!.dealershipId);
  }

  @Patch()
  @RequirePermissions('dealership.update')
  updateCurrent(
    @Body(authBodyPipe(UpdateDealershipDto)) body: UpdateDealershipDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.dealerships.updateCurrent(
      request.tenant!.dealershipId,
      request.auth!.user.id,
      body,
    );
  }

  @Get('settings')
  @RequirePermissions('dealership.settings.read')
  getSettings(@Req() request: AuthenticatedRequest) {
    return this.dealerships.getSettings(request.tenant!.dealershipId);
  }

  @Patch('settings')
  @RequirePermissions('dealership.settings.update')
  updateSettings(
    @Body(authBodyPipe(UpdateDealershipSettingsDto)) body: UpdateDealershipSettingsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.dealerships.updateSettings(
      request.tenant!.dealershipId,
      request.auth!.user.id,
      body,
    );
  }
}
