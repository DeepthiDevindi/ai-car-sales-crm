import {
  DealershipStatus,
  MembershipStatus,
  Prisma,
  RoleScope,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PasswordService } from './services/password.service.js';

const DEVELOPMENT_DEALERSHIP_SLUG = 'local-development';
const DEVELOPMENT_DEALERSHIP_NAME = 'Local Development Dealership';
const DEVELOPMENT_ROLE_KEY = 'DEVELOPMENT_STAFF';
const DEVELOPMENT_ROLE_NAME = 'Development Staff';

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
