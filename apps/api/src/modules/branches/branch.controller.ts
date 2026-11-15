import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { BranchQueryDto, CreateBranchDto, UpdateBranchDto } from './dto/branch.dto.js';
import { BranchService } from './branch.service.js';

function branchScope(request: AuthenticatedRequest): string | null {
  const tenant = request.tenant!;
  if (
    tenant.roleKeys.includes('SALES_MANAGER') &&
    !tenant.roleKeys.includes('DEALER_ADMIN')
  ) {
    if (!tenant.branchId) {
      throw new ForbiddenException('A branch assignment is required for this role.');
    }
    return tenant.branchId;
  }
  return null;
}

@Controller('branches')
@UseGuards(AuthSessionGuard, CsrfGuard, TenantContextGuard, PermissionsGuard)
export class BranchController {
  constructor(@Inject(BranchService) private readonly branches: BranchService) {}

  @Get()
  @RequirePermissions('branches.read')
  list(
    @Query(authBodyPipe(BranchQueryDto)) query: BranchQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.branches.list(
      request.tenant!.dealershipId,
      branchScope(request),
      query,
    );
  }

  @Get(':branchId')
  @RequirePermissions('branches.read')
  getOne(
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.branches.getOne(
      request.tenant!.dealershipId,
      branchId,
      branchScope(request),
    );
  }

  @Post()
  @RequirePermissions('branches.manage')
  create(
    @Body(authBodyPipe(CreateBranchDto)) body: CreateBranchDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.branches.create(
      request.tenant!.dealershipId,
      request.auth!.user.id,
      body,
    );
  }

  @Patch(':branchId')
  @RequirePermissions('branches.manage')
  update(
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Body(authBodyPipe(UpdateBranchDto)) body: UpdateBranchDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.branches.update(
      request.tenant!.dealershipId,
      request.auth!.user.id,
      branchId,
      branchScope(request),
      body,
    );
  }
}
