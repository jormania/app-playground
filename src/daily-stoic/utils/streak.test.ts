import { describe, it, expect } from 'vitest';
import { calculateStreak, calculateLongestStreak } from './streak';

describe('calculateStreak', () => {
  it('returns 0 when no reflections exist', () => {
    expect(calculateStreak(new Set(), 10)).toBe(0);
  });

  it('returns 0 if last reflection was before yesterday', () => {
    const days = new Set([5, 6, 7]);
    expect(calculateStreak(days, 10)).toBe(0);
  });

  it('calculates streak ending today', () => {
    const days = new Set([8, 9, 10]);
    expect(calculateStreak(days, 10)).toBe(3);
  });

  it('calculates streak ending yesterday', () => {
    const days = new Set([8, 9]);
    expect(calculateStreak(days, 10)).toBe(2);
  });

  it('does not wrap around at any fixed day count (day numbers are unbounded)', () => {
    // Day numbers are an unbounded count since cycleStartDate — day 400 is a
    // real day, not a wrapped "day 34". A gap right before day 1 must not
    // register as connected to some high day number the way the old
    // 365/366-wrapping implementation would have.
    const days = new Set([398, 399, 400]);
    expect(calculateStreak(days, 400)).toBe(3);
    expect(calculateStreak(new Set([1]), 1)).toBe(1);
  });
});

describe('calculateLongestStreak', () => {
  it('returns 0 when no reflections exist', () => {
    expect(calculateLongestStreak(new Set())).toBe(0);
  });

  it('returns the longest run, even if it is not the most recent one', () => {
    // A 4-day run early on, then a gap, then a 2-day run at the end.
    const days = new Set([1, 2, 3, 4, 10, 11]);
    expect(calculateLongestStreak(days)).toBe(4);
  });

  it('is unaffected by insertion order', () => {
    const days = new Set([50, 12, 13, 11, 49]);
    expect(calculateLongestStreak(days)).toBe(3);
  });

  it('treats a single logged day as a streak of 1', () => {
    expect(calculateLongestStreak(new Set([7]))).toBe(1);
  });
});
