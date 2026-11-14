import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { LeadSource, MembershipStatus, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface TenantMembershipContext {
  userId: string;
  membershipId: string;
}

export interface CreateLeadInput {
  customerId: string;
  title: string;
  source?: LeadSource;
  notes?: string;
}

@Injectable()
export class TenantScopedCrmRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listCustomers(context?: TenantMembershipContext | null) {
    return this.prisma.$transaction(async (transaction) => {
      const { dealershipId } = await this.resolveMembership(transaction, context);

      return transaction.customer.findMany({
        where: { dealershipId },
        orderBy: { createdAt: 'desc' },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async listLeads(context?: TenantMembershipContext | null) {
    return this.prisma.$transaction(async (transaction) => {
      const { dealershipId } = await this.resolveMembership(transaction, context);

      return transaction.lead.findMany({
        where: { dealershipId },
        orderBy: { createdAt: 'desc' },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async listIntegrationConnections(context?: TenantMembershipContext | null) {
    return this.prisma.$transaction(async (transaction) => {
      const { dealershipId } = await this.resolveMembership(transaction, context);

      return transaction.integrationConnection.findMany({
        where: { dealershipId },
        orderBy: { createdAt: 'desc' },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async createLead(
    context: TenantMembershipContext | null | undefined,
    input: CreateLeadInput,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const { dealershipId } = await this.resolveMembership(transaction, context);
      const customer = await transaction.customer.findFirst({
        where: { id: input.customerId, dealershipId },
        select: { id: true },
      });

      if (!customer) {
        throw new NotFoundException('Customer was not found in this dealership.');
      }

      return transaction.lead.create({
        data: {
          dealershipId,
          customerId: customer.id,
          title: input.title,
          source: input.source,
          notes: input.notes,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateLeadNotes(
    context: TenantMembershipContext | null | undefined,
    leadId: string,
    notes: string | null,
  ): Promise<number> {
    return this.prisma.$transaction(async (transaction) => {
      const { dealershipId } = await this.resolveMembership(transaction, context);
      const result = await transaction.lead.updateMany({
        where: { id: leadId, dealershipId },
        data: { notes },
      });

      return result.count;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async deleteLead(
    context: TenantMembershipContext | null | undefined,
    leadId: string,
  ): Promise<number> {
    return this.prisma.$transaction(async (transaction) => {
      const { dealershipId } = await this.resolveMembership(transaction, context);
      const result = await transaction.lead.deleteMany({
        where: { id: leadId, dealershipId },
      });

      return result.count;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async assignLead(
    context: TenantMembershipContext | null | undefined,
    leadId: string,
    assigneeMembershipId: string,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const { dealershipId, membershipId } = await this.resolveMembership(transaction, context);
      const [lead, assignee] = await Promise.all([
        transaction.lead.findFirst({
          where: { id: leadId, dealershipId },
          select: { id: true },
        }),
        transaction.dealershipMembership.findFirst({
          where: {
            id: assigneeMembershipId,
            dealershipId,
            status: MembershipStatus.ACTIVE,
            user: { is: { status: UserStatus.ACTIVE } },
          },
          select: { id: true, userId: true },
        }),
      ]);

      if (!lead || !assignee) {
        throw new NotFoundException('Lead or active employee was not found in this dealership.');
      }

      return transaction.leadAssignment.create({
        data: {
          dealershipId,
          leadId: lead.id,
          membershipId: assignee.id,
          userId: assignee.userId,
          assignedByMembershipId: membershipId,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async resolveMembership(
    transaction: Prisma.TransactionClient,
    context?: TenantMembershipContext | null,
  ): Promise<{ dealershipId: string; membershipId: string }> {
    if (!context?.userId?.trim() || !context.membershipId?.trim()) {
      throw new UnauthorizedException('An authenticated dealership membership is required.');
    }

    const membership = await transaction.dealershipMembership.findFirst({
      where: {
        id: context.membershipId,
        userId: context.userId,
        status: MembershipStatus.ACTIVE,
        user: { is: { status: UserStatus.ACTIVE } },
      },
      select: { dealershipId: true },
    });

    if (!membership) {
      throw new ForbiddenException('An active dealership membership is required.');
    }

    return { dealershipId: membership.dealershipId, membershipId: context.membershipId };
  }
}
