import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PasswordService } from './services/password.service.js';
import {
  assertLocalDevelopmentEnvironment,
  createLocalDevelopmentAccount,
  type DevelopmentBootstrapRequest,
} from './development-bootstrap.service.js';

const baseRequest: DevelopmentBootstrapRequest = {
  nodeEnv: 'development',
  databaseUrl: 'postgresql://localhost:5432/crm',
  allowlist: 'owner@example.test',
  email: 'owner@example.test',
  password: 'a-unique-local-test-password',
  confirmed: true,
};

describe('local development account bootstrap', () => {
  it('rejects production and non-local databases', () => {
    expect(() => assertLocalDevelopmentEnvironment('production', baseRequest.databaseUrl)).toThrow(
      /development or test/,
    );
    expect(() =>
      assertLocalDevelopmentEnvironment(
        'development',
        'postgresql://db.example.test:5432/crm',
      ),
    ).toThrow(/on this computer/);
  });

  it('requires explicit confirmation and an allowlisted email before database writes', async () => {
    const transaction = { user: { findFirst: vi.fn() } };
    const prisma = {
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const passwords = { hash: vi.fn() } as unknown as PasswordService;

    await expect(
      createLocalDevelopmentAccount(prisma, passwords, { ...baseRequest, confirmed: false }),
    ).rejects.toThrow(/confirmation/);
    await expect(
      createLocalDevelopmentAccount(prisma, passwords, {
        ...baseRequest,
        email: 'other@example.test',
      }),
    ).rejects.toThrow(/DEV_BOOTSTRAP_EMAIL_ALLOWLIST/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(transaction.user.findFirst).not.toHaveBeenCalled();
  });

  it('does not overwrite an existing account', async () => {
    const transaction = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'existing-user' }) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<void>) =>
        callback(transaction),
      ),
    } as unknown as PrismaService;
    const passwords = { hash: vi.fn().mockResolvedValue('hashed-password') } as unknown as PasswordService;

    await expect(
      createLocalDevelopmentAccount(prisma, passwords, baseRequest),
    ).rejects.toThrow(/already belongs/);
    expect(transaction.user.findFirst).toHaveBeenCalledOnce();
  });

  it('creates only a verified user with an unprivileged tenant-scoped role', async () => {
    const dealership = {
      id: 'local-dealership',
      name: 'Local Development Dealership',
      status: 'ACTIVE',
    };
    const role = {
      id: 'development-role',
      name: 'Development Staff',
      requiresMfa: false,
      permissions: [],
    };
    const transaction = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'new-user' }),
      },
      dealership: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(dealership),
      },
      role: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(role),
      },
      dealershipMembership: {
        create: vi.fn().mockResolvedValue({ id: 'new-membership' }),
      },
      membershipRole: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<void>) =>
        callback(transaction),
      ),
    } as unknown as PrismaService;
    const passwords = {
      hash: vi.fn().mockResolvedValue('scrypt$hashed-value'),
    } as unknown as PasswordService;

    await expect(
      createLocalDevelopmentAccount(prisma, passwords, {
        ...baseRequest,
        email: '  OWNER@example.test ',
      }),
    ).resolves.toBeUndefined();

    expect(transaction.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'owner@example.test',
          passwordHash: 'scrypt$hashed-value',
          status: 'ACTIVE',
          emailVerifiedAt: expect.any(Date),
        }),
      }),
    );
    expect(transaction.dealership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { slug: 'local-development', name: 'Local Development Dealership' },
      }),
    );
    expect(transaction.role.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'DEVELOPMENT_STAFF',
          scope: 'DEALERSHIP',
          requiresMfa: false,
        }),
      }),
    );
    expect(transaction.membershipRole.create).toHaveBeenCalledWith({
      data: {
        dealershipId: dealership.id,
        membershipId: 'new-membership',
        roleId: role.id,
      },
    });
  });
});
