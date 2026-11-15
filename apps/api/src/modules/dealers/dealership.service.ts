import {
  ConflictException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import type { WeeklySchedule } from '../../common/weekly-schedule.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  UpdateDealershipDto,
  UpdateDealershipSettingsDto,
} from './dto/dealership.dto.js';

function assertTimezone(timezone: string | undefined): void {
  if (!timezone) {
    return;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    throw new BadRequestException('Enter a valid IANA timezone.');
  }
}

function toJsonInput(schedule: WeeklySchedule): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(schedule)) as Prisma.InputJsonObject;
}

@Injectable()
export class DealershipService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getCurrent(dealershipId: string) {
    const dealership = await this.prisma.dealership.findUnique({
      where: { id: dealershipId },
      include: { settings: true },
    });
    if (!dealership) {
      throw new NotFoundException('The authorized dealership was not found.');
    }
    return dealership;
  }

  async updateCurrent(
    dealershipId: string,
    actorUserId: string,
    input: UpdateDealershipDto,
  ) {
    const data: Prisma.DealershipUpdateInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
      ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone } : {}),
      ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1 } : {}),
      ...(input.addressLine2 !== undefined ? { addressLine2: input.addressLine2 } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.state !== undefined ? { state: input.state } : {}),
      ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
      ...(input.country !== undefined ? { country: input.country } : {}),
      ...(input.openingHours !== undefined
        ? {
            openingHours:
              input.openingHours === null
                ? Prisma.DbNull
                : toJsonInput(input.openingHours),
          }
        : {}),
    };
    const changedFields = Object.keys(data);
    if (changedFields.length === 0) {
      throw new ConflictException('At least one dealership field must be provided.');
    }

    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.dealership.findUnique({
        where: { id: dealershipId },
        select: { id: true },
      });
      if (!current) {
        throw new NotFoundException('The authorized dealership was not found.');
      }

      const dealership = await transaction.dealership.update({
        where: { id: dealershipId },
        data,
        include: { settings: true },
      });
      await transaction.auditLog.create({
        data: {
          dealershipId,
          userId: actorUserId,
          entityType: 'Dealership',
          entityId: dealershipId,
          action: AuditAction.UPDATE,
          details: `Updated dealership configuration fields: ${changedFields.join(', ')}.`,
        },
      });
      return dealership;
    });
  }

  async getSettings(dealershipId: string) {
    const dealership = await this.prisma.dealership.findUnique({
      where: { id: dealershipId },
      select: {
        id: true,
        settings: true,
      },
    });
    if (!dealership) {
      throw new NotFoundException('The authorized dealership was not found.');
    }
    return dealership.settings;
  }

  async updateSettings(
    dealershipId: string,
    actorUserId: string,
    input: UpdateDealershipSettingsDto,
  ) {
    assertTimezone(input.timezone);
    const values = {
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.brandingName !== undefined ? { brandingName: input.brandingName } : {}),
      ...(input.defaultLeadSource !== undefined
        ? { defaultLeadSource: input.defaultLeadSource }
        : {}),
    };
    const data: Prisma.DealershipSettingsUpdateInput = values;
    const createData: Prisma.DealershipSettingsUncheckedCreateInput = {
      dealershipId,
      ...values,
    };
    const changedFields = Object.keys(values);
    if (changedFields.length === 0) {
      throw new ConflictException('At least one dealership setting must be provided.');
    }

    return this.prisma.$transaction(async (transaction) => {
      const dealership = await transaction.dealership.findUnique({
        where: { id: dealershipId },
        select: { id: true },
      });
      if (!dealership) {
        throw new NotFoundException('The authorized dealership was not found.');
      }

      const existing = await transaction.dealershipSettings.findUnique({
        where: { dealershipId },
        select: { id: true },
      });
      const settings = await transaction.dealershipSettings.upsert({
        where: { dealershipId },
        create: createData,
        update: data,
      });
      await transaction.auditLog.create({
        data: {
          dealershipId,
          userId: actorUserId,
          entityType: 'DealershipSettings',
          entityId: settings.id,
          action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
          details: `Updated dealership settings fields: ${changedFields.join(', ')}.`,
        },
      });
      return settings;
    });
  }
}
