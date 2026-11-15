import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuditAction,
  MembershipStatus,
  Prisma,
  RoleScope,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { TokenService } from './token.service.js';
import { AuthEmailService } from './auth-email.service.js';
import { PasswordService } from './password.service.js';
import { AuthRateLimitService } from './auth-rate-limit.service.js';
import type { WeeklySchedule } from '../../../common/weekly-schedule.js';

const INVITATION_TTL_MS = 48 * 60 * 60 * 1000;
const PRIVILEGED_ROLE_KEYS = new Set(['DEALER_ADMIN', 'SUPER_ADMIN']);

function scheduleToJson(schedule: WeeklySchedule): Prisma.InputJsonObject {
  const json: Record<string, Prisma.InputJsonValue> = {};
  for (const [weekday, ranges] of Object.entries(schedule)) {
    json[weekday] = ranges.map(({ start, end }) => ({ start, end }));
  }
  return json;
}

@Injectable()
export class StaffService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(AuthEmailService) private readonly email: AuthEmailService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(AuthRateLimitService) private readonly rateLimit: AuthRateLimitService,
  ) {}

  async listStaff(
    dealershipId: string,
    branchScopeId?: string,
    page = 1,
    pageSize = 25,
    search?: string,
  ) {
    const where: Prisma.DealershipMembershipWhereInput = {
      dealershipId,
      ...(branchScopeId ? { branchId: branchScopeId } : {}),
      ...(search
        ? {
            user: {
              OR: [
                { email: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    const [memberships, total] = await this.prisma.$transaction([
      this.prisma.dealershipMembership.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
            },
          },
          roles: { include: { role: { select: { id: true, key: true, name: true } } } },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.dealershipMembership.count({ where }),
    ]);

    return {
      items: memberships.map(({ id, user, branchId, status, availability, roles }) => ({
        membershipId: id,
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userStatus: user.status,
        membershipStatus: status,
        branchId,
        availability,
        roles: roles.map(({ role }) => ({
          id: role.id,
          key: role.key,
          name: role.name,
        })),
      })),
      page,
      pageSize,
      total,
    };
  }

  async listRoles(dealershipId: string) {
    return this.prisma.role.findMany({
      where: {
        dealershipId,
        scope: RoleScope.DEALERSHIP,
        key: { in: ['DEALER_ADMIN', 'SALES_MANAGER', 'SALES_AGENT'] },
      },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        requiresMfa: true,
        permissions: { select: { permission: { select: { key: true, name: true } } } },
      },
      orderBy: { key: 'asc' },
    });
  }

  async getStaff(dealershipId: string, membershipId: string, branchScopeId?: string) {
    const membership = await this.prisma.dealershipMembership.findFirst({
      where: {
        id: membershipId,
        dealershipId,
        ...(branchScopeId ? { branchId: branchScopeId } : {}),
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, status: true } },
        roles: { include: { role: { select: { id: true, key: true, name: true } } } },
      },
    });
    if (!membership) throw new NotFoundException('Employee membership was not found.');
    return {
      membershipId: membership.id,
      userId: membership.user.id,
      email: membership.user.email,
      firstName: membership.user.firstName,
      lastName: membership.user.lastName,
      userStatus: membership.user.status,
      membershipStatus: membership.status,
      branchId: membership.branchId,
      availability: membership.availability,
      roles: membership.roles.map(({ role }) => role),
    };
  }

  async updateStaffProfile(
    dealershipId: string,
    membershipId: string,
    availability: WeeklySchedule | null | undefined,
    actorUserId: string,
    branchScopeId?: string,
  ): Promise<{ status: 'updated' }> {
    if (availability === undefined) {
      throw new ConflictException('Provide an availability schedule or null to clear it.');
    }
    await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.dealershipMembership.updateMany({
        where: {
          id: membershipId,
          dealershipId,
          ...(branchScopeId ? { branchId: branchScopeId } : {}),
        },
        data: {
          availability:
            availability === null ? Prisma.DbNull : scheduleToJson(availability),
        },
      });
      if (updated.count !== 1) {
        throw new NotFoundException('Employee membership was not found.');
      }
      await transaction.auditLog.create({
        data: {
          dealershipId,
          userId: actorUserId,
          entityType: 'DealershipMembership',
          entityId: membershipId,
          action: AuditAction.UPDATE,
          details: 'Employee availability was updated.',
        },
      });
    });
    return { status: 'updated' };
  }

  async listInvitations(
    dealershipId: string,
    status?: 'PENDING' | 'EXPIRED' | 'ACCEPTED' | 'REVOKED',
  ) {
    const now = new Date();
    const invitations = await this.prisma.employeeInvitation.findMany({
      where: { dealershipId },
      select: {
        id: true,
        email: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        createdAt: true,
        branchId: true,
        role: { select: { id: true, key: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const items = invitations.map((invitation) => ({
      ...invitation,
      status: invitation.acceptedAt
        ? 'ACCEPTED'
        : invitation.revokedAt
          ? 'REVOKED'
          : invitation.expiresAt <= now
            ? 'EXPIRED'
            : 'PENDING',
    }));
    return status ? items.filter((invitation) => invitation.status === status) : items;
  }

  async activateMembership(
    dealershipId: string,
    membershipId: string,
    actorUserId: string,
  ): Promise<{ status: 'activated' }> {
    await this.prisma.$transaction(async (transaction) => {
      const membership = await transaction.dealershipMembership.findFirst({
        where: { id: membershipId, dealershipId, status: MembershipStatus.INACTIVE },
        include: {
          user: { select: { id: true, emailVerifiedAt: true, passwordHash: true } },
          branch: { select: { status: true } },
        },
      });
      if (!membership) throw new NotFoundException('Inactive employee membership was not found.');
      if (!membership.user.emailVerifiedAt || !membership.user.passwordHash) {
        throw new ConflictException(
          'The employee must complete invitation and account setup before activation.',
        );
      }
      if (membership.branch && membership.branch.status !== 'ACTIVE') {
        throw new ConflictException('Assign the employee to an active branch before activation.');
      }

      await transaction.dealershipMembership.update({
        where: { id: membership.id },
        data: { status: MembershipStatus.ACTIVE },
      });
      await transaction.user.update({
        where: { id: membership.user.id },
        data: { status: UserStatus.ACTIVE },
      });
      await transaction.authSession.updateMany({
        where: { userId: membership.user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await transaction.auditLog.create({
        data: {
          dealershipId,
          userId: actorUserId,
          entityType: 'DealershipMembership',
          entityId: membership.id,
          action: AuditAction.MEMBERSHIP_ACTIVATE,
        },
      });
    });
    return { status: 'activated' };
  }

  async resendInvitation(
    dealershipId: string,
    invitationId: string,
    actorUserId: string,
  ): Promise<{ delivery: 'development-not-delivered'; expiresAt: Date }> {
    this.email.assertDeliveryAvailable();
    const now = new Date();
    const invitation = await this.prisma.employeeInvitation.findFirst({
      where: {
        id: invitationId,
        dealershipId,
        acceptedAt: null,
        revokedAt: null,
      },
      select: { id: true, email: true },
    });
    if (!invitation) throw new NotFoundException('Pending invitation was not found.');

    const existingUser = await this.prisma.user.findFirst({
      where: { email: { equals: invitation.email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException('An account already uses this invitation address.');
    }

    const rawToken = this.tokens.create();
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
    await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.employeeInvitation.updateMany({
        where: {
          id: invitation.id,
          dealershipId,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { tokenHash: this.tokens.hash(rawToken), expiresAt },
      });
      if (updated.count !== 1) throw new ConflictException('The invitation is no longer pending.');
      await transaction.auditLog.create({
        data: {
          dealershipId,
          userId: actorUserId,
          entityType: 'EmployeeInvitation',
          entityId: invitation.id,
          action: AuditAction.UPDATE,
          details: 'Employee invitation was resent.',
        },
      });
    });
    await this.email.sendInvitation(invitation.email, rawToken);
    return { delivery: 'development-not-delivered', expiresAt };
  }

  async revokeInvitation(
    dealershipId: string,
    invitationId: string,
    actorUserId: string,
  ): Promise<{ status: 'revoked' }> {
    await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.employeeInvitation.updateMany({
        where: {
          id: invitationId,
          dealershipId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { revokedAt: new Date() },
      });
      if (updated.count !== 1) throw new NotFoundException('Pending invitation was not found.');
      await transaction.auditLog.create({
        data: {
          dealershipId,
          userId: actorUserId,
          entityType: 'EmployeeInvitation',
          entityId: invitationId,
          action: AuditAction.UPDATE,
          details: 'Employee invitation was revoked.',
        },
      });
    });
    return { status: 'revoked' };
  }

  async createInvitation(
    input: {
      dealershipId: string;
      inviterMembershipId: string;
      permissions: string[];
      email: string;
      roleId: string;
      branchId?: string;
    },
    ipAddress: string,
  ): Promise<{ delivery: 'development-not-delivered'; expiresAt: Date }> {
    this.email.assertDeliveryAvailable();
    const normalizedEmail = input.email.trim().toLowerCase();
    await this.rateLimit.assertAllowed(
      'staff-invitation',
      `${ipAddress}:${input.inviterMembershipId}`,
      20,
      60 * 60,
    );

    const role = await this.prisma.role.findFirst({
      where: {
        id: input.roleId,
        dealershipId: input.dealershipId,
        scope: RoleScope.DEALERSHIP,
      },
      select: {
        id: true,
        key: true,
        requiresMfa: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });
    if (!role) {
      throw new NotFoundException('The selected dealership role was not found.');
    }
    if (!['DEALER_ADMIN', 'SALES_MANAGER', 'SALES_AGENT'].includes(role.key)) {
      throw new ForbiddenException('Only approved dealership roles can be assigned.');
    }
    if (
      role.permissions.some(({ permission }) => !input.permissions.includes(permission.key))
    ) {
      throw new ForbiddenException('You cannot invite an employee to this role.');
    }
    if (
      (role.requiresMfa || PRIVILEGED_ROLE_KEYS.has(role.key)) &&
      !input.permissions.includes('staff.assign_privileged_roles')
    ) {
      throw new ForbiddenException('You cannot invite an employee to this role.');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException(
        'An account already uses this email. Existing-account onboarding is not enabled.',
      );
    }

    if (input.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: input.branchId, dealershipId: input.dealershipId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!branch) {
        throw new NotFoundException('The selected branch was not found in this dealership.');
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
    const rawToken = this.tokens.create();
    await this.prisma.$transaction(async (transaction) => {
      const outstanding = await transaction.employeeInvitation.findFirst({
        where: {
          dealershipId: input.dealershipId,
          email: normalizedEmail,
          acceptedAt: null,
          revokedAt: null,
        },
        select: { id: true, expiresAt: true },
      });
      if (outstanding) {
        if (outstanding.expiresAt > now) {
          throw new ConflictException('An active invitation already exists for this address.');
        }
        await transaction.employeeInvitation.update({
          where: { id: outstanding.id },
          data: { revokedAt: now },
        });
      }

      const created = await transaction.employeeInvitation.create({
        data: {
          dealershipId: input.dealershipId,
          invitedByMembershipId: input.inviterMembershipId,
          roleId: role.id,
          branchId: input.branchId,
          email: normalizedEmail,
          tokenHash: this.tokens.hash(rawToken),
          expiresAt,
        },
        select: { id: true },
      });
      await transaction.auditLog.create({
        data: {
          dealershipId: input.dealershipId,
          userId: (await transaction.dealershipMembership.findUniqueOrThrow({
            where: { id: input.inviterMembershipId },
            select: { userId: true },
          })).userId,
          entityType: 'EmployeeInvitation',
          entityId: created.id,
          action: AuditAction.MEMBERSHIP_INVITE,
        },
      });
      return created;
    });

    await this.email.sendInvitation(normalizedEmail, rawToken);
    return { delivery: 'development-not-delivered', expiresAt };
  }

  async acceptInvitation(
    token: string,
    password: string | undefined,
    firstName: string | undefined,
    lastName: string | undefined,
    ipAddress: string,
  ): Promise<{ message: string }> {
    await this.rateLimit.assertAllowed(
      'invitation-accept',
      `${ipAddress}:${this.tokens.hash(token)}`,
      5,
      15 * 60,
    );

    const now = new Date();
    const tokenHash = this.tokens.hash(token);
    const invitation = await this.prisma.employeeInvitation.findFirst({
      where: { tokenHash, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
      include: {
        role: { select: { id: true, key: true, requiresMfa: true } },
        dealership: { select: { status: true } },
      },
    });
    if (!invitation || invitation.dealership.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invitation is invalid or expired.');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email: { equals: invitation.email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existingUser || !password) {
      throw new UnauthorizedException('Invitation is invalid or expired.');
    }

    const passwordHash = await this.passwords.hash(password);
    await this.prisma.$transaction(
      async (transaction) => {
        const claimed = await transaction.employeeInvitation.updateMany({
          where: {
            id: invitation.id,
            tokenHash,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: { acceptedAt: now },
        });
        if (claimed.count !== 1) {
          throw new UnauthorizedException('Invitation is invalid or expired.');
        }

        const user = await transaction.user.create({
          data: {
            email: invitation.email,
            firstName: firstName?.trim() || null,
            lastName: lastName?.trim() || null,
            passwordHash,
            emailVerifiedAt: now,
            status: UserStatus.ACTIVE,
          },
          select: { id: true },
        });
        const membership = await transaction.dealershipMembership.create({
          data: {
            userId: user.id,
            dealershipId: invitation.dealershipId,
            branchId: invitation.branchId,
            status: MembershipStatus.ACTIVE,
            joinedAt: now,
          },
          select: { id: true },
        });
        await transaction.membershipRole.create({
          data: {
            dealershipId: invitation.dealershipId,
            membershipId: membership.id,
            roleId: invitation.roleId,
          },
        });
        await transaction.auditLog.create({
          data: {
            dealershipId: invitation.dealershipId,
            userId: user.id,
            entityType: 'DealershipMembership',
            entityId: membership.id,
            action: AuditAction.MEMBERSHIP_ACTIVATE,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return { message: 'Invitation accepted. Sign in to continue.' };
  }

  async deactivateMembership(
    dealershipId: string,
    membershipId: string,
    actorUserId: string,
  ): Promise<{ status: 'deactivated'; affectedActiveLeads: Array<{ id: string; title: string; status: string }> }> {
    const membership = await this.prisma.dealershipMembership.findFirst({
      where: { id: membershipId, dealershipId, status: MembershipStatus.ACTIVE },
      select: { id: true, userId: true },
    });
    if (!membership) {
      throw new NotFoundException('Active employee membership was not found.');
    }

    const now = new Date();
    return this.prisma.$transaction(async (transaction) => {
      const activeAssignments = await transaction.leadAssignment.findMany({
        where: {
          dealershipId,
          membershipId: membership.id,
          unassignedAt: null,
          lead: { status: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] } },
        },
        select: {
          lead: { select: { id: true, title: true, status: true } },
        },
      });
      const membershipRoles = await transaction.membershipRole.findMany({
        where: { membershipId: membership.id, dealershipId },
        include: { role: { select: { key: true } } },
      });
      if (membershipRoles.some(({ role }) => PRIVILEGED_ROLE_KEYS.has(role.key))) {
        const otherDealershipAdministrators = await transaction.dealershipMembership.count({
          where: {
            dealershipId,
            status: MembershipStatus.ACTIVE,
            id: { not: membership.id },
            roles: {
              some: {
                role: { key: { in: Array.from(PRIVILEGED_ROLE_KEYS) } },
              },
            },
          },
        });
        if (otherDealershipAdministrators === 0) {
          throw new ConflictException('The last dealership administrator cannot be deactivated.');
        }
      }

      await transaction.dealershipMembership.update({
        where: { id: membership.id },
        data: { status: MembershipStatus.INACTIVE },
      });
      const remainingMemberships = await transaction.dealershipMembership.count({
        where: {
          userId: membership.userId,
          status: MembershipStatus.ACTIVE,
          id: { not: membership.id },
        },
      });
      await transaction.authSession.updateMany({
        where: { userId: membership.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      if (remainingMemberships === 0) {
        await transaction.user.update({
          where: { id: membership.userId },
          data: { status: UserStatus.INACTIVE },
        });
      }
      await transaction.auditLog.create({
        data: {
          dealershipId,
          userId: actorUserId,
          entityType: 'DealershipMembership',
          entityId: membership.id,
          action: AuditAction.MEMBERSHIP_DEACTIVATE,
          details: `${activeAssignments.length} active lead assignment(s) require an administrator's reassignment decision.`,
        },
      });
      await transaction.auditLog.create({
        data: {
          dealershipId,
          userId: actorUserId,
          entityType: 'AuthSession',
          entityId: membership.userId,
          action: AuditAction.SESSION_REVOKE,
          details: 'All sessions for the employee were revoked after membership deactivation.',
        },
      });
      return {
        status: 'deactivated' as const,
        affectedActiveLeads: activeAssignments.map(({ lead }) => lead),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async assignRole(
    dealershipId: string,
    membershipId: string,
    roleId: string,
    permissions: string[],
    actorUserId: string,
  ): Promise<void> {
    const [membership, role] = await Promise.all([
      this.prisma.dealershipMembership.findFirst({
        where: { id: membershipId, dealershipId, status: MembershipStatus.ACTIVE },
        select: { id: true, userId: true },
      }),
      this.prisma.role.findFirst({
        where: { id: roleId, dealershipId, scope: RoleScope.DEALERSHIP },
        select: {
          id: true,
          key: true,
          requiresMfa: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      }),
    ]);
    if (!membership || !role) {
      throw new NotFoundException('Employee or dealership role was not found.');
    }
    if (!['DEALER_ADMIN', 'SALES_MANAGER', 'SALES_AGENT'].includes(role.key)) {
      throw new ForbiddenException('Only approved dealership roles can be assigned.');
    }
    if (role.permissions.some(({ permission }) => !permissions.includes(permission.key))) {
      throw new ForbiddenException('You cannot assign a role with permissions you do not have.');
    }
    if (membership.userId === actorUserId && PRIVILEGED_ROLE_KEYS.has(role.key)) {
      throw new ForbiddenException('You cannot assign a privileged role to yourself.');
    }
    if (
      (role.requiresMfa || PRIVILEGED_ROLE_KEYS.has(role.key)) &&
      !permissions.includes('staff.assign_privileged_roles')
    ) {
      throw new ForbiddenException('You cannot assign this role.');
    }

    await this.prisma.$transaction(async (transaction) => {
      const currentRoles = await transaction.membershipRole.findMany({
        where: { dealershipId, membershipId: membership.id },
        include: { role: { select: { key: true } } },
      });
      const isDemotingAdministrator =
        role.key !== 'DEALER_ADMIN' &&
        currentRoles.some(({ role: currentRole }) => currentRole.key === 'DEALER_ADMIN');
      if (isDemotingAdministrator) {
        const otherAdministrators = await transaction.dealershipMembership.count({
          where: {
            dealershipId,
            status: MembershipStatus.ACTIVE,
            id: { not: membership.id },
            roles: { some: { role: { key: 'DEALER_ADMIN' } } },
          },
        });
        if (otherAdministrators === 0) {
          throw new ConflictException('The last dealership administrator cannot be demoted.');
        }
      }
      await transaction.membershipRole.deleteMany({
        where: { dealershipId, membershipId: membership.id },
      });
      await transaction.membershipRole.create({
        data: { dealershipId, membershipId: membership.id, roleId: role.id },
      });
      await transaction.authSession.updateMany({
        where: { userId: membership.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await transaction.auditLog.create({
        data: {
          dealershipId,
          userId: actorUserId,
          entityType: 'MembershipRole',
          entityId: membershipId,
          action: AuditAction.ROLE_ASSIGN,
        },
      });
      await transaction.auditLog.create({
        data: {
          dealershipId,
          userId: actorUserId,
          entityType: 'AuthSession',
          entityId: membership.userId,
          action: AuditAction.SESSION_REVOKE,
          details: 'All sessions for the employee were revoked after a role change.',
        },
      });
    });
  }

  async assignBranch(
    dealershipId: string,
    membershipId: string,
    branchId: string | null,
    actorUserId: string,
  ): Promise<void> {
    if (branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: branchId, dealershipId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!branch) {
        throw new NotFoundException('Active branch was not found in this dealership.');
      }
    }

    const membership = await this.prisma.dealershipMembership.findFirst({
      where: { id: membershipId, dealershipId, status: MembershipStatus.ACTIVE },
      select: { id: true, userId: true },
    });
    if (!membership) {
      throw new NotFoundException('Active employee membership was not found.');
    }

    await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.dealershipMembership.updateMany({
        where: { id: membershipId, dealershipId, status: MembershipStatus.ACTIVE },
        data: { branchId },
      });
      if (result.count !== 1) {
        throw new NotFoundException('Active employee membership was not found.');
      }
      await transaction.authSession.updateMany({
        where: { userId: membership.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await transaction.auditLog.create({
        data: {
          dealershipId,
          userId: actorUserId,
          entityType: 'DealershipMembership',
          entityId: membershipId,
          action: AuditAction.UPDATE,
          details: 'Employee branch assignment changed.',
        },
      });
      await transaction.auditLog.create({
        data: {
          dealershipId,
          userId: actorUserId,
          entityType: 'AuthSession',
          entityId: membership.userId,
          action: AuditAction.SESSION_REVOKE,
          details: 'All sessions for the employee were revoked after a branch change.',
        },
      });
    });
  }

  async revokeEmployeeSessions(
    dealershipId: string,
    membershipId: string,
    actorUserId: string,
  ): Promise<{ revokedCount: number }> {
    const membership = await this.prisma.dealershipMembership.findFirst({
      where: { id: membershipId, dealershipId },
      select: { userId: true },
    });
    if (!membership) {
      throw new NotFoundException('Employee membership was not found.');
    }

    const now = new Date();
    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.authSession.updateMany({
        where: { userId: membership.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await transaction.auditLog.create({
        data: {
          dealershipId,
          userId: actorUserId,
          entityType: 'AuthSession',
          entityId: membership.userId,
          action: AuditAction.SESSION_REVOKE,
          details: 'Administrator revoked all sessions for an employee.',
        },
      });
      return { revokedCount: result.count };
    });
  }
}
