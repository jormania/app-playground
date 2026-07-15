import { describe, it, expect } from 'vitest';
import { buildDigestEntries, DigestEntry } from './digest';
import { computeCycleRetrospective } from './retrospective';
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

function markerSequence(entries: DigestEntry[]) {
  return entries
    .filter((e) => e.type !== 'day')
    .map((e) => (e.type === 'cycle' ? `cycle:${e.cycle}` : `week:${e.cycle}.${e.week}`));
}

describe('buildDigestEntries', () => {
  it('on day 1, emits only a single day entry with no week/cycle markers', () => {
    const entries = buildDigestEntries(1, CYCLE_START, [], []);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ type: 'day', day: 1 });
  });

  it('is newest-first: today comes before earlier days', () => {
    const entries = buildDigestEntries(3, CYCLE_START, [], []);
    const days = entries.filter((e) => e.type === 'day').map((e) => (e as any).day);
    expect(days).toEqual([3, 2, 1]);
  });

  it('does not emit a week marker for the current, still-open week', () => {
    // Day 7 is the last day of week 1, but it IS today — not yet complete.
    const entries = buildDigestEntries(7, CYCLE_START, [], []);
    expect(markerSequence(entries)).toEqual([]);
  });

  it('emits a week marker the day after that week completes, positioned above its last day', () => {
    // Day 8 is today; day 7 (week 1's last day) is now genuinely in the past.
    const entries = buildDigestEntries(8, CYCLE_START, [], []);
    expect(markerSequence(entries)).toEqual(['week:1.1']);

    const weekIdx = entries.findIndex((e) => e.type === 'week');
    const day7Idx = entries.findIndex((e) => e.type === 'day' && (e as any).day === 7);
    const day8Idx = entries.findIndex((e) => e.type === 'day' && (e as any).day === 8);
    expect(day8Idx).toBeLessThan(weekIdx);
    expect(weekIdx).toBeLessThan(day7Idx);
  });

  it('emits the cycle marker above its own week-4 marker when both complete simultaneously', () => {
    // Day 29 is today; day 28 completed both week 4 and cycle 1.
    const entries = buildDigestEntries(29, CYCLE_START, [], []);
    expect(markerSequence(entries)).toEqual([
      'cycle:1',
      'week:1.4',
      'week:1.3',
      'week:1.2',
      'week:1.1',
    ]);

    const cycleIdx = entries.findIndex((e) => e.type === 'cycle');
    const week4Idx = entries.findIndex((e) => e.type === 'week' && (e as any).week === 4);
    const day28Idx = entries.findIndex((e) => e.type === 'day' && (e as any).day === 28);
    expect(cycleIdx).toBeLessThan(week4Idx);
    expect(week4Idx).toBeLessThan(day28Idx);
  });

  it('produces exactly one day entry per day plus one marker per completed week/cycle', () => {
    const entries = buildDigestEntries(29, CYCLE_START, [], []);
    expect(entries.filter((e) => e.type === 'day')).toHaveLength(29);
    expect(entries.filter((e) => e.type === 'week')).toHaveLength(4);
    expect(entries.filter((e) => e.type === 'cycle')).toHaveLength(1);
    expect(entries).toHaveLength(34);
  });

  it('attaches the matching reflection to its day by quoteId, and null when absent', () => {
    const reflections = [makeReflection({ date: '2026-07-15', quoteId: 3, text: 'Day 3 thoughts' })];
    const entries = buildDigestEntries(3, CYCLE_START, reflections, []);
    const day3 = entries.find((e) => e.type === 'day' && (e as any).day === 3) as any;
    const day2 = entries.find((e) => e.type === 'day' && (e as any).day === 2) as any;
    expect(day3.reflection?.text).toBe('Day 3 thoughts');
    expect(day2.reflection).toBeNull();
  });

  it('week entries count only reflections within that week, without pulling other day content', () => {
    // Week 1 spans days 1-7 -> 2026-07-13..2026-07-19
    const reflections = [
      makeReflection({ date: '2026-07-13', quoteId: 1 }),
      makeReflection({ date: '2026-07-14', quoteId: 2 }),
      makeReflection({ date: '2026-07-20', quoteId: 8 }), // week 2, must not count
    ];
    const entries = buildDigestEntries(8, CYCLE_START, reflections, []);
    const week1Entry = entries.find((e) => e.type === 'week') as any;
    expect(week1Entry.loggedCount).toBe(2);
    expect(week1Entry.dateRange).toEqual({ start: '2026-07-13', end: '2026-07-19' });
  });

  it('cycle entries embed the same retrospective computeCycleRetrospective would produce', () => {
    const reflections = [makeReflection({ date: '2026-07-13', quoteId: 1, fateInput: 'reframed' })];
    const entries = buildDigestEntries(29, CYCLE_START, reflections, []);
    const cycleEntry = entries.find((e) => e.type === 'cycle') as any;
    expect(cycleEntry.retrospective).toEqual(
      computeCycleRetrospective(1, CYCLE_START, reflections, [])
    );
  });
});
