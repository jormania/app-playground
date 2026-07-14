import { describe, it, expect } from 'vitest';
import {
  getDayOfYear,
  getQuoteForDay,
  getCycleDay,
  cycleDayToDateStr,
  getCycleInfo,
  getVirtueForWeek,
  formatCycleLabel,
  mostRecentMonday,
  getQuoteOfTheWeek,
  WEEK_VIRTUES,
} from './date';
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

    it('does not wrap — day numbers keep growing past a 28- or 365-day span (the 28-day cycle rewrite)', () => {
      const cycleStart = '2026-01-01';
      const aYearLater = new Date(2027, 0, 1); // 365 days after Jan 1, 2026
      expect(getCycleDay(cycleStart, aYearLater)).toBe(366);
    });

    it('falls back to the real day-of-year when no cycle start date is set', () => {
      const today = new Date(2026, 1, 1); // Feb 1, 2026
      expect(getCycleDay('', today)).toBe(getDayOfYear(today));
    });
  });

  describe('cycleDayToDateStr', () => {
    // Regression: the favorite-toggle write path used to anchor a cycle day to
    // Jan 1 of the current year unconditionally, while the journal save path
    // anchored to the real cycleStartDate — so a page created only via
    // favoriting (never a full save) got a Date field disconnected from
    // reality by months, silently falling outside every dashboard's date
    // filter. Every write path must resolve to the same date for the same
    // cycle day.
    it('is the inverse of getCycleDay for the cycle start date itself', () => {
      expect(cycleDayToDateStr(1, '2026-07-13')).toBe('2026-07-13');
    });

    it('advances by exactly one calendar day per cycle day', () => {
      expect(cycleDayToDateStr(2, '2026-07-13')).toBe('2026-07-14');
      expect(cycleDayToDateStr(10, '2026-07-13')).toBe('2026-07-22');
    });

    it('anchors to Jan 1 of the current year only when no cycle has started, matching getCycleDay\'s own fallback', () => {
      const today = new Date(2026, 6, 14); // July 14, 2026
      expect(cycleDayToDateStr(2, '', today)).toBe('2026-01-02');
    });

    it('agrees with getCycleDay round-trip: today\'s cycle day maps back to today', () => {
      const today = new Date(2026, 6, 20); // July 20, 2026
      const cycleStart = '2026-07-13';
      const todaysCycleDay = getCycleDay(cycleStart, today);
      expect(cycleDayToDateStr(todaysCycleDay, cycleStart, today)).toBe('2026-07-20');
    });
  });

  describe('getCycleInfo (28-day cycle rewrite)', () => {
    it('is cycle 1, week 1, day 1 on the cycle start date', () => {
      expect(getCycleInfo(1)).toEqual({ cycle: 1, week: 1, dayOfWeek: 1 });
    });

    it('stays in week 1 through day 7, then rolls to week 2 on day 8', () => {
      expect(getCycleInfo(7)).toEqual({ cycle: 1, week: 1, dayOfWeek: 7 });
      expect(getCycleInfo(8)).toEqual({ cycle: 1, week: 2, dayOfWeek: 1 });
    });

    it('reaches week 4 on day 22-28 of the cycle', () => {
      expect(getCycleInfo(22)).toEqual({ cycle: 1, week: 4, dayOfWeek: 1 });
      expect(getCycleInfo(28)).toEqual({ cycle: 1, week: 4, dayOfWeek: 7 });
    });

    it('rolls into cycle 2 on absolute day 29, resetting week and day-of-week', () => {
      expect(getCycleInfo(29)).toEqual({ cycle: 2, week: 1, dayOfWeek: 1 });
    });

    it('rolls into cycle 3 on absolute day 57', () => {
      expect(getCycleInfo(56)).toEqual({ cycle: 2, week: 4, dayOfWeek: 7 });
      expect(getCycleInfo(57)).toEqual({ cycle: 3, week: 1, dayOfWeek: 1 });
    });
  });

  describe('getVirtueForWeek', () => {
    it('maps weeks 1-4 to the Four Cardinal Virtues in fixed order', () => {
      expect(getVirtueForWeek(1)).toBe('Wisdom');
      expect(getVirtueForWeek(2)).toBe('Courage');
      expect(getVirtueForWeek(3)).toBe('Justice');
      expect(getVirtueForWeek(4)).toBe('Temperance');
      expect(WEEK_VIRTUES).toEqual(['Wisdom', 'Courage', 'Justice', 'Temperance']);
    });
  });

  describe('formatCycleLabel', () => {
    it('formats as "Day D of Week W of Cycle C"', () => {
      expect(formatCycleLabel({ cycle: 5, week: 2, dayOfWeek: 4 })).toBe('Day 4 of Week 2 of Cycle 5');
    });
  });

  describe('mostRecentMonday', () => {
    it('returns the same date when already a Monday', () => {
      const monday = new Date(2026, 6, 13); // July 13, 2026 is a Monday
      const result = mostRecentMonday(monday);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(6);
      expect(result.getDate()).toBe(13);
    });

    it('snaps a mid-week date back to that week\'s Monday', () => {
      const wednesday = new Date(2026, 6, 15); // July 15, 2026 is a Wednesday
      const result = mostRecentMonday(wednesday);
      expect(result.getDate()).toBe(13);
    });

    it('snaps a Sunday back to the Monday six days earlier, not forward', () => {
      const sunday = new Date(2026, 6, 19); // July 19, 2026 is a Sunday
      const result = mostRecentMonday(sunday);
      expect(result.getDate()).toBe(13);
    });
  });

  describe('getQuoteOfTheWeek', () => {
    it('returns a quote themed to the week\'s virtue, for all four virtues', () => {
      // Week 1-3 match their virtue name directly; Temperance (week 4) has no
      // quote tagged with that exact word, so it matches adjacent themes
      // (Control/Discipline/Restraint) instead — this must never be null.
      for (let week = 1; week <= 4; week++) {
        const quote = getQuoteOfTheWeek({ cycle: 1, week, dayOfWeek: 1 });
        expect(quote).not.toBeNull();
      }
    });

    it('is stable across every day of the same week', () => {
      const monday = getQuoteOfTheWeek({ cycle: 3, week: 2, dayOfWeek: 1 });
      const friday = getQuoteOfTheWeek({ cycle: 3, week: 2, dayOfWeek: 5 });
      expect(monday).toEqual(friday);
    });

    it('picks from the pool of quotes actually tagged with the virtue theme', () => {
      const quote = getQuoteOfTheWeek({ cycle: 1, week: 1, dayOfWeek: 1 }); // Wisdom
      expect(quote?.theme).toContain('Wisdom');
    });
  });
});
