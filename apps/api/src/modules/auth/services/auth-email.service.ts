import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class AuthEmailService {
  private readonly logger = new Logger(AuthEmailService.name);
  private readonly testMessages: Array<{ kind: string; link: string }> = [];

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

  getTestMessages(): ReadonlyArray<{ kind: string; link: string }> {
    if (process.env.NODE_ENV !== 'test') {
      throw new ServiceUnavailableException('Test email messages are unavailable.');
    }
    return this.testMessages;
  }

  private async sendLink(
    email: string,
    token: string,
    route: string,
    kind: string,
  ): Promise<void> {
    const environment = process.env.NODE_ENV ?? 'development';
    this.assertDeliveryAvailable();

    const origin =
      process.env.AUTH_WEB_BASE_URL ??
      process.env.CORS_ORIGIN?.split(',')[0]?.trim() ??
      'http://localhost:3000';
    const link = new URL(`/${route}`, origin);
    link.searchParams.set('token', token);

    if (environment === 'test') {
      this.testMessages.push({ kind, link: link.toString() });
      return;
    }

    this.logger.warn(
      `Development email sink only; ${kind} message was not delivered. Link: ${link.toString()}`,
    );
  }
}
