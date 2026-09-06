import { describe, it, expect } from 'vitest';
import { lifeProgress, questionForDay, LIFETIME_WEEKS, MEMENTO_QUESTIONS } from './lifetime';

describe('lifeProgress', () => {
  it('returns null without a birth date', () => {
    expect(lifeProgress('')).toBeNull();
  });

  it('returns null for an unparseable birth date', () => {
    expect(lifeProgress('not-a-date')).toBeNull();
  });

  it('counts whole weeks lived against the 80-year horizon', () => {
    const progress = lifeProgress('2000-01-01', new Date('2000-01-29T12:00:00Z'));
    expect(progress).not.toBeNull();
    expect(progress!.weeksLived).toBe(4);
    expect(progress!.totalWeeks).toBe(LIFETIME_WEEKS);
    expect(progress!.percentage).toBeCloseTo((4 / LIFETIME_WEEKS) * 100, 6);
  });

  it('agrees with the full grid on a mid-life date', () => {
    // The same arithmetic MementoMori.tsx runs for its 4,160 blocks.
    const birth = '1976-09-23';
    const now = new Date('2026-09-06T00:00:00Z');
    const expectedWeeks = Math.floor(
      (now.getTime() - new Date(birth).getTime()) / (1000 * 60 * 60 * 24 * 7)
    );
    expect(lifeProgress(birth, now)!.weeksLived).toBe(expectedWeeks);
  });

  it('clamps a life past the horizon to 100% rather than overflowing', () => {
    const progress = lifeProgress('1900-01-01', new Date('2026-01-01T00:00:00Z'));
    expect(progress!.percentage).toBe(100);
  });

  it('never reports negative weeks for a future birth date', () => {
    const progress = lifeProgress('2100-01-01', new Date('2026-01-01T00:00:00Z'));
    expect(progress!.weeksLived).toBe(0);
    expect(progress!.percentage).toBe(0);
  });
});

describe('questionForDay', () => {
  it('rotates through every question and wraps', () => {
    const seen = new Set<string>();
    for (let day = 1; day <= MEMENTO_QUESTIONS.length; day++) seen.add(questionForDay(day));
    expect(seen.size).toBe(MEMENTO_QUESTIONS.length);
    expect(questionForDay(1)).toBe(questionForDay(1 + MEMENTO_QUESTIONS.length));
  });

  it('is stable for the same day and safe at the edges', () => {
    expect(questionForDay(42)).toBe(questionForDay(42));
    expect(MEMENTO_QUESTIONS).toContain(questionForDay(0));
    expect(MEMENTO_QUESTIONS).toContain(questionForDay(-3));
  });
});
