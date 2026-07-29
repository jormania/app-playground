import { describe, it, expect } from 'vitest';
import {
  parseTxDate,
  toDateString,
  toMonthKey,
  daysInMonth,
  getPeriodRange,
  getPreviousPeriodRange,
  inRange,
  filterByPeriod,
  filterByPreviousPeriod,
  monthsInPeriod,
  formatPeriodLabel,
  ordinal
} from './period';

const NOW = new Date(2026, 6, 15); // 15 Jul 2026 (month index 6)

describe('parseTxDate', () => {
  it('parses a plain YYYY-MM-DD as local midnight, not UTC', () => {
    const d = parseTxDate('2026-07-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(1);
  });

  it('takes only the date prefix of a full ISO timestamp', () => {
    // A row written by the old subscription engine — a UTC timestamp that, if
    // parsed naively as UTC, lands on a different local calendar day.
    const d = parseTxDate('2026-06-30T21:00:00.000Z');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(30);
  });

  it('returns null for empty or unparseable input', () => {
    expect(parseTxDate('')).toBeNull();
    expect(parseTxDate(null)).toBeNull();
    expect(parseTxDate(undefined)).toBeNull();
    expect(parseTxDate('not-a-date')).toBeNull();
  });
});

describe('toDateString / toMonthKey / daysInMonth', () => {
  it('round-trips through toDateString', () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDateString(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('toMonthKey extracts YYYY-MM from a transaction date', () => {
    expect(toMonthKey('2026-03-17')).toBe('2026-03');
    expect(toMonthKey(null)).toBeNull();
  });

  it('daysInMonth handles the Feb clamp cases that broke subscription posting', () => {
    expect(daysInMonth(2026, 1)).toBe(28); // Feb 2026 (not a leap year)
    expect(daysInMonth(2024, 1)).toBe(29); // Feb 2024 (leap year)
    expect(daysInMonth(2026, 0)).toBe(31);
  });
});

describe('getPeriodRange', () => {
  it('this_month is [1st, 1st of next month)', () => {
    const { start, end } = getPeriodRange('this_month', NOW);
    expect(toDateString(start)).toBe('2026-07-01');
    expect(toDateString(end)).toBe('2026-08-01');
  });

  it('last_3_months spans the two full months before this one, through today', () => {
    const { start, end } = getPeriodRange('last_3_months', NOW);
    expect(toDateString(start)).toBe('2026-05-01');
    expect(toDateString(end)).toBe('2026-08-01');
  });

  it('last_6_months', () => {
    const { start, end } = getPeriodRange('last_6_months', NOW);
    expect(toDateString(start)).toBe('2026-02-01');
    expect(toDateString(end)).toBe('2026-08-01');
  });

  it('a bare YYYY-MM and YYYY are both understood', () => {
    expect(toDateString(getPeriodRange('2025-11', NOW).start)).toBe('2025-11-01');
    expect(toDateString(getPeriodRange('2025-11', NOW).end)).toBe('2025-12-01');
    expect(toDateString(getPeriodRange('2024', NOW).start)).toBe('2024-01-01');
    expect(toDateString(getPeriodRange('2024', NOW).end)).toBe('2025-01-01');
  });

  it('all_time has no bounds', () => {
    expect(getPeriodRange('all_time', NOW)).toEqual({ start: null, end: null });
  });
});

describe('getPreviousPeriodRange', () => {
  it('this_month compares against the SAME slice of last month, not the whole month', () => {
    // Regression for the KPI badge that always looked like a huge win early in
    // the month: comparing 3 days of July against all 31 days of June.
    const { start, end, partial } = getPreviousPeriodRange('this_month', NOW);
    expect(partial).toBe(true);
    expect(toDateString(start)).toBe('2026-06-01');
    // NOW is the 15th, so the comparable window is June 1–15 inclusive → end is the 16th.
    expect(toDateString(end)).toBe('2026-06-16');
  });

  it('clamps the day-of-month cap to the shorter previous month', () => {
    const lateMarch = new Date(2026, 2, 31); // 31 Mar 2026; Feb 2026 only has 28 days
    const { start, end } = getPreviousPeriodRange('this_month', lateMarch);
    expect(toDateString(start)).toBe('2026-02-01');
    // The comparison window is capped at Feb's last real day (28th); the
    // half-open end one day later rolls over to March 1st.
    expect(toDateString(end)).toBe('2026-03-01');
  });

  it('last_month, last_3_months and this_year compare against a full equivalent window', () => {
    expect(getPreviousPeriodRange('last_month', NOW).comparable).toBe(true);
    expect(getPreviousPeriodRange('last_3_months', NOW).comparable).toBe(true);
    expect(getPreviousPeriodRange('all_time', NOW).comparable).toBe(false);
  });
});

describe('filterByPeriod / filterByPreviousPeriod', () => {
  const transactions = [
    { id: 'a', date: '2026-07-15' },
    { id: 'b', date: '2026-06-15' },
    { id: 'c', date: '2026-05-15' },
    { id: 'd', date: '2025-07-15' }
  ];

  it('this_month keeps only the current month', () => {
    expect(filterByPeriod(transactions, 'this_month', NOW).map(t => t.id)).toEqual(['a']);
  });

  it('last_3_months and last_6_months are supported — they used to fall through to "everything ever" in the insights engine', () => {
    expect(filterByPeriod(transactions, 'last_3_months', NOW).map(t => t.id).sort()).toEqual(['a', 'b', 'c']);
    expect(filterByPeriod(transactions, 'last_6_months', NOW).map(t => t.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('filterByPreviousPeriod returns [] for a non-comparable period instead of throwing', () => {
    expect(filterByPreviousPeriod(transactions, 'all_time', NOW)).toEqual([]);
  });

  it('inRange treats a missing/unparseable date as out of range', () => {
    expect(inRange({ date: null }, getPeriodRange('this_month', NOW))).toBe(false);
  });
});

describe('monthsInPeriod', () => {
  it('scales a monthly budget correctly for each preset', () => {
    expect(monthsInPeriod('this_month', NOW)).toBe(1);
    expect(monthsInPeriod('last_3_months', NOW)).toBe(3);
    expect(monthsInPeriod('last_6_months', NOW)).toBe(6);
    expect(monthsInPeriod('this_year', NOW)).toBe(7); // through July
    expect(monthsInPeriod('2025', NOW)).toBe(12);
    expect(monthsInPeriod('all_time', NOW)).toBeNull();
  });
});

describe('formatPeriodLabel', () => {
  it('labels every preset distinctly', () => {
    expect(formatPeriodLabel('last_3_months')).toBe('Last 3 months');
    expect(formatPeriodLabel('last_6_months')).toBe('Last 6 months');
    expect(formatPeriodLabel('all_time')).toBe('All time');
  });
});

describe('ordinal', () => {
  it('handles the 11th/12th/13th exception and every other digit', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
    // These four were wrong in the old inline ternary, which called anything
    // outside 1/2/3 "th" unconditionally at the *ones* digit — 21/22/23 need
    // st/nd/rd, and 11/12/13 are the exception that still need "th".
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(13)).toBe('13th');
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(22)).toBe('22nd');
    expect(ordinal(23)).toBe('23rd');
    expect(ordinal(31)).toBe('31st');
  });
});
