import { describe, it, expect } from 'vitest';
import { getWeekCurriculum, getDisciplineForWeek, getPassionWisdom } from './curriculum';

describe('getWeekCurriculum', () => {
  it('maps weeks 1–4 to their virtue and discipline', () => {
    expect(getWeekCurriculum(1)).toMatchObject({ virtue: 'Wisdom', discipline: 'Assent' });
    expect(getWeekCurriculum(2)).toMatchObject({ virtue: 'Courage', discipline: 'Desire' });
    expect(getWeekCurriculum(3)).toMatchObject({ virtue: 'Justice', discipline: 'Action' });
    expect(getWeekCurriculum(4)).toMatchObject({ virtue: 'Temperance', discipline: 'Desire' });
  });

  it('wraps out-of-range week numbers back into 1–4', () => {
    expect(getWeekCurriculum(5)).toEqual(getWeekCurriculum(1));
    expect(getWeekCurriculum(0)).toEqual(getWeekCurriculum(4));
    expect(getWeekCurriculum(8)).toEqual(getWeekCurriculum(4));
  });

  it('every entry carries a teaching, practice, and focus question', () => {
    for (const w of [1, 2, 3, 4]) {
      const c = getWeekCurriculum(w);
      expect(c.teaching.length).toBeGreaterThan(20);
      expect(c.practice.length).toBeGreaterThan(20);
      expect(c.focusQuestion.length).toBeGreaterThan(10);
    }
  });
});

describe('getDisciplineForWeek', () => {
  it('returns the discipline label', () => {
    expect(getDisciplineForWeek(1)).toBe('Assent');
    expect(getDisciplineForWeek(3)).toBe('Action');
  });
});

describe('getPassionWisdom', () => {
  it('returns an ancient maxim for a known passion', () => {
    const w = getPassionWisdom('anxiety');
    expect(w?.author).toBe('Seneca');
    expect(w?.maxim).toMatch(/imagination/);
  });

  it('returns null for an unknown passion', () => {
    expect(getPassionWisdom('nonexistent')).toBeNull();
  });
});
