import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AuthenticatedRequest } from '../auth.types.js';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    const auth = request.auth;
    const supplied = request.headers['x-csrf-token'];

    if (!auth || typeof supplied !== 'string') {
      throw new ForbiddenException('A valid CSRF token is required.');
    }

    const expected = createHmac('sha256', auth.rawToken)
      .update(`csrf:${auth.session.id}`)
      .digest();
    const actual = Buffer.from(supplied, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new ForbiddenException('A valid CSRF token is required.');
    }
    return true;
  }
}
