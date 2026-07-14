import { describe, it, expect } from 'vitest';
import { getDayOfYear, getQuoteForDay, getCycleDay } from './date';
import { QUOTES } from '../data/quotes';

describe('Daily Stoic Date Utilities', () => {
  it('correctly calculates the day of the year', () => {
    // Jan 1, 2026
    const jan1 = new Date(2026, 0, 1);
    expect(getDayOfYear(jan1)).toBe(1);

    // Feb 1, 2026
    const feb1 = new Date(2026, 1, 1);
    expect(getDayOfYear(feb1)).toBe(32); // 31 days in Jan + 1

    // Dec 31, 2026 (non-leap year, 365 days)
    const dec31 = new Date(2026, 11, 31);
    expect(getDayOfYear(dec31)).toBe(365);

    // Dec 31, 2024 (leap year, 366 days)
    const dec31Leap = new Date(2024, 11, 31);
    expect(getDayOfYear(dec31Leap)).toBe(366);
  });

  it('correctly maps day of year to quote index via modulo', () => {
    // Day 1
    const quote1 = getQuoteForDay(1);
    expect(quote1).toEqual(QUOTES[0]);

    // Day quote length + 1 (should loop back to 0)
    const quoteLenPlus1 = getQuoteForDay(QUOTES.length + 1);
    expect(quoteLenPlus1).toEqual(QUOTES[0]);

    // Day quote length
    const quoteLen = getQuoteForDay(QUOTES.length);
    expect(quoteLen).toEqual(QUOTES[QUOTES.length - 1]);
  });

  describe('getCycleDay', () => {
    // Regression: streaks and reminder sync used to compare the app's
    // cycle-day numbering (QuoteID) against the real calendar day-of-year,
    // which only matched by coincidence when the cycle started on Jan 1.
    it('is day 1 on the cycle start date itself', () => {
      const today = new Date(2026, 6, 13); // July 13, 2026
      expect(getCycleDay('2026-07-13', today)).toBe(1);
    });

    it('advances by exactly one per elapsed calendar day', () => {
      const today = new Date(2026, 6, 14); // July 14, 2026
      expect(getCycleDay('2026-07-13', today)).toBe(2);
    });

    it('disagrees with the real day-of-year once the cycle start isn\'t Jan 1 (the bug this replaced)', () => {
      const today = new Date(2026, 6, 14); // July 14, 2026 — real day-of-year ~195
      const cycleDay = getCycleDay('2026-07-13', today);
      const realDayOfYear = getDayOfYear(today);
      expect(cycleDay).toBe(2);
      expect(cycleDay).not.toBe(realDayOfYear);
    });

    it('wraps back to day 1 after a full 365-day cycle', () => {
      const cycleStart = '2026-01-01';
      const oneCycleLater = new Date(2027, 0, 1); // 365 days after Jan 1, 2026
      expect(getCycleDay(cycleStart, oneCycleLater)).toBe(1);
    });

    it('falls back to the real day-of-year when no cycle start date is set', () => {
      const today = new Date(2026, 1, 1); // Feb 1, 2026
      expect(getCycleDay('', today)).toBe(getDayOfYear(today));
    });
  });
});
