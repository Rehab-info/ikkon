import { describe, expect, it } from 'vitest';
import { addDays, formatDateJa, todayJst } from './date.ts';

describe('date', () => {
  it('today is computed in Asia/Tokyo', () => {
    expect(todayJst(new Date('2026-11-09T15:30:00Z'))).toBe('2026-11-10'); // JST 0:30
    expect(todayJst(new Date('2026-11-09T14:59:00Z'))).toBe('2026-11-09');
  });
  it('addDays and Japanese format', () => {
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(formatDateJa('2026-11-10')).toBe('11月10日(火)');
  });
});
