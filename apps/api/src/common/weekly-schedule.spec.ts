import { describe, expect, it } from 'vitest';
import { isWeeklySchedule } from './weekly-schedule.js';

describe('weekly schedule validation', () => {
  it('accepts empty days and non-overlapping local time ranges', () => {
    expect(
      isWeeklySchedule({
        monday: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }],
        sunday: [],
      }),
    ).toBe(true);
  });

  it('rejects unknown days, invalid times, and overlapping ranges', () => {
    expect(isWeeklySchedule({ funday: [] })).toBe(false);
    expect(isWeeklySchedule({ monday: [{ start: '9:00', end: '12:00' }] })).toBe(false);
    expect(
      isWeeklySchedule({
        monday: [{ start: '09:00', end: '12:00' }, { start: '11:30', end: '14:00' }],
      }),
    ).toBe(false);
  });
});
