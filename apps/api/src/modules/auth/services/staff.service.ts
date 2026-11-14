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

const INVITATION_TTL_MS = 48 * 60 * 60 * 1000;
const PRIVILEGED_ROLE_KEYS = new Set(['DEALER_ADMIN', 'SUPER_ADMIN']);

@Injectable()
export class StaffService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(AuthEmailService) private readonly email: AuthEmailService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(AuthRateLimitService) private readonly rateLimit: AuthRateLimitService,
  ) {}

  async listStaff(dealershipId: string) {
    const memberships = await this.prisma.dealershipMembership.findMany({
      where: { dealershipId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, status: true } },
        roles: { include: { role: { select: { id: true, key: true, name: true } } } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });

    return memberships.map(({ id, user, branchId, status, roles }) => ({
      membershipId: id,
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userStatus: user.status,
      membershipStatus: status,
      branchId,
      roles: roles.map(({ role }) => ({
        id: role.id,
        key: role.key,
        name: role.name,
      })),
    }));
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
      select: { id: true, key: true, requiresMfa: true },
    });
    if (!role) {
      throw new NotFoundException('The selected dealership role was not found.');
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
        where: { id: input.branchId, dealershipId: input.dealershipId },
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
          expiresAt: { gt: now },
        },
        select: { id: true },
      });
      if (outstanding) {
        throw new ConflictException('An active invitation already exists for this address.');
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
      where: { tokenHash, acceptedAt: null, expiresAt: { gt: now } },
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
  ): Promise<void> {
    const membership = await this.prisma.dealershipMembership.findFirst({
      where: { id: membershipId, dealershipId, status: MembershipStatus.ACTIVE },
      select: { id: true, userId: true },
    });
    if (!membership) {
      throw new NotFoundException('Active employee membership was not found.');
    }

    const now = new Date();
    await this.prisma.$transaction(async (transaction) => {
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
        select: { id: true, key: true, requiresMfa: true },
      }),
    ]);
    if (!membership || !role) {
      throw new NotFoundException('Employee or dealership role was not found.');
    }
    if (
      (role.requiresMfa || PRIVILEGED_ROLE_KEYS.has(role.key)) &&
      !permissions.includes('staff.assign_privileged_roles')
    ) {
      throw new ForbiddenException('You cannot assign this role.');
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.membershipRole.upsert({
        where: { membershipId_roleId: { membershipId: membership.id, roleId: role.id } },
        create: { dealershipId, membershipId: membership.id, roleId: role.id },
        update: {},
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
