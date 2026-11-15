import { Transform } from 'class-transformer';
import { LeadSource } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsWeeklySchedule, type WeeklySchedule } from '../../../common/weekly-schedule.js';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function lowerTrim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function upperTrim(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export class UpdateDealershipDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => lowerTrim(value))
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(40)
  contactPhone?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(200)
  addressLine1?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(200)
  addressLine2?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  city?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  state?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(32)
  postalCode?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  country?: string | null;

  @IsOptional()
  @IsWeeklySchedule()
  openingHours?: WeeklySchedule | null;
}

export class UpdateDealershipSettingsDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  timezone?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => upperTrim(value))
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  brandingName?: string | null;

  @IsOptional()
  @IsEnum(LeadSource)
  defaultLeadSource?: LeadSource | null;
}
