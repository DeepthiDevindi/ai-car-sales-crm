import { createHmac } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../prisma/prisma.service.js';
import { CsrfGuard } from './csrf.guard.js';
import { PermissionsGuard } from './permissions.guard.js';
import { TenantContextGuard } from './tenant-context.guard.js';

function requestContext(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('CsrfGuard', () => {
  const guard = new CsrfGuard();

  it('accepts a session-bound token and rejects a missing or mismatched token', () => {
    const rawToken = 'synthetic-session-token';
    const sessionId = 'synthetic-session-id';
    const token = createHmac('sha256', rawToken).update(`csrf:${sessionId}`).digest('hex');
    const request = {
      method: 'POST',
      headers: { 'x-csrf-token': token },
      auth: { rawToken, session: { id: sessionId } },
    };

    expect(guard.canActivate(requestContext(request))).toBe(true);
    expect(() =>
      guard.canActivate(requestContext({ ...request, headers: {} })),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard.canActivate(
        requestContext({
          ...request,
          auth: { rawToken, session: { id: 'different-session' } },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('does not require a CSRF token for safe methods', () => {
    expect(
      guard.canActivate(requestContext({ method: 'GET', headers: {} })),
    ).toBe(true);
  });
});

describe('TenantContextGuard', () => {
  const findFirst = vi.fn();
  const prisma = {
    dealershipMembership: { findFirst },
  } as unknown as PrismaService;
  const guard = new TenantContextGuard(prisma);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires an active membership in the requested dealership and derives permissions from its roles', async () => {
    const request = {
      headers: { 'x-dealership-id': 'dealership-a' },
      auth: { user: { id: 'user-a' } },
    };
    findFirst.mockResolvedValueOnce(null);

    await expect(guard.canActivate(requestContext(request))).rejects.toThrow(ForbiddenException);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-a',
          dealershipId: 'dealership-a',
          status: 'ACTIVE',
        }),
      }),
    );

    findFirst.mockResolvedValueOnce({
      id: 'membership-a',
      dealershipId: 'dealership-a',
      roles: [
        {
          role: {
            permissions: [
              { permission: { key: 'staff.read' } },
              { permission: { key: 'staff.read' } },
            ],
          },
        },
      ],
    });

    await expect(guard.canActivate(requestContext(request))).resolves.toBe(true);
    expect(request).toHaveProperty('tenant', {
      dealershipId: 'dealership-a',
      membership: expect.objectContaining({ id: 'membership-a' }),
      permissions: ['staff.read'],
    });
  });
});

describe('PermissionsGuard', () => {
  it('denies access when a dealership role does not grant every required permission', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['staff.read', 'staff.manage']),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const request = {
      tenant: { permissions: ['staff.read'] },
    };

    expect(() => guard.canActivate(requestContext(request))).toThrow(ForbiddenException);
  });
});
