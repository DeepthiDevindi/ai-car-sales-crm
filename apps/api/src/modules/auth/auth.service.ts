import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuthSessionStage,
  AuthTokenPurpose,
  AuditAction,
  MembershipStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { createHash, createHmac } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  EMAIL_VERIFICATION_TTL_MS,
  MFA_PENDING_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  SESSION_TTL_MS,
} from './auth.constants.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { AuthEmailService } from './services/auth-email.service.js';
import { AuthRateLimitService } from './services/auth-rate-limit.service.js';
import { MfaService } from './services/mfa.service.js';
import { PasswordService } from './services/password.service.js';
import { TokenService } from './services/token.service.js';

const INVALID_CREDENTIALS = 'Invalid email or password.';
const GENERIC_EMAIL_RESPONSE =
  'If the account is eligible, instructions will be sent to the address provided.';

type LoginStage = 'ACTIVE' | 'MFA_SETUP' | 'MFA_CHALLENGE';

interface LoginResult {
  stage: LoginStage;
  csrfToken?: string;
  rawToken: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(AuthRateLimitService) private readonly rateLimit: AuthRateLimitService,
    @Inject(AuthEmailService) private readonly email: AuthEmailService,
    @Inject(MfaService) private readonly mfa: MfaService,
  ) {}

  async login(email: string, password: string, ipAddress: string): Promise<LoginResult> {
    const normalizedEmail = this.normalizeEmail(email);
    await this.rateLimit.assertAllowed('login', `${ipAddress}:${normalizedEmail}`, 5, 15 * 60);
    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
      include: {
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          include: {
            roles: {
              include: {
                role: {
                  select: {
                    key: true,
                    scope: true,
                    requiresMfa: true,
                    permissions: {
                      select: { permission: { select: { key: true } } },
                    },
                  },
                },
              },
            },
          },
        },
        platformRoles: {
          include: { role: { select: { key: true, scope: true, requiresMfa: true } } },
        },
      },
    });

    const passwordMatches = await this.passwords.verify(user?.passwordHash ?? null, password);
    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      !user.emailVerifiedAt ||
      !passwordMatches
    ) {
      await this.audit(AuditAction.LOGIN_FAILED, 'Authentication', this.emailDigest(email), null);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const hasPrivilegedRole =
      user.platformRoles.some(
        ({ role }) =>
          role.scope === 'GLOBAL' || role.requiresMfa || role.key === 'SUPER_ADMIN',
      ) ||
      user.memberships.some(({ roles }) =>
        roles.some(
          ({ role }) =>
            role.requiresMfa ||
            role.permissions.some(({ permission }) => permission.key === 'staff.assign_privileged_roles') ||
            role.key === 'SUPER_ADMIN' ||
            role.key === 'DEALER_ADMIN',
        ),
      );
    if (user.mfaEnabled && !user.mfaSecretEncrypted) {
      throw new ServiceUnavailableException('MFA is unavailable for this account.');
    }

    const stage: AuthSessionStage = hasPrivilegedRole
      ? user.mfaEnabled
        ? AuthSessionStage.MFA_CHALLENGE
        : AuthSessionStage.MFA_SETUP
      : AuthSessionStage.ACTIVE;
    const rawToken = this.tokens.create();
    const expiresAt = new Date(
      Date.now() +
        (stage === AuthSessionStage.ACTIVE ? SESSION_TTL_MS : MFA_PENDING_TTL_MS),
    );

    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        tokenHash: this.tokens.hash(rawToken),
        stage,
        expiresAt,
      },
    });

    if (stage === AuthSessionStage.ACTIVE) {
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }),
        this.prisma.auditLog.create({
          data: {
            userId: user.id,
            entityType: 'Authentication',
            entityId: user.id,
            action: AuditAction.LOGIN,
          },
        }),
      ]);
    }

    return {
      stage,
      ...(stage === AuthSessionStage.ACTIVE
        ? { csrfToken: this.csrfToken(rawToken, session.id) }
        : {}),
      rawToken,
      user: this.userSummary(user),
    };
  }

  async me(request: AuthenticatedRequest) {
    const auth = request.auth;
    if (!auth) {
      throw new UnauthorizedException('Authentication is required.');
    }

    const memberships = await this.prisma.dealershipMembership.findMany({
      where: { userId: auth.user.id, status: MembershipStatus.ACTIVE },
      include: {
        dealership: { select: { id: true, name: true, slug: true, status: true } },
        roles: { include: { role: { select: { id: true, key: true, name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      user: {
        id: auth.user.id,
        email: auth.user.email,
        firstName: auth.user.firstName,
        lastName: auth.user.lastName,
      },
      memberships: memberships
        .filter(({ dealership }) => dealership.status === 'ACTIVE')
        .map(({ id, dealershipId, branchId, roles, dealership }) => ({
          id,
          dealershipId,
          dealershipName: dealership.name,
          branchId,
          roles: roles.map(({ role }) => ({ id: role.id, key: role.key, name: role.name })),
        })),
      csrfToken: this.csrfToken(auth.rawToken, auth.session.id),
    };
  }

  async logout(request: AuthenticatedRequest): Promise<void> {
    const auth = request.auth;
    if (!auth) {
      throw new UnauthorizedException('Authentication is required.');
    }

    await this.prisma.$transaction([
      this.prisma.authSession.updateMany({
        where: { id: auth.session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          entityType: 'AuthSession',
          entityId: auth.session.id,
          action: AuditAction.LOGOUT,
        },
      }),
    ]);
  }

  async requestEmailVerification(email: string, ipAddress: string): Promise<{ message: string }> {
    this.email.assertDeliveryAvailable();
    const normalizedEmail = this.normalizeEmail(email);
    await this.rateLimit.assertAllowed(
      'verification-request',
      `${ipAddress}:${normalizedEmail}`,
      3,
      60 * 60,
    );
    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, emailVerifiedAt: null },
      select: { id: true, email: true },
    });

    if (user) {
      const token = await this.createToken(
        user.id,
        AuthTokenPurpose.EMAIL_VERIFICATION,
        EMAIL_VERIFICATION_TTL_MS,
      );
      await this.email.sendVerification(user.email, token);
    }

    return { message: GENERIC_EMAIL_RESPONSE };
  }

  async verifyEmail(token: string, ipAddress: string): Promise<{ message: string }> {
    await this.rateLimit.assertAllowed('verification-consume', ipAddress, 10, 15 * 60);
    const now = new Date();
    const tokenHash = this.tokens.hash(token);

    const consumed = await this.prisma.$transaction(async (transaction) => {
      const record = await transaction.authToken.findFirst({
        where: {
          tokenHash,
          purpose: AuthTokenPurpose.EMAIL_VERIFICATION,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true, userId: true },
      });
      if (!record) {
        return false;
      }

      const result = await transaction.authToken.updateMany({
        where: { id: record.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (result.count !== 1) {
        return false;
      }

      await transaction.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: now },
      });
      await transaction.auditLog.create({
        data: {
          userId: record.userId,
          entityType: 'User',
          entityId: record.userId,
          action: AuditAction.UPDATE,
          details: 'Email verification completed.',
        },
      });
      return true;
    });

    if (!consumed) {
      throw new BadRequestException('Verification link is invalid or expired.');
    }
    return { message: 'Email verification completed.' };
  }

  async requestPasswordReset(email: string, ipAddress: string): Promise<{ message: string }> {
    this.email.assertDeliveryAvailable();
    const normalizedEmail = this.normalizeEmail(email);
    await this.rateLimit.assertAllowed(
      'password-reset-request',
      `${ipAddress}:${normalizedEmail}`,
      3,
      60 * 60,
    );
    const user = await this.prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: { not: null },
      },
      select: { id: true, email: true },
    });

    if (user) {
      const token = await this.createToken(
        user.id,
        AuthTokenPurpose.PASSWORD_RESET,
        PASSWORD_RESET_TTL_MS,
      );
      await this.email.sendPasswordReset(user.email, token);
    }
    return { message: GENERIC_EMAIL_RESPONSE };
  }

  async resetPassword(token: string, password: string, ipAddress: string): Promise<{ message: string }> {
    this.passwords.assertPolicy(password);
    await this.rateLimit.assertAllowed(
      'password-reset-consume',
      `${ipAddress}:${this.tokens.hash(token)}`,
      5,
      15 * 60,
    );
    const tokenHash = this.tokens.hash(token);
    const now = new Date();
    const initial = await this.prisma.authToken.findFirst({
      where: {
        tokenHash,
        purpose: AuthTokenPurpose.PASSWORD_RESET,
        consumedAt: null,
        expiresAt: { gt: now },
        user: { status: UserStatus.ACTIVE, emailVerifiedAt: { not: null } },
      },
      select: { id: true, userId: true },
    });
    if (!initial) {
      throw new BadRequestException('Reset link is invalid or expired.');
    }

    const passwordHash = await this.passwords.hash(password);
    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.authToken.updateMany({
        where: { id: initial.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (result.count !== 1) {
        return false;
      }

      await transaction.user.update({
        where: { id: initial.userId, status: UserStatus.ACTIVE },
        data: { passwordHash },
      });
      await transaction.authSession.updateMany({
        where: { userId: initial.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await transaction.authToken.updateMany({
        where: {
          userId: initial.userId,
          purpose: AuthTokenPurpose.PASSWORD_RESET,
          consumedAt: null,
        },
        data: { consumedAt: now },
      });
      await transaction.auditLog.create({
        data: {
          userId: initial.userId,
          entityType: 'User',
          entityId: initial.userId,
          action: AuditAction.PASSWORD_RESET,
        },
      });
      return true;
    });

    if (!updated) {
      throw new BadRequestException('Reset link is invalid or expired.');
    }
    return { message: 'Password has been reset. Sign in with your new password.' };
  }

  async setupMfa(rawToken: string): Promise<{ secret: string; otpauthUri: string }> {
    const session = await this.pendingSession(rawToken, AuthSessionStage.MFA_SETUP);
    await this.rateLimit.assertAllowed('mfa-setup', session.userId, 3, 60 * 60);
    const secret = this.mfa.createSecret();
    await this.prisma.user.update({
      where: { id: session.userId },
      data: { mfaSecretEncrypted: this.mfa.encrypt(secret), mfaEnabled: false },
    });
    return {
      secret,
      otpauthUri: this.mfa.createOtpAuthUri(session.user.email, secret),
    };
  }

  async verifyMfa(
    rawToken: string,
    code: string,
  ): Promise<{ rawToken: string; stage: 'ACTIVE'; csrfToken: string }> {
    const pending = await this.prisma.authSession.findUnique({
      where: { tokenHash: this.tokens.hash(rawToken) },
      include: { user: true },
    });
    const now = new Date();
    if (
      !pending ||
      pending.revokedAt ||
      pending.expiresAt <= now ||
      (pending.stage !== AuthSessionStage.MFA_SETUP &&
        pending.stage !== AuthSessionStage.MFA_CHALLENGE) ||
      pending.user.status !== UserStatus.ACTIVE ||
      !pending.user.emailVerifiedAt ||
      !pending.user.mfaSecretEncrypted
    ) {
      throw new UnauthorizedException('MFA verification is required.');
    }

    await this.rateLimit.assertAllowed('mfa-verify', pending.userId, 5, 15 * 60);
    const secret = this.mfa.decrypt(pending.user.mfaSecretEncrypted);
    const matchedCounter = this.mfa.matchingCounter(secret, code);
    if (
      matchedCounter === null ||
      (pending.user.mfaLastCounter !== null && matchedCounter <= pending.user.mfaLastCounter)
    ) {
      await this.audit(
        AuditAction.LOGIN_FAILED,
        'MfaChallenge',
        pending.userId,
        pending.userId,
      );
      throw new UnauthorizedException('The authenticator code is invalid or has already been used.');
    }

    const rawRotatedToken = this.tokens.create();
    const activeExpiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const isSetup = pending.stage === AuthSessionStage.MFA_SETUP;
    const completed = await this.prisma.$transaction(async (transaction) => {
      const userUpdate = await transaction.user.updateMany({
        where: {
          id: pending.userId,
          mfaLastCounter: pending.user.mfaLastCounter,
        },
        data: {
          mfaLastCounter: matchedCounter,
          mfaEnabled: true,
          lastLoginAt: now,
        },
      });
      if (userUpdate.count !== 1) {
        return false;
      }

      const sessionUpdate = await transaction.authSession.updateMany({
        where: {
          id: pending.id,
          tokenHash: pending.tokenHash,
          revokedAt: null,
          stage: pending.stage,
          expiresAt: { gt: now },
        },
        data: {
          tokenHash: this.tokens.hash(rawRotatedToken),
          stage: AuthSessionStage.ACTIVE,
          expiresAt: activeExpiresAt,
          lastSeenAt: now,
        },
      });
      if (sessionUpdate.count !== 1) {
        throw new UnauthorizedException('MFA verification is required.');
      }

      await transaction.auditLog.create({
        data: {
          userId: pending.userId,
          entityType: isSetup ? 'MfaEnrollment' : 'Authentication',
          entityId: pending.userId,
          action: isSetup ? AuditAction.MFA_CHANGE : AuditAction.LOGIN,
        },
      });
      return true;
    });
    if (!completed) {
      throw new UnauthorizedException('The authenticator code has already been used.');
    }

    const sessionId = pending.id;
    return {
      rawToken: rawRotatedToken,
      stage: 'ACTIVE',
      csrfToken: this.csrfToken(rawRotatedToken, sessionId),
    };
  }

  csrfToken(rawToken: string, sessionId: string): string {
    return createHmac('sha256', rawToken).update(`csrf:${sessionId}`).digest('hex');
  }

  private async createToken(
    userId: string,
    purpose: AuthTokenPurpose,
    ttlMs: number,
  ): Promise<string> {
    const raw = this.tokens.create();
    const now = new Date();
    await this.prisma.$transaction(async (transaction) => {
      await transaction.authToken.updateMany({
        where: { userId, purpose, consumedAt: null },
        data: { consumedAt: now },
      });
      await transaction.authToken.create({
        data: {
          userId,
          tokenHash: this.tokens.hash(raw),
          purpose,
          expiresAt: new Date(now.getTime() + ttlMs),
        },
      });
    });
    return raw;
  }

  private async pendingSession(
    rawToken: string,
    stage: AuthSessionStage,
  ): Promise<Prisma.AuthSessionGetPayload<{ include: { user: true } }>> {
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: this.tokens.hash(rawToken) },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.stage !== stage ||
      session.expiresAt <= new Date() ||
      session.user.status !== UserStatus.ACTIVE ||
      !session.user.emailVerifiedAt
    ) {
      throw new UnauthorizedException('MFA verification is required.');
    }
    return session;
  }

  private userSummary(user: { id: string; email: string; firstName: string | null; lastName: string | null }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  private async audit(
    action: AuditAction,
    entityType: string,
    entityId: string,
    userId: string | null,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { action, entityType, entityId, userId },
    });
  }

  private emailDigest(email: string): string {
    return createHash('sha256').update(this.normalizeEmail(email)).digest('hex');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

}
