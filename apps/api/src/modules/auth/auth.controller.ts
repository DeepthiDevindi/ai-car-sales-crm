import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response, CookieOptions } from 'express';
import { SESSION_COOKIE_NAME, SESSION_TTL_MS, MFA_PENDING_TTL_MS } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { StaffService } from './services/staff.service.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { AuthSessionGuard } from './guards/auth-session.guard.js';
import { CsrfGuard } from './guards/csrf.guard.js';
import {
  AcceptInvitationDto,
  EmailDto,
  LoginDto,
  MfaCodeDto,
  ResetPasswordDto,
  TokenDto,
} from './dto/auth.dto.js';
import { authBodyPipe } from './dto/auth-body.pipe.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(StaffService) private readonly staff: StaffService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body(authBodyPipe(LoginDto)) body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertBrowserOrigin(request);
    const result = await this.auth.login(
      body.email,
      body.password,
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );
    response.cookie(SESSION_COOKIE_NAME, result.rawToken, {
      ...this.cookieOptions(),
      maxAge: result.stage === 'ACTIVE' ? SESSION_TTL_MS : MFA_PENDING_TTL_MS,
    });

    return {
      stage: result.stage,
      user: result.user,
      ...(result.csrfToken ? { csrfToken: result.csrfToken } : {}),
    };
  }

  @Post('email-verification/request')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestVerification(
    @Body(authBodyPipe(EmailDto)) body: EmailDto,
    @Req() request: Request,
  ) {
    this.assertBrowserOrigin(request);
    return this.auth.requestEmailVerification(
      body.email,
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body(authBodyPipe(TokenDto)) body: TokenDto, @Req() request: Request) {
    this.assertBrowserOrigin(request);
    return this.auth.verifyEmail(
      body.token,
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Body(authBodyPipe(EmailDto)) body: EmailDto, @Req() request: Request) {
    this.assertBrowserOrigin(request);
    return this.auth.requestPasswordReset(
      body.email,
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body(authBodyPipe(ResetPasswordDto)) body: ResetPasswordDto,
    @Req() request: Request,
  ) {
    this.assertBrowserOrigin(request);
    return this.auth.resetPassword(
      body.token,
      body.password,
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );
  }

  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async setupMfa(@Req() request: Request) {
    this.assertBrowserOrigin(request);
    return this.auth.setupMfa(this.requireSessionCookie(request));
  }

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async verifyMfa(
    @Body(authBodyPipe(MfaCodeDto)) body: MfaCodeDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertBrowserOrigin(request);
    const result = await this.auth.verifyMfa(this.requireSessionCookie(request), body.code);
    response.cookie(SESSION_COOKIE_NAME, result.rawToken, {
      ...this.cookieOptions(),
      maxAge: SESSION_TTL_MS,
    });
    return { stage: result.stage, csrfToken: result.csrfToken };
  }

  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @Body(authBodyPipe(AcceptInvitationDto)) body: AcceptInvitationDto,
    @Req() request: Request,
  ) {
    this.assertBrowserOrigin(request);
    return this.staff.acceptInvitation(
      body.token,
      body.password,
      body.firstName,
      body.lastName,
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );
  }

  @Get('me')
  @UseGuards(AuthSessionGuard)
  @Header('Cache-Control', 'no-store')
  async me(@Req() request: AuthenticatedRequest) {
    return this.auth.me(request);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthSessionGuard, CsrfGuard)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.assertBrowserOrigin(request);
    await this.auth.logout(request);
    response.clearCookie(SESSION_COOKIE_NAME, this.cookieOptions());
  }

  private requireSessionCookie(request: Request): string {
    const cookieHeader = request.headers.cookie;
    if (cookieHeader) {
      for (const pair of cookieHeader.split(';')) {
        const separator = pair.indexOf('=');
        if (separator >= 0 && pair.slice(0, separator).trim() === SESSION_COOKIE_NAME) {
          const value = pair.slice(separator + 1).trim();
          if (/^[A-Za-z0-9_-]{43}$/.test(value)) {
            return value;
          }
        }
      }
    }
    throw new ForbiddenException('An active MFA challenge is required.');
  }

  private assertBrowserOrigin(request: Request): void {
    const origin = request.headers.origin;
    if (typeof origin !== 'string') {
      if (process.env.NODE_ENV === 'production') {
        throw new ForbiddenException('A trusted browser origin is required.');
      }
      return;
    }

    const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((value) => value.trim());
    if (!allowedOrigins.includes(origin)) {
      throw new ForbiddenException('The browser origin is not allowed.');
    }
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    };
  }
}
