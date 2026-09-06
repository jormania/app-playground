import { describe, it, expect } from 'vitest';
import { pickLiteRetrospective } from './lite';
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
