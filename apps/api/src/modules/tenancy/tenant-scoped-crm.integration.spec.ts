import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TenantScopedCrmRepository } from './tenant-scoped-crm.repository.js';

const enabled = process.env.RUN_DB_INTEGRATION_TESTS === '1';

function configureLocalDatabaseUrl(): void {
  if (!process.env.DATABASE_URL) {
    const envPath = resolve(process.cwd(), '.env');
    if (!existsSync(envPath)) {
      throw new Error('DATABASE_URL is unset and apps/api/.env is unavailable.');
    }

    const line = readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .find((entry) => entry.trimStart().startsWith('DATABASE_URL='));
    const value = line?.slice(line.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/, '$2');

    if (!value) {
      throw new Error('DATABASE_URL is missing from apps/api/.env.');
    }

    process.env.DATABASE_URL = value;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Database integration tests cannot run with NODE_ENV=production.');
  }

  const databaseUrl = new URL(process.env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    throw new Error('Database integration tests require PostgreSQL.');
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname)) {
    throw new Error('Database integration tests are restricted to a local PostgreSQL host.');
  }
}

describe.skipIf(!enabled)('Tenant-scoped CRM persistence (PostgreSQL)', () => {
  const suffix = randomUUID();
  const dealershipAId = randomUUID();
  const dealershipBId = randomUUID();
  const userAId = randomUUID();
  const userBId = randomUUID();
  const platformUserId = randomUUID();
  const membershipAId = randomUUID();
  const membershipBId = randomUUID();
  const roleAId = randomUUID();
  const roleBId = randomUUID();
  const platformRoleId = randomUUID();
  const permissionId = randomUUID();
  const customerAId = randomUUID();
  const customerBId = randomUUID();
  const leadAId = randomUUID();
  const leadBId = randomUUID();
  const integrationAId = randomUUID();
  const integrationBId = randomUUID();
  let prisma: PrismaService;
  let repository: TenantScopedCrmRepository;

  const contextA = { userId: userAId, membershipId: membershipAId };

  beforeAll(async () => {
    configureLocalDatabaseUrl();
    prisma = new PrismaService();
    repository = new TenantScopedCrmRepository(prisma);

    await prisma.$transaction(async (transaction) => {
      await transaction.dealership.createMany({
        data: [
          { id: dealershipAId, name: `Synthetic Dealership A ${suffix}`, slug: `it-a-${suffix}` },
          { id: dealershipBId, name: `Synthetic Dealership B ${suffix}`, slug: `it-b-${suffix}` },
        ],
      });

      await transaction.user.createMany({
        data: [
          {
            id: userAId,
            email: `dealer-a-${suffix}@example.test`,
            firstName: 'Synthetic',
            lastName: 'Employee A',
            status: 'ACTIVE',
          },
          {
            id: userBId,
            email: `dealer-b-${suffix}@example.test`,
            firstName: 'Synthetic',
            lastName: 'Employee B',
            status: 'ACTIVE',
          },
          {
            id: platformUserId,
            email: `platform-${suffix}@example.test`,
            status: 'ACTIVE',
          },
        ],
      });

      await transaction.dealershipMembership.createMany({
        data: [
          { id: membershipAId, dealershipId: dealershipAId, userId: userAId, status: 'ACTIVE' },
          { id: membershipBId, dealershipId: dealershipBId, userId: userBId, status: 'ACTIVE' },
        ],
      });

      await transaction.role.createMany({
        data: [
          {
            id: roleAId,
            dealershipId: dealershipAId,
            scope: 'DEALERSHIP',
            key: `SALES_AGENT_A_${suffix}`,
            name: 'Synthetic Sales Agent A',
          },
          {
            id: roleBId,
            dealershipId: dealershipBId,
            scope: 'DEALERSHIP',
            key: `SALES_AGENT_B_${suffix}`,
            name: 'Synthetic Sales Agent B',
          },
          {
            id: platformRoleId,
            scope: 'GLOBAL',
            key: `PLATFORM_ADMIN_${suffix}`,
            name: 'Synthetic Platform Administrator',
          },
        ],
      });

      await transaction.permission.create({
        data: {
          id: permissionId,
          key: `test.permission.${suffix}`,
          name: 'Synthetic test permission',
        },
      });

      await transaction.membershipRole.create({
        data: { dealershipId: dealershipAId, membershipId: membershipAId, roleId: roleAId },
      });
      await transaction.rolePermission.create({
        data: { roleId: roleAId, permissionId },
      });
      await transaction.userRole.create({
        data: { userId: platformUserId, roleId: platformRoleId },
      });

      await transaction.customer.createMany({
        data: [
          {
            id: customerAId,
            dealershipId: dealershipAId,
            firstName: 'Synthetic',
            lastName: 'Customer A',
          },
          {
            id: customerBId,
            dealershipId: dealershipBId,
            firstName: 'Synthetic',
            lastName: 'Customer B',
          },
        ],
      });

      await transaction.lead.createMany({
        data: [
          {
            id: leadAId,
            dealershipId: dealershipAId,
            customerId: customerAId,
            title: 'Synthetic opportunity A',
          },
          {
            id: leadBId,
            dealershipId: dealershipBId,
            customerId: customerBId,
            title: 'Synthetic opportunity B',
          },
        ],
      });

      await transaction.integrationConnection.createMany({
        data: [
          {
            id: integrationAId,
            dealershipId: dealershipAId,
            name: 'Synthetic inventory connection A',
            type: 'inventory',
            provider: 'synthetic',
          },
          {
            id: integrationBId,
            dealershipId: dealershipBId,
            name: 'Synthetic inventory connection B',
            type: 'inventory',
            provider: 'synthetic',
          },
        ],
      });
    });
  });

  afterAll(async () => {
    if (!prisma) {
      return;
    }

    try {
      await prisma.$transaction(async (transaction) => {
        await transaction.leadActivity.deleteMany({
          where: { dealershipId: { in: [dealershipAId, dealershipBId] } },
        });
        await transaction.leadAssignment.deleteMany({
          where: { dealershipId: { in: [dealershipAId, dealershipBId] } },
        });
        await transaction.lead.deleteMany({
          where: { dealershipId: { in: [dealershipAId, dealershipBId] } },
        });
        await transaction.customer.deleteMany({
          where: { dealershipId: { in: [dealershipAId, dealershipBId] } },
        });
        await transaction.inventorySyncLog.deleteMany({
          where: { dealershipId: { in: [dealershipAId, dealershipBId] } },
        });
        await transaction.integrationConnection.deleteMany({
          where: { dealershipId: { in: [dealershipAId, dealershipBId] } },
        });
        await transaction.membershipRole.deleteMany({
          where: { dealershipId: { in: [dealershipAId, dealershipBId] } },
        });
        await transaction.userRole.deleteMany({ where: { userId: platformUserId } });
        await transaction.rolePermission.deleteMany({ where: { roleId: { in: [roleAId, roleBId, platformRoleId] } } });
        await transaction.auditLog.deleteMany({
          where: { dealershipId: { in: [dealershipAId, dealershipBId] } },
        });
        await transaction.dealershipMembership.deleteMany({
          where: { dealershipId: { in: [dealershipAId, dealershipBId] } },
        });
        await transaction.role.deleteMany({ where: { id: { in: [roleAId, roleBId, platformRoleId] } } });
        await transaction.permission.deleteMany({ where: { id: permissionId } });
        await transaction.dealership.deleteMany({
          where: { id: { in: [dealershipAId, dealershipBId] } },
        });
        await transaction.user.deleteMany({
          where: { id: { in: [userAId, userBId, platformUserId] } },
        });
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('lists only customers belonging to the caller membership tenant', async () => {
    const customers = await repository.listCustomers(contextA);

    expect(customers.map(({ id }) => id)).toEqual([customerAId]);
  });

  it('does not update or delete a lead from another dealership', async () => {
    expect(await repository.updateLeadNotes(contextA, leadBId, 'unauthorized')).toBe(0);
    expect(await repository.deleteLead(contextA, leadBId)).toBe(0);

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadBId } });
    expect(lead.notes).toBeNull();
  });

  it('rejects customer-to-lead and employee assignment attempts across tenants', async () => {
    await expect(
      repository.createLead(contextA, {
        customerId: customerBId,
        title: 'Synthetic cross-tenant attempt',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(repository.assignLead(contextA, leadAId, membershipBId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(await prisma.leadAssignment.count({ where: { dealershipId: dealershipAId } })).toBe(0);
  });

  it('lists only integrations belonging to the caller membership tenant', async () => {
    const integrations = await repository.listIntegrationConnections(contextA);

    expect(integrations.map(({ id }) => id)).toEqual([integrationAId]);
  });

  it('rejects reads without an active authorized membership context', async () => {
    await expect(repository.listCustomers()).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      repository.listCustomers({ userId: userBId, membershipId: membershipAId }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enforces tenant boundaries with PostgreSQL composite foreign keys', async () => {
    await expect(
      prisma.lead.create({
        data: {
          dealershipId: dealershipAId,
          customerId: customerBId,
          title: 'Synthetic cross-tenant relation attempt',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });

    await expect(
      prisma.leadAssignment.create({
        data: {
          dealershipId: dealershipAId,
          leadId: leadAId,
          userId: userBId,
          membershipId: membershipBId,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });

    await expect(
      prisma.membershipRole.create({
        data: { dealershipId: dealershipAId, membershipId: membershipAId, roleId: roleBId },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
});
