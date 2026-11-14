import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthSessionGuard } from './guards/auth-session.guard.js';
import { CsrfGuard } from './guards/csrf.guard.js';
import { TenantContextGuard } from './guards/tenant-context.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { RequirePermissions } from './decorators/require-permissions.decorator.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { StaffService } from './services/staff.service.js';
import {
  AssignBranchDto,
  AssignRoleDto,
  CreateInvitationDto,
} from './dto/auth.dto.js';
import { authBodyPipe } from './dto/auth-body.pipe.js';

@Controller('users')
@UseGuards(AuthSessionGuard, CsrfGuard, TenantContextGuard, PermissionsGuard)
export class StaffController {
  constructor(@Inject(StaffService) private readonly staff: StaffService) {}

  @Get('staff')
  @RequirePermissions('staff.read')
  listStaff(@Req() request: AuthenticatedRequest) {
    return this.staff.listStaff(request.tenant!.dealershipId);
  }

  @Post('staff/invitations')
  @RequirePermissions('staff.invite')
  createInvitation(
    @Body(authBodyPipe(CreateInvitationDto)) body: CreateInvitationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const tenant = request.tenant!;
    return this.staff.createInvitation(
      {
        dealershipId: tenant.dealershipId,
        inviterMembershipId: tenant.membership.id,
        permissions: tenant.permissions,
        email: body.email,
        roleId: body.roleId,
        branchId: body.branchId,
      },
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );
  }

  @Patch('staff/:membershipId/deactivate')
  @RequirePermissions('staff.manage')
  async deactivate(
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ status: 'deactivated' }> {
    await this.staff.deactivateMembership(
      request.tenant!.dealershipId,
      membershipId,
      request.auth!.user.id,
    );
    return { status: 'deactivated' };
  }

  @Put('staff/:membershipId/roles')
  @RequirePermissions('staff.assign_roles')
  async assignRole(
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @Body(authBodyPipe(AssignRoleDto)) body: AssignRoleDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ status: 'assigned' }> {
    const tenant = request.tenant!;
    await this.staff.assignRole(
      tenant.dealershipId,
      membershipId,
      body.roleId,
      tenant.permissions,
      request.auth!.user.id,
    );
    return { status: 'assigned' };
  }

  @Patch('staff/:membershipId/branch')
  @RequirePermissions('staff.manage')
  async assignBranch(
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @Body(authBodyPipe(AssignBranchDto)) body: AssignBranchDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ status: 'updated' }> {
    await this.staff.assignBranch(
      request.tenant!.dealershipId,
      membershipId,
      body.branchId,
      request.auth!.user.id,
    );
    return { status: 'updated' };
  }

  @Post('staff/:membershipId/sessions/revoke')
  @RequirePermissions('staff.revoke_sessions')
  revokeSessions(
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.staff.revokeEmployeeSessions(
      request.tenant!.dealershipId,
      membershipId,
      request.auth!.user.id,
    );
  }
}
