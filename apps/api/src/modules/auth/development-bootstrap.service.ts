import {
  AuditAction,
  DealershipStatus,
  MembershipStatus,
  Prisma,
  RoleScope,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { provisionBuiltInDealershipRoles } from './services/dealership-role-catalog.js';
import { PasswordService } from './services/password.service.js';

const DEVELOPMENT_DEALERSHIP_SLUG = 'local-development';
const DEVELOPMENT_DEALERSHIP_NAME = 'Local Development Dealership';
const DEVELOPMENT_ROLE_KEY = 'DEVELOPMENT_STAFF';
const DEVELOPMENT_ROLE_NAME = 'Development Staff';
const DEVELOPMENT_ADMIN_CONFIRMATION = 'PROMOTE LOCAL ACCOUNT TO DEALER ADMIN';

export interface DevelopmentBootstrapRequest {
  nodeEnv: string | undefined;
  databaseUrl: string | undefined;
  allowlist: string | undefined;
  email: string;
  password: string;
  confirmed: boolean;
}

export function assertLocalDevelopmentEnvironment(
  nodeEnv: string | undefined,
  databaseUrl: string | undefined,
): void {
  if (nodeEnv !== 'development' && nodeEnv !== 'test') {
    throw new Error('Local account bootstrap is allowed only in development or test.');
  }

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for local account bootstrap.');
  }

  let database: URL;
  try {
    database = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  if (
    !['postgres:', 'postgresql:'].includes(database.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(database.hostname)
  ) {
    throw new Error('Local account bootstrap requires a PostgreSQL database on this computer.');
  }
}

function assertAuthorizedRequest(request: DevelopmentBootstrapRequest): string {
  assertLocalDevelopmentEnvironment(request.nodeEnv, request.databaseUrl);

  if (!request.confirmed) {
    throw new Error('Explicit local development confirmation is required.');
  }

  const email = request.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address.');
  }

  const allowlist = (request.allowlist ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length === 0 || !allowlist.includes(email)) {
    throw new Error('The email address must be listed in DEV_BOOTSTRAP_EMAIL_ALLOWLIST.');
  }

  return email;
}

export async function createLocalDevelopmentAccount(
  prisma: PrismaService,
  passwords: PasswordService,
  request: DevelopmentBootstrapRequest,
): Promise<void> {
  const email = assertAuthorizedRequest(request);
  const passwordHash = await passwords.hash(request.password);

  await prisma.$transaction(
    async (transaction) => {
      const existingUser = await transaction.user.findFirst({
        where: { email },
        select: { id: true },
      });
      if (existingUser) {
        throw new Error('That email already belongs to an account; no account was changed.');
      }

      let dealership = await transaction.dealership.findUnique({
        where: { slug: DEVELOPMENT_DEALERSHIP_SLUG },
        select: { id: true, name: true, status: true },
      });
      if (!dealership) {
        dealership = await transaction.dealership.create({
          data: {
            slug: DEVELOPMENT_DEALERSHIP_SLUG,
            name: DEVELOPMENT_DEALERSHIP_NAME,
          },
          select: { id: true, name: true, status: true },
        });
      }
      if (
        dealership.name !== DEVELOPMENT_DEALERSHIP_NAME ||
        dealership.status !== DealershipStatus.ACTIVE
      ) {
        throw new Error('The reserved local development dealership is not eligible for bootstrap.');
      }

      let role = await transaction.role.findFirst({
        where: {
          dealershipId: dealership.id,
          key: DEVELOPMENT_ROLE_KEY,
          scope: RoleScope.DEALERSHIP,
        },
        include: {
          permissions: { select: { permission: { select: { key: true } } } },
        },
      });
      if (!role) {
        role = await transaction.role.create({
          data: {
            dealershipId: dealership.id,
            key: DEVELOPMENT_ROLE_KEY,
            name: DEVELOPMENT_ROLE_NAME,
            scope: RoleScope.DEALERSHIP,
            requiresMfa: false,
          },
          include: {
            permissions: { select: { permission: { select: { key: true } } } },
          },
        });
      }
      if (
        role.name !== DEVELOPMENT_ROLE_NAME ||
        role.requiresMfa ||
        role.permissions.length > 0
      ) {
        throw new Error('The reserved local development role is not eligible for bootstrap.');
      }

      const user = await transaction.user.create({
        data: {
          email,
          passwordHash,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
        select: { id: true },
      });
      const membership = await transaction.dealershipMembership.create({
        data: {
          userId: user.id,
          dealershipId: dealership.id,
          status: MembershipStatus.ACTIVE,
          isPrimary: true,
        },
        select: { id: true },
      });
      await transaction.membershipRole.create({
        data: {
          dealershipId: dealership.id,
          membershipId: membership.id,
          roleId: role.id,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export interface LocalDevelopmentAdminRequest {
  nodeEnv: string | undefined;
  databaseUrl: string | undefined;
  allowlist: string | undefined;
  email: string;
  confirmed: boolean;
}

export async function promoteLocalDevelopmentAdmin(
  prisma: PrismaService,
  request: LocalDevelopmentAdminRequest,
): Promise<void> {
  assertLocalDevelopmentEnvironment(request.nodeEnv, request.databaseUrl);
  if (!request.confirmed) {
    throw new Error('Explicit local development confirmation is required.');
  }

  const email = request.email.trim().toLowerCase();
  const allowlist = (request.allowlist ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!email || !allowlist.includes(email)) {
    throw new Error('The email address must be listed in DEV_BOOTSTRAP_EMAIL_ALLOWLIST.');
  }

  await prisma.$transaction(
    async (transaction) => {
      const dealership = await transaction.dealership.findUnique({
        where: { slug: DEVELOPMENT_DEALERSHIP_SLUG },
        select: { id: true, status: true },
      });
      if (!dealership || dealership.status !== DealershipStatus.ACTIVE) {
        throw new Error('The active local development dealership was not found.');
      }

      const user = await transaction.user.findFirst({
        where: { email },
        select: {
          id: true,
          status: true,
          emailVerifiedAt: true,
          platformRoles: { select: { roleId: true } },
          memberships: {
            where: { dealershipId: dealership.id, status: MembershipStatus.ACTIVE },
            include: { roles: { include: { role: { select: { key: true } } } } },
          },
        },
      });
      if (!user || user.status !== UserStatus.ACTIVE || !user.emailVerifiedAt) {
        throw new Error('An existing active and verified allowlisted account is required.');
      }
      if (user.platformRoles.length > 0 || user.memberships.length !== 1) {
        throw new Error('The account is not eligible for local dealership administrator promotion.');
      }

      const membership = user.memberships[0];
      if (
        membership.roles.some(
          ({ role }) =>
            role.key !== DEVELOPMENT_ROLE_KEY &&
            role.key !== 'DEALER_ADMIN',
        )
      ) {
        throw new Error('The account has an unrelated role assignment; no roles were changed.');
      }

      const roles = await provisionBuiltInDealershipRoles(transaction, dealership.id);
      const adminRole = roles.get('DEALER_ADMIN');
      if (!adminRole) {
        throw new Error('The built-in dealership administrator role was not provisioned.');
      }
      const developmentRole = await transaction.role.findFirst({
        where: {
          dealershipId: dealership.id,
          key: DEVELOPMENT_ROLE_KEY,
          scope: RoleScope.DEALERSHIP,
        },
        select: { id: true },
      });

      if (developmentRole) {
        await transaction.membershipRole.deleteMany({
          where: {
            dealershipId: dealership.id,
            membershipId: membership.id,
            roleId: developmentRole.id,
          },
        });
      }
      await transaction.membershipRole.upsert({
        where: {
          membershipId_roleId: {
            membershipId: membership.id,
            roleId: adminRole.id,
          },
        },
        create: {
          dealershipId: dealership.id,
          membershipId: membership.id,
          roleId: adminRole.id,
        },
        update: {},
      });

      const revoked = await transaction.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await transaction.auditLog.create({
        data: {
          dealershipId: dealership.id,
          userId: user.id,
          entityType: 'MembershipRole',
          entityId: membership.id,
          action: AuditAction.ROLE_ASSIGN,
          details: 'Local development administrator role provisioned with MFA required.',
        },
      });
      if (revoked.count > 0) {
        await transaction.auditLog.create({
          data: {
            dealershipId: dealership.id,
            userId: user.id,
            entityType: 'AuthSession',
            entityId: user.id,
            action: AuditAction.SESSION_REVOKE,
            details: 'Sessions revoked after local administrator role provisioning.',
          },
        });
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export function getLocalDevelopmentAdminConfirmation(): string {
  return DEVELOPMENT_ADMIN_CONFIRMATION;
}
