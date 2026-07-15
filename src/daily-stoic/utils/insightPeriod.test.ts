import { describe, it, expect } from 'vitest';
import { getInsightPeriodRange } from './insightPeriod';
import { cycleDayToDateStr, getCycleDay } from './date';

const CYCLE_START = '2026-07-13'; // a Monday

// Independently derives the expected start day for a "N calendar months
// back from today" window, using the same primitives the implementation is
// built on but not the implementation itself — so these tests would catch a
// regression in getInsightPeriodRange's own month/year math.
function expectedCalendarMonthsAgoDay(cycleStartDate: string, today: number, monthsBack: number): number {
  const todayDate = new Date(cycleDayToDateStr(today, cycleStartDate) + 'T00:00:00');
  todayDate.setMonth(todayDate.getMonth() - monthsBack);
  return getCycleDay(cycleStartDate, todayDate);
}

describe('getInsightPeriodRange', () => {
  it('returns null for "all" (no filtering)', () => {
    expect(getInsightPeriodRange('all', CYCLE_START, 40)).toBeNull();
  });

  it('"cycle" on a partial cycle only spans the days elapsed so far, not the full 28', () => {
    // Day 5: 5 days into cycle 1 — must not reach back 28 days.
    const range = getInsightPeriodRange('cycle', CYCLE_START, 5);
    expect(range).not.toBeNull();
    expect(range!.startDay).toBe(1);
    expect(range!.endDay).toBe(5);
    expect(range!.totalDays).toBe(5);
    expect(range!.start).toBe('2026-07-13');
    expect(range!.end).toBe('2026-07-17');
  });

  it('"cycle" spans the full 28 days once the cycle is complete', () => {
    const range = getInsightPeriodRange('cycle', CYCLE_START, 28);
    expect(range!.startDay).toBe(1);
    expect(range!.totalDays).toBe(28);
  });

  it('"cycle" tracks the CURRENT cycle, not the first one', () => {
    // Day 35 = day 7 of cycle 2 (cycle 2 starts at day 29).
    const range = getInsightPeriodRange('cycle', CYCLE_START, 35);
    expect(range!.startDay).toBe(29);
    expect(range!.endDay).toBe(35);
    expect(range!.totalDays).toBe(7);
  });

  it('"quarter" is anchored to the real calendar date 3 months before today, not a fixed 3*28=84-day window', () => {
    const today = 200;
    const range = getInsightPeriodRange('quarter', CYCLE_START, today);
    const expectedStartDay = expectedCalendarMonthsAgoDay(CYCLE_START, today, 3);

    expect(range!.startDay).toBe(expectedStartDay);
    // A real calendar quarter is meaningfully longer than 3 fixed 28-day
    // cycles (84 days) — proves this isn't secretly still cycle-count math.
    expect(range!.totalDays).toBeGreaterThan(84);
  });

  it('"quarter" clamps to day 1 when history is younger than 3 months', () => {
    const range = getInsightPeriodRange('quarter', CYCLE_START, 30);
    expect(range!.startDay).toBe(1);
    expect(range!.totalDays).toBe(30);
  });

  it('"year" is anchored to the real calendar date one year before today, not a fixed 365-day window', () => {
    const today = 400;
    const range = getInsightPeriodRange('year', CYCLE_START, today);
    const expectedStartDay = expectedCalendarMonthsAgoDay(CYCLE_START, today, 12);

    expect(range!.startDay).toBe(expectedStartDay);
  });

  it('"year" correctly spans more than a fixed 365 days when the window crosses a leap day', () => {
    // 2028 is a leap year. Anchor today's real date well after Feb 29, 2028,
    // so "one year back" (same calendar date, year - 1) spans a window that
    // includes Feb 29, 2028 — a real year-back window here is 366 days, not
    // the 365 a naive fixed-offset implementation would use unconditionally.
    const leapCycleStart = '2028-01-01';
    const today = 400; // lands in early February 2029
    const range = getInsightPeriodRange('year', leapCycleStart, today);
    const expectedStartDay = expectedCalendarMonthsAgoDay(leapCycleStart, today, 12);

    expect(range!.startDay).toBe(expectedStartDay);
    expect(range!.totalDays).toBe(today - expectedStartDay + 1);
    expect(range!.totalDays).toBeGreaterThan(365);
  });

  it('"year" clamps to day 1 when history is younger than a year', () => {
    const range = getInsightPeriodRange('year', CYCLE_START, 40);
    expect(range!.startDay).toBe(1);
    expect(range!.totalDays).toBe(40);
  });
});
