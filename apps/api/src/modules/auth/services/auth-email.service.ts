import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  renderAuthEmailTemplate,
  type AuthEmailKind,
} from './auth-email-templates.js';

@Injectable()
export class AuthEmailService {
  private readonly logger = new Logger(AuthEmailService.name);
  private readonly testMessages: Array<{
    kind: AuthEmailKind;
    link: string;
    subject: string;
    text: string;
    html: string;
  }> = [];

  async sendVerification(email: string, token: string): Promise<void> {
    await this.sendLink(email, token, 'verify-email', 'email verification');
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    await this.sendLink(email, token, 'reset-password', 'password reset');
  }

  async sendInvitation(email: string, token: string): Promise<void> {
    await this.sendLink(email, token, 'accept-invitation', 'employee invitation');
  }

  assertDeliveryAvailable(): void {
    if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
      throw new ServiceUnavailableException(
        'Email delivery is available only in development or tests until a provider is configured.',
      );
    }
  }

  getTestMessages(): ReadonlyArray<{
    kind: AuthEmailKind;
    link: string;
    subject: string;
    text: string;
    html: string;
  }> {
    if (process.env.NODE_ENV !== 'test') {
      throw new ServiceUnavailableException('Test email messages are unavailable.');
    }
    return this.testMessages;
  }

  private async sendLink(
    email: string,
    token: string,
    route: string,
    kind: AuthEmailKind,
  ): Promise<void> {
    const environment = process.env.NODE_ENV ?? 'development';
    this.assertDeliveryAvailable();

    const origin =
      process.env.AUTH_WEB_BASE_URL ??
      process.env.CORS_ORIGIN?.split(',')[0]?.trim() ??
      'http://localhost:3000';
    const url = new URL(`/${route}`, origin);
    url.searchParams.set('token', token);
    const link = url.toString();
    const template = renderAuthEmailTemplate(kind, link);

    if (environment === 'test') {
      this.testMessages.push({ kind, link, ...template });
      return;
    }

    this.logger.warn(
      `Development email sink only; ${kind} message was not delivered.`,
    );
  }
}
