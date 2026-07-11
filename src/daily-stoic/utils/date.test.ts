import { describe, it, expect } from 'vitest';
import { getDayOfYear, getQuoteForDay } from './date';
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
});
