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
import {
  InvitationListQueryDto,
  StaffListQueryDto,
  UpdateEmployeeDto,
} from '../users/dto/users.dto.js';

function staffBranchScope(request: AuthenticatedRequest): string | undefined {
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
  return undefined;
}

@Controller('users')
@UseGuards(AuthSessionGuard, CsrfGuard, TenantContextGuard, PermissionsGuard)
export class StaffController {
  constructor(@Inject(StaffService) private readonly staff: StaffService) {}

  @Get('staff')
  @RequirePermissions('staff.read')
  listStaff(
    @Query(authBodyPipe(StaffListQueryDto)) query: StaffListQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.staff.listStaff(
      request.tenant!.dealershipId,
      staffBranchScope(request),
      query.page,
      query.pageSize,
      query.search,
    );
  }

  @Get('roles')
  @RequirePermissions('roles.read')
  listRoles(@Req() request: AuthenticatedRequest) {
    return this.staff.listRoles(request.tenant!.dealershipId);
  }

  @Get('staff/invitations')
  @RequirePermissions('invitations.read')
  listInvitations(
    @Query(authBodyPipe(InvitationListQueryDto)) query: InvitationListQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.staff.listInvitations(request.tenant!.dealershipId, query.status);
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

  @Post('staff/invitations/:invitationId/resend')
  @RequirePermissions('invitations.manage')
  resendInvitation(
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.staff.resendInvitation(
      request.tenant!.dealershipId,
      invitationId,
      request.auth!.user.id,
    );
  }

  @Patch('staff/invitations/:invitationId/revoke')
  @RequirePermissions('invitations.manage')
  revokeInvitation(
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.staff.revokeInvitation(
      request.tenant!.dealershipId,
      invitationId,
      request.auth!.user.id,
    );
  }

  @Get('staff/:membershipId')
  @RequirePermissions('staff.read')
  getStaff(
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.staff.getStaff(
      request.tenant!.dealershipId,
      membershipId,
      staffBranchScope(request),
    );
  }

  @Patch('staff/:membershipId')
  @RequirePermissions('staff.manage')
  updateStaff(
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @Body(authBodyPipe(UpdateEmployeeDto)) body: UpdateEmployeeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.staff.updateStaffProfile(
      request.tenant!.dealershipId,
      membershipId,
      body.availability,
      request.auth!.user.id,
      staffBranchScope(request),
    );
  }

  @Patch('staff/:membershipId/activate')
  @RequirePermissions('staff.manage')
  activate(
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.staff.activateMembership(
      request.tenant!.dealershipId,
      membershipId,
      request.auth!.user.id,
    );
  }

  @Patch('staff/:membershipId/deactivate')
  @RequirePermissions('staff.manage')
  async deactivate(
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.staff.deactivateMembership(
      request.tenant!.dealershipId,
      membershipId,
      request.auth!.user.id,
    );
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
