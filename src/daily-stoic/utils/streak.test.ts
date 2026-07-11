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

  it('handles leap year wrap-around (Day 1 follows Day 366)', () => {
    const days = new Set([365, 366, 1]);
    expect(calculateStreak(days, 1)).toBe(3);
  });

  it('handles leap year wrap-around ending yesterday', () => {
    const days = new Set([365, 366]);
    expect(calculateStreak(days, 1)).toBe(2);
  });
});
