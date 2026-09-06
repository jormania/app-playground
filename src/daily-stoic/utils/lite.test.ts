import { describe, it, expect } from 'vitest';
import { pickLiteRetrospective, weekDots, previousEntry, promptForDay, hasContent, REFLECTION_PROMPTS } from './lite';
import type { ReflectionRecord } from '../services/NotionService';

const rec = (quoteId: number, fateInput?: string): ReflectionRecord => ({
  id: `p${quoteId}`,
  date: '2026-01-01',
  quoteId,
  fateInput,
});

describe('pickLiteRetrospective', () => {
  it('returns null when nothing matches a lookback', () => {
    expect(pickLiteRetrospective([rec(99, 'a delay')], 200)).toBeNull();
  });

  it('finds the entry from 30 days ago', () => {
    const result = pickLiteRetrospective([rec(70, 'a missed train')], 100);
    expect(result?.daysAgo).toBe(30);
    expect(result?.record.fateInput).toBe('a missed train');
  });

  it('prefers the nearest lookback when several qualify', () => {
    const result = pickLiteRetrospective(
      [rec(10, 'the oldest'), rec(275, 'ninety'), rec(335, 'thirty')],
      365
    );
    expect(result?.daysAgo).toBe(30);
    expect(result?.record.fateInput).toBe('thirty');
  });

  it('falls through to 90 and 365 when the nearer days are empty', () => {
    expect(pickLiteRetrospective([rec(275, 'ninety')], 365)?.daysAgo).toBe(90);
    expect(pickLiteRetrospective([rec(1, 'a year ago')], 366)?.daysAgo).toBe(365);
  });

  it('skips records with no obstacle written', () => {
    expect(pickLiteRetrospective([rec(70), rec(70, '   ')], 100)).toBeNull();
  });

  it('ignores lookbacks that fall before the first day', () => {
    expect(pickLiteRetrospective([rec(-20, 'before time')], 10)).toBeNull();
  });
});

describe('hasContent', () => {
  it('counts anything the user wrote or tapped, and nothing else', () => {
    expect(hasContent(undefined)).toBe(false);
    expect(hasContent(rec(1))).toBe(false);
    expect(hasContent({ ...rec(1), text: '   ' })).toBe(false);
    expect(hasContent({ ...rec(1), mood: 'Good' })).toBe(true);
    expect(hasContent({ ...rec(1), text: 'wrote' })).toBe(true);
    expect(hasContent({ ...rec(1), fateInput: 'a delay' })).toBe(true);
    expect(hasContent({ ...rec(1), passions: ['impatience'] })).toBe(true);
  });
});

describe('weekDots', () => {
  it('covers the seven days of the cycle-week the day falls in', () => {
    expect(weekDots([], 10, false).map((d) => d.day)).toEqual([8, 9, 10, 11, 12, 13, 14]);
    expect(weekDots([], 1, false).map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weekDots([], 7, false).map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('fills a dot for each day that holds something', () => {
    const records = [{ ...rec(8), mood: 'Good' }, { ...rec(9), text: 'wrote' }, rec(11)];
    const dots = weekDots(records, 10, false);
    expect(dots.map((d) => d.logged)).toEqual([true, true, false, false, false, false, false]);
  });

  it('marks today and the days still to come', () => {
    const dots = weekDots([], 10, false);
    expect(dots.filter((d) => d.isToday).map((d) => d.day)).toEqual([10]);
    expect(dots.filter((d) => d.future).map((d) => d.day)).toEqual([11, 12, 13, 14]);
  });

  it("takes today's dot from the editor, not the fetched records", () => {
    expect(weekDots([], 10, true).find((d) => d.isToday)!.logged).toBe(true);
    expect(weekDots([{ ...rec(10), text: 'saved' }], 10, false).find((d) => d.isToday)!.logged).toBe(false);
  });
});

describe('previousEntry', () => {
  it('returns yesterday, preferring the reflection', () => {
    const result = previousEntry([{ ...rec(9), text: 'A quiet day.', fateInput: 'the rain' }], 10);
    expect(result).toEqual({ daysAgo: 1, text: 'A quiet day.' });
  });

  it('falls back to the obstacle when nothing was written', () => {
    expect(previousEntry([{ ...rec(9), fateInput: 'the rain' }], 10)?.text).toBe('the rain');
  });

  it('skips the Seneca headers a full-journal day carries', () => {
    const text = '### What caught my attention about myself today?\nI rushed everything.';
    expect(previousEntry([{ ...rec(9), text }], 10)?.text).toBe('I rushed everything.');
  });

  it('looks back over a gap, but only so far', () => {
    expect(previousEntry([{ ...rec(6), text: 'four days back' }], 10)?.daysAgo).toBe(4);
    expect(previousEntry([{ ...rec(2), text: 'too long ago' }], 10)).toBeNull();
  });

  it('ignores empty records and days before the first', () => {
    expect(previousEntry([rec(9)], 10)).toBeNull();
    expect(previousEntry([{ ...rec(-1), text: 'impossible' }], 1)).toBeNull();
  });
});

describe('promptForDay', () => {
  it('is stable for a day and advances when asked for another', () => {
    expect(promptForDay(3)).toBe(promptForDay(3));
    expect(promptForDay(3, 1)).not.toBe(promptForDay(3));
  });

  it('stays inside the list at any offset', () => {
    for (const [day, nudge] of [[0, 0], [-5, 0], [3, 40], [7, -3]]) {
      expect(REFLECTION_PROMPTS).toContain(promptForDay(day!, nudge));
    }
  });
});
