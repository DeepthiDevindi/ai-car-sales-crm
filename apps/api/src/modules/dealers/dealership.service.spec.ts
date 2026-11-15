import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service.js';
import { DealershipService } from './dealership.service.js';

describe('DealershipService', () => {
  it('updates dealership profile and opening hours with an audit record', async () => {
    const updatedDealership = { id: 'dealer-1', name: 'Updated Motors' };
    const transaction = {
      dealership: {
        findUnique: vi.fn().mockResolvedValue({ id: 'dealer-1' }),
        update: vi.fn().mockResolvedValue(updatedDealership),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: vi.fn(async (operation: (tx: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
      ),
    } as unknown as PrismaService;
    const service = new DealershipService(prisma);

    await expect(
      service.updateCurrent('dealer-1', 'user-1', {
        name: 'Updated Motors',
        openingHours: { monday: [{ start: '09:00', end: '17:00' }] },
      }),
    ).resolves.toBe(updatedDealership);

    expect(transaction.dealership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dealer-1' },
        data: {
          name: 'Updated Motors',
          openingHours: { monday: [{ start: '09:00', end: '17:00' }] },
        },
      }),
    );
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dealershipId: 'dealer-1',
          userId: 'user-1',
          action: 'UPDATE',
          details: expect.stringContaining('openingHours'),
        }),
      }),
    );
  });

  it('clears opening hours using the database-null sentinel', async () => {
    const transaction = {
      dealership: {
        findUnique: vi.fn().mockResolvedValue({ id: 'dealer-1' }),
        update: vi.fn().mockResolvedValue({ id: 'dealer-1' }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: vi.fn(async (operation: (tx: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
      ),
    } as unknown as PrismaService;
    const service = new DealershipService(prisma);

    await service.updateCurrent('dealer-1', 'user-1', { openingHours: null });

    expect(transaction.dealership.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { openingHours: Prisma.DbNull } }),
    );
  });

  it('rejects invalid timezones before writing settings', async () => {
    const prisma = { $transaction: vi.fn() } as unknown as PrismaService;
    const service = new DealershipService(prisma);

    await expect(
      service.updateSettings('dealer-1', 'user-1', { timezone: 'Not/A_Timezone' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
