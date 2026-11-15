import {
  registerDecorator,
  type ValidationOptions,
  type ValidatorConstraintInterface,
} from 'class-validator';

const WEEKDAYS = new Set([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);
const LOCAL_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export interface WeeklyTimeRange {
  start: string;
  end: string;
}

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type WeeklySchedule = Partial<Record<Weekday, WeeklyTimeRange[]>>;

function minutesSinceMidnight(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function isWeeklySchedule(value: unknown): value is WeeklySchedule {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  for (const [weekday, ranges] of Object.entries(value)) {
    if (!WEEKDAYS.has(weekday) || !Array.isArray(ranges)) {
      return false;
    }

    const parsed: Array<{ start: number; end: number }> = [];
    for (const range of ranges) {
      if (
        typeof range !== 'object' ||
        range === null ||
        Array.isArray(range) ||
        !('start' in range) ||
        !('end' in range) ||
        typeof range.start !== 'string' ||
        typeof range.end !== 'string' ||
        !LOCAL_TIME.test(range.start) ||
        !LOCAL_TIME.test(range.end)
      ) {
        return false;
      }

      const start = minutesSinceMidnight(range.start);
      const end = minutesSinceMidnight(range.end);
      if (start >= end) {
        return false;
      }
      parsed.push({ start, end });
    }

    parsed.sort((left, right) => left.start - right.start);
    if (parsed.some((range, index) => index > 0 && range.start < parsed[index - 1].end)) {
      return false;
    }
  }
  return true;
}

export function IsWeeklySchedule(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isWeeklySchedule',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: isWeeklySchedule,
        defaultMessage: () =>
          'Use weekday keys with non-overlapping local time ranges in HH:mm format.',
      } satisfies ValidatorConstraintInterface,
    });
  };
}
