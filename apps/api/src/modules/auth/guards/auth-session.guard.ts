import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthSessionStage, UserStatus } from '@prisma/client';
import type { Request, Response } from 'express';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { SESSION_COOKIE_NAME } from '../auth.constants.js';
import { TokenService } from '../services/token.service.js';
import type { AuthenticatedRequest } from '../auth.types.js';

@Injectable()
export class AuthSessionGuard implements CanActivate {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TokenService) private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const rawToken = this.readCookie(request, SESSION_COOKIE_NAME);
    if (!rawToken) {
      throw new UnauthorizedException('Authentication is required.');
    }

    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: this.tokens.hash(rawToken) },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.stage !== AuthSessionStage.ACTIVE ||
      session.expiresAt <= new Date() ||
      session.user.status !== UserStatus.ACTIVE ||
      !session.user.emailVerifiedAt
    ) {
      response.clearCookie(SESSION_COOKIE_NAME, this.cookieOptions());
      throw new UnauthorizedException('Authentication is required.');
    }

    if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
      await this.prisma.authSession.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      });
    }

    request.auth = { session, user: session.user, rawToken };
    return true;
  }

  private readCookie(request: Request, name: string): string | null {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) {
      return null;
    }

    for (const pair of cookieHeader.split(';')) {
      const separator = pair.indexOf('=');
      if (separator < 0 || pair.slice(0, separator).trim() !== name) {
        continue;
      }

      const value = pair.slice(separator + 1).trim();
      return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
    }
    return null;
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };
  }
}
