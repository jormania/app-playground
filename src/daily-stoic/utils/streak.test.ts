import { describe, it, expect } from 'vitest';
import { calculateStreak } from './streak';

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
