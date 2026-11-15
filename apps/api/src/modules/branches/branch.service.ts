import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { BranchQueryDto, CreateBranchDto, UpdateBranchDto } from './dto/branch.dto.js';

function isUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class BranchService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    dealershipId: string,
    branchScopeId: string | null,
    query: BranchQueryDto,
  ) {
    const where: Prisma.BranchWhereInput = {
      dealershipId,
      ...(branchScopeId ? { id: branchScopeId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
              { city: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.branch.findMany({
        where,
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        skip,
        take: query.pageSize,
      }),
      this.prisma.branch.count({ where }),
    ]);
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      pageCount: Math.ceil(total / query.pageSize),
    };
  }

  async getOne(
    dealershipId: string,
    branchId: string,
    branchScopeId: string | null,
  ) {
    if (branchScopeId && branchScopeId !== branchId) {
      throw new NotFoundException('The branch was not found in this dealership.');
    }
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        dealershipId,
      },
    });
    if (!branch) {
      throw new NotFoundException('The branch was not found in this dealership.');
    }
    return branch;
  }

  async create(
    dealershipId: string,
    actorUserId: string,
    input: CreateBranchDto,
  ) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const branch = await transaction.branch.create({
          data: {
            dealershipId,
            name: input.name,
            code: input.code,
            addressLine1: input.addressLine1,
            city: input.city,
            state: input.state,
            postalCode: input.postalCode,
            country: input.country,
          },
        });
        await transaction.auditLog.create({
          data: {
            dealershipId,
            userId: actorUserId,
            entityType: 'Branch',
            entityId: branch.id,
            action: AuditAction.CREATE,
            details: 'Created a dealership branch.',
          },
        });
        return branch;
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictException('A branch with this code already exists in this dealership.');
      }
      throw error;
    }
  }

  async update(
    dealershipId: string,
    actorUserId: string,
    branchId: string,
    branchScopeId: string | null,
    input: UpdateBranchDto,
  ) {
    const data: Prisma.BranchUpdateInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1 } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.state !== undefined ? { state: input.state } : {}),
      ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    };
    const changedFields = Object.keys(data);
    if (changedFields.length === 0) {
      throw new ConflictException('At least one branch field must be provided.');
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        if (branchScopeId && branchScopeId !== branchId) {
          throw new NotFoundException('The branch was not found in this dealership.');
        }
        const current = await transaction.branch.findFirst({
          where: {
            id: branchId,
            dealershipId,
          },
        });
        if (!current) {
          throw new NotFoundException('The branch was not found in this dealership.');
        }

        const branch = await transaction.branch.update({
          where: { id: current.id },
          data,
        });
        await transaction.auditLog.create({
          data: {
            dealershipId,
            userId: actorUserId,
            entityType: 'Branch',
            entityId: branch.id,
            action: AuditAction.UPDATE,
            details: `Updated branch fields: ${changedFields.join(', ')}.`,
          },
        });
        return branch;
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictException('A branch with this code already exists in this dealership.');
      }
      throw error;
    }
  }
}
