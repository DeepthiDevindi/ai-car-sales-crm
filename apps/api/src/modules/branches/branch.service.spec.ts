import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service.js';
import { BranchService } from './branch.service.js';

describe('BranchService tenant and branch scoping', () => {
  it('does not query or expose a branch outside the caller branch scope', async () => {
    const findFirst = vi.fn();
    const prisma = {
      branch: { findFirst },
    } as unknown as PrismaService;
    const service = new BranchService(prisma);

    await expect(service.getOne('dealership-a', 'branch-b', 'branch-a')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('creates branches only inside the tenant context and audits the creation', async () => {
    const branch = { id: 'branch-1', dealershipId: 'dealer-1', name: 'Central' };
    const transaction = {
      branch: { create: vi.fn().mockResolvedValue(branch) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: vi.fn(async (operation: (tx: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
      ),
    } as unknown as PrismaService;
    const service = new BranchService(prisma);

    await expect(
      service.create('dealer-1', 'user-1', {
        name: 'Central',
        code: 'CENTRAL',
      }),
    ).resolves.toBe(branch);

    expect(transaction.branch.create).toHaveBeenCalledWith({
      data: {
        dealershipId: 'dealer-1',
        name: 'Central',
        code: 'CENTRAL',
        addressLine1: undefined,
        city: undefined,
        state: undefined,
        postalCode: undefined,
        country: undefined,
      },
    });
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dealershipId: 'dealer-1',
          userId: 'user-1',
          entityType: 'Branch',
          entityId: 'branch-1',
          action: 'CREATE',
        }),
      }),
    );
  });
});
