import { describe, it, expect } from 'vitest';
import { computeCycleRetrospective, Worry } from './retrospective';
import { ReflectionRecord } from '../services/NotionService';

const CYCLE_START = '2026-07-13'; // a Monday

function makeReflection(overrides: Partial<ReflectionRecord> & { date: string; quoteId: number }): ReflectionRecord {
  return {
    text: '',
    fateInput: '',
    acceptanceTags: [],
    favorite: false,
    mood: '',
    morningIntentions: '',
    passions: [],
    createdTime: '',
    dichotomy: '',
    virtue: '',
    ...overrides,
  };
}

describe('computeCycleRetrospective', () => {
  it('scopes stats to the requested cycle only, ignoring reflections outside its date range', () => {
    const reflections = [
      // Cycle 1: days 1-28 -> 2026-07-13 .. 2026-08-09
      makeReflection({ date: '2026-07-13', quoteId: 1, fateInput: 'reframed' }),
      makeReflection({ date: '2026-07-20', quoteId: 8 }),
      // Cycle 2: days 29-56 -> 2026-08-10 onward — must NOT count toward cycle 1
      makeReflection({ date: '2026-08-10', quoteId: 29, fateInput: 'reframed' }),
    ];

    const result = computeCycleRetrospective(1, CYCLE_START, reflections, []);

    expect(result.cycleNumber).toBe(1);
    expect(result.dateRange).toEqual({ start: '2026-07-13', end: '2026-08-09' });
    expect(result.loggedCount).toBe(2);
    expect(result.consistencyRate).toBe(Math.round((2 / 28) * 100));
    expect(result.reframingsCount).toBe(1);
  });

  it('counts passions across the cycle window', () => {
    const reflections = [
      makeReflection({ date: '2026-07-14', quoteId: 2, passions: ['fear', 'anger'] }),
      makeReflection({ date: '2026-07-15', quoteId: 3, passions: ['envy'] }),
    ];

    const result = computeCycleRetrospective(1, CYCLE_START, reflections, []);
    expect(result.passionsCount).toBe(3);
  });

  it('scopes worries by createdAt within the cycle range and computes resolution rate', () => {
    const worries: Worry[] = [
      { id: 'a', text: 'in-cycle resolved', category: 'up-to-me', isResolved: true, createdAt: '2026-07-15' },
      { id: 'b', text: 'in-cycle unresolved', category: 'up-to-me', isResolved: false, createdAt: '2026-07-20' },
      { id: 'c', text: 'out-of-cycle', category: 'up-to-me', isResolved: true, createdAt: '2026-08-15' },
    ];

    const result = computeCycleRetrospective(1, CYCLE_START, [], worries);
    expect(result.worriesStats).toEqual({ total: 2, resolved: 1, rate: 50 });
  });

  it('treats worries with no createdAt as always in-range', () => {
    const worries: Worry[] = [{ id: 'a', text: 'undated', category: 'up-to-me', isResolved: true }];
    const result = computeCycleRetrospective(1, CYCLE_START, [], worries);
    expect(result.worriesStats).toEqual({ total: 1, resolved: 1, rate: 100 });
  });

  it('caps consistencyRate at 100 and returns zeroed stats for an empty cycle', () => {
    const result = computeCycleRetrospective(3, CYCLE_START, [], []);
    expect(result.loggedCount).toBe(0);
    expect(result.consistencyRate).toBe(0);
    expect(result.reframingsCount).toBe(0);
    expect(result.passionsCount).toBe(0);
    expect(result.worriesStats).toEqual({ total: 0, resolved: 0, rate: 0 });
  });

  it('computes the correct date range for a later cycle number', () => {
    // Cycle 3: days 57-84
    const result = computeCycleRetrospective(3, CYCLE_START, [], []);
    expect(result.dateRange).toEqual({ start: '2026-09-07', end: '2026-10-04' });
  });
});
