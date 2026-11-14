import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ValidationPipe, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthSessionGuard } from './guards/auth-session.guard.js';
import { CsrfGuard } from './guards/csrf.guard.js';
import { AuthEmailService } from './services/auth-email.service.js';
import { AuthRateLimitService } from './services/auth-rate-limit.service.js';
import { MfaService } from './services/mfa.service.js';
import { PasswordService } from './services/password.service.js';
import { StaffService } from './services/staff.service.js';
import { TokenService } from './services/token.service.js';

const enabled = process.env.RUN_DB_INTEGRATION_TESTS === '1';
const originalEnvironment = {
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  nodeEnv: process.env.NODE_ENV,
  mfaKey: process.env.AUTH_MFA_ENCRYPTION_KEY,
};

function authenticatedRequest(
  session: NonNullable<AuthenticatedRequest['auth']>['session'],
  user: NonNullable<AuthenticatedRequest['auth']>['user'],
  rawToken: string,
): AuthenticatedRequest {
  const request = Object.create(null) as AuthenticatedRequest;
  request.auth = { session, user, rawToken };
  return request;
}

function configureLocalServices(): void {
  const envPath = resolve(process.cwd(), '.env');
  const envValues = existsSync(envPath)
    ? readFileSync(envPath, 'utf8')
        .split(/\r?\n/)
        .reduce<Record<string, string>>((values, line) => {
          const separator = line.indexOf('=');
          if (separator > 0) {
            const key = line.slice(0, separator).trim();
            const value = line
              .slice(separator + 1)
              .trim()
              .replace(/^(['"])(.*)\1$/, '$2');
            values[key] = value;
          }
          return values;
        }, {})
    : {};

  if (!process.env.DATABASE_URL && envValues.DATABASE_URL) {
    process.env.DATABASE_URL = envValues.DATABASE_URL;
  }
  if (!process.env.REDIS_URL && envValues.REDIS_URL) {
    process.env.REDIS_URL = envValues.REDIS_URL;
  }
  if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
    throw new Error('Local DATABASE_URL and REDIS_URL are required for auth integration tests.');
  }

  const databaseUrl = new URL(process.env.DATABASE_URL);
  const redisUrl = new URL(process.env.REDIS_URL);
  if (
    !['postgres:', 'postgresql:'].includes(databaseUrl.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname) ||
    !['redis:', 'rediss:'].includes(redisUrl.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(redisUrl.hostname)
  ) {
    throw new Error('Authentication integration tests are restricted to local services.');
  }

  process.env.NODE_ENV = 'test';
  process.env.AUTH_MFA_ENCRYPTION_KEY = randomBytes(32).toString('base64');
}

describe.skipIf(!enabled)('Authentication persistence (local PostgreSQL and Redis)', () => {
  const suffix = randomUUID();
  const dealershipId = randomUUID();
  const userId = randomUUID();
  const invitedEmail = `invited-${suffix}@example.test`;
  const membershipId = randomUUID();
  const roleId = randomUUID();
  let permissionId: string;
  let createdPermission = false;
  const email = `auth-${suffix}@example.test`;
  const initialPassword = 'initial-auth-test-password';
  const resetPassword = 'reset-auth-test-password';
  let prisma: PrismaService | undefined;
  let rateLimit: AuthRateLimitService | undefined;
  let auth: AuthService;
  let emailService: AuthEmailService;
  let passwords: PasswordService;
  let tokens: TokenService;
  let staff: StaffService;

  beforeAll(async () => {
    configureLocalServices();
    prisma = new PrismaService();
    await prisma.$connect();
    rateLimit = new AuthRateLimitService();
    emailService = new AuthEmailService();
    passwords = new PasswordService();
    tokens = new TokenService();
    auth = new AuthService(prisma, passwords, tokens, rateLimit, emailService, new MfaService());
    staff = new StaffService(prisma, tokens, emailService, passwords, rateLimit);

    await prisma.$transaction(async (transaction) => {
      await transaction.dealership.create({
        data: { id: dealershipId, name: `Synthetic Auth ${suffix}`, slug: `auth-${suffix}` },
      });
      await transaction.user.create({
        data: {
          id: userId,
          email,
          passwordHash: await passwords.hash(initialPassword),
          status: 'ACTIVE',
        },
      });
      await transaction.role.create({
        data: {
          id: roleId,
          dealershipId,
          scope: 'DEALERSHIP',
          key: `AUTH_TEST_STAFF_${suffix}`,
          name: 'Synthetic Auth Test Staff',
        },
      });
      const privilegedPermission = await transaction.permission.findUnique({
        where: { key: 'staff.assign_privileged_roles' },
        select: { id: true },
      });
      if (privilegedPermission) {
        permissionId = privilegedPermission.id;
      } else {
        permissionId = randomUUID();
        createdPermission = true;
        await transaction.permission.create({
          data: {
            id: permissionId,
            key: 'staff.assign_privileged_roles',
            name: 'Assign privileged staff roles',
          },
        });
      }
      await transaction.dealershipMembership.create({
        data: {
          id: membershipId,
          dealershipId,
          userId,
          status: 'ACTIVE',
        },
      });
    });
  }, 30_000);

  afterAll(async () => {
    if (!prisma) {
      return;
    }

    try {
      await prisma.$transaction(async (transaction) => {
        const fixtureUsers = await transaction.user.findMany({
          where: { email: { in: [email, invitedEmail] } },
          select: { id: true },
        });
        const fixtureUserIds = fixtureUsers.map(({ id }) => id);
        await transaction.auditLog.deleteMany({
          where: { OR: [{ dealershipId }, { userId: { in: fixtureUserIds } }] },
        });
        await transaction.employeeInvitation.deleteMany({ where: { dealershipId } });
        await transaction.membershipRole.deleteMany({ where: { dealershipId } });
        await transaction.rolePermission.deleteMany({ where: { roleId } });
        await transaction.dealershipMembership.deleteMany({ where: { dealershipId } });
        await transaction.authToken.deleteMany({ where: { userId: { in: fixtureUserIds } } });
        await transaction.authSession.deleteMany({ where: { userId: { in: fixtureUserIds } } });
        await transaction.role.deleteMany({ where: { id: roleId } });
        if (createdPermission) {
          await transaction.permission.deleteMany({ where: { id: permissionId } });
        }
        await transaction.user.deleteMany({ where: { id: { in: fixtureUserIds } } });
        await transaction.dealership.deleteMany({ where: { id: dealershipId } });
      });
    } finally {
      await rateLimit?.onModuleDestroy();
      await prisma.$disconnect();
      for (const [key, value] of [
        ['DATABASE_URL', originalEnvironment.databaseUrl],
        ['REDIS_URL', originalEnvironment.redisUrl],
        ['NODE_ENV', originalEnvironment.nodeEnv],
        ['AUTH_MFA_ENCRYPTION_KEY', originalEnvironment.mfaKey],
      ] as const) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });

  it('verifies email, creates hashed sessions, logs out, and consumes password reset tokens once', async () => {
    await expect(auth.login(email, initialPassword, `127.0.0.1-${suffix}`)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const verificationMessageStart = emailService.getTestMessages().length;
    await auth.requestEmailVerification(email, `127.0.0.1-${suffix}`);
    const verificationMessage = emailService
      .getTestMessages()
      .slice(verificationMessageStart)
      .find(({ kind }) => kind === 'email verification');
    expect(verificationMessage).toBeDefined();
    const verificationToken = new URL(verificationMessage!.link).searchParams.get('token')!;
    await auth.verifyEmail(verificationToken, `127.0.0.1-${suffix}`);

    const login = await auth.login(email.toUpperCase(), initialPassword, `127.0.0.1-${suffix}`);
    expect(login.stage).toBe('ACTIVE');
    const session = await prisma!.authSession.findUniqueOrThrow({
      where: { tokenHash: tokens.hash(login.rawToken) },
      include: { user: true },
    });
    expect(session.tokenHash).not.toBe(login.rawToken);
    const request = authenticatedRequest(session, session.user, login.rawToken);
    expect((await auth.me(request)).memberships[0].dealershipId).toBe(dealershipId);

    await auth.logout(request);
    await expect(
      prisma!.authSession.findUniqueOrThrow({ where: { id: session.id } }),
    ).resolves.toMatchObject({ revokedAt: expect.any(Date) });

    const resetMessageStart = emailService.getTestMessages().length;
    await auth.requestPasswordReset(email, `127.0.0.1-${suffix}`);
    const resetMessage = emailService
      .getTestMessages()
      .slice(resetMessageStart)
      .find(({ kind }) => kind === 'password reset');
    expect(resetMessage).toBeDefined();
    const resetToken = new URL(resetMessage!.link).searchParams.get('token')!;
    await auth.resetPassword(resetToken, resetPassword, `127.0.0.1-${suffix}`);
    await expect(
      auth.resetPassword(resetToken, resetPassword, `127.0.0.1-${suffix}`),
    ).rejects.toThrow();
    await expect(
      auth.login(email, initialPassword, `127.0.0.1-${suffix}`),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(auth.login(email, resetPassword, `127.0.0.1-${suffix}`)).resolves.toMatchObject({
      stage: 'ACTIVE',
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: StaffService, useValue: staff },
        { provide: PrismaService, useValue: prisma },
        { provide: TokenService, useValue: tokens },
        AuthSessionGuard,
        CsrfGuard,
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('/api/v1');
    app.enableCors({ origin: 'http://localhost:3000', credentials: true });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.listen(0, '127.0.0.1');

    try {
      const address = app.getHttpServer().address();
      if (!address || typeof address === 'string') {
        throw new Error('The authentication integration server did not bind to a TCP port.');
      }
      const apiUrl = `http://127.0.0.1:${address.port}/api/v1`;
      const loginUrl = `${apiUrl}/auth/login`;
      const browserHeaders = {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
      };

      const invalidLogin = await fetch(loginUrl, {
        method: 'POST',
        headers: browserHeaders,
        body: JSON.stringify({ email, password: 'incorrect-auth-test-password' }),
      });
      expect(invalidLogin.status).toBe(401);

      const validLogin = await fetch(loginUrl, {
        method: 'POST',
        headers: browserHeaders,
        body: JSON.stringify({ email, password: resetPassword }),
      });
      expect(validLogin.status).toBe(200);
      expect(validLogin.headers.get('set-cookie')).toMatch(
        /crm_session=.*HttpOnly.*SameSite=Lax/i,
      );
      const cookie = validLogin.headers.get('set-cookie')!.split(';', 1)[0];
      const loginBody = (await validLogin.json()) as { stage: string; csrfToken: string };
      expect(loginBody.stage).toBe('ACTIVE');

      const protectedDashboardData = await fetch(`${apiUrl}/auth/me`, {
        headers: { cookie },
      });
      expect(protectedDashboardData.status).toBe(200);
      const sessionBody = (await protectedDashboardData.json()) as {
        memberships: Array<{ dealershipId: string }>;
      };
      expect(sessionBody.memberships).toHaveLength(1);
      expect(sessionBody.memberships[0].dealershipId).toBe(dealershipId);

      const logout = await fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          ...browserHeaders,
          cookie,
          'x-csrf-token': loginBody.csrfToken,
        },
      });
      expect(logout.status).toBe(204);
      expect(logout.headers.get('set-cookie')).toMatch(/crm_session=;/i);

      const protectedAfterLogout = await fetch(`${apiUrl}/auth/me`, {
        headers: { cookie },
      });
      expect(protectedAfterLogout.status).toBe(401);
    } finally {
      await app.close();
    }
  }, 30_000);

  it('accepts a single-use dealership invitation and creates an active membership', async () => {
    const messageStart = emailService.getTestMessages().length;
    await staff.createInvitation(
      {
        dealershipId,
        inviterMembershipId: membershipId,
        permissions: ['staff.invite'],
        email: invitedEmail.toUpperCase(),
        roleId,
      },
      `127.0.0.1-${suffix}`,
    );
    const invitationMessage = emailService
      .getTestMessages()
      .slice(messageStart)
      .find(({ kind }) => kind === 'employee invitation');
    expect(invitationMessage).toBeDefined();
    const invitationToken = new URL(invitationMessage!.link).searchParams.get('token')!;

    await staff.acceptInvitation(
      invitationToken,
      'invited-auth-test-password',
      'Synthetic',
      'Invitee',
      `127.0.0.1-${suffix}`,
    );
    await expect(
      staff.acceptInvitation(
        invitationToken,
        'invited-auth-test-password',
        undefined,
        undefined,
        `127.0.0.1-${suffix}`,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      prisma!.dealershipMembership.count({
        where: { dealershipId, user: { email: invitedEmail }, status: 'ACTIVE' },
      }),
    ).resolves.toBe(1);
  }, 30_000);

  it('prevents case-variant duplicate account email addresses', async () => {
    await expect(
      prisma!.user.create({
        data: { email: email.toUpperCase(), status: 'ACTIVE' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('requires MFA when a dealership role can assign privileged roles', async () => {
    await prisma!.$transaction(async (transaction) => {
      await transaction.rolePermission.create({
        data: { roleId, permissionId },
      });
    });
    await staff.assignRole(
      dealershipId,
      membershipId,
      roleId,
      ['staff.assign_roles'],
      userId,
    );

    const login = await auth.login(email, resetPassword, `127.0.0.1-${suffix}`);
    expect(login.stage).toBe('MFA_SETUP');
    const setup = await auth.setupMfa(login.rawToken);
    const updatedUser = await prisma!.user.findUniqueOrThrow({ where: { id: userId } });
    expect(updatedUser.mfaSecretEncrypted).not.toBe(setup.secret);
    expect(new MfaService().decrypt(updatedUser.mfaSecretEncrypted!)).toBe(setup.secret);
  }, 30_000);
});
