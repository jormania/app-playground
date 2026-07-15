import { describe, it, expect } from 'vitest';
import { computeVirtueWeekStats, computeWeekdayStats, computeCurrentCycleHeatmap } from './stats';
import { ReflectionRecord } from '../services/NotionService';

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

describe('computeVirtueWeekStats', () => {
  it('buckets every day into its virtue-week slot regardless of cycle', () => {
    // today = 35 -> cycle 2, so week 1 (days 1-7 and 29-35) has 2 full cycles' worth partially.
    const stats = computeVirtueWeekStats([], 35);
    expect(stats).toHaveLength(4);
    expect(stats.map((s) => s.virtue)).toEqual(['Wisdom', 'Courage', 'Justice', 'Temperance']);
    // Week 1 (Wisdom): days 1-7 (cycle 1) + days 29-35 (cycle 2, partial) = 14 days total.
    expect(stats[0].totalDays).toBe(14);
    // Week 2 (Courage): days 8-14 only (cycle 2's week 2 hasn't started yet at day 35).
    expect(stats[1].totalDays).toBe(7);
  });

  it('computes consistency rate from logged vs total days in that slot', () => {
    const reflections = [
      makeReflection({ date: '2026-01-01', quoteId: 1 }),
      makeReflection({ date: '2026-01-02', quoteId: 2 }),
    ];
    const stats = computeVirtueWeekStats(reflections, 7); // week 1 only, 7 days total
    expect(stats[0].loggedDays).toBe(2);
    expect(stats[0].totalDays).toBe(7);
    expect(stats[0].consistencyRate).toBe(Math.round((2 / 7) * 100));
  });

  it('averages mood on a 5-point scale and ignores unrecognized values', () => {
    const reflections = [
      makeReflection({ date: '2026-01-01', quoteId: 1, mood: 'Great' }), // 5
      makeReflection({ date: '2026-01-02', quoteId: 2, mood: 'Bad' }), // 2
      makeReflection({ date: '2026-01-03', quoteId: 3, mood: 'Sideways' }), // unrecognized, ignored
    ];
    const stats = computeVirtueWeekStats(reflections, 7);
    expect(stats[0].avgMood).toBe(3.5); // (5 + 2) / 2
  });

  it('returns null avgMood when no mood data exists for that slot', () => {
    const stats = computeVirtueWeekStats([], 7);
    expect(stats[0].avgMood).toBeNull();
  });

  it('counts favorites per virtue-week slot', () => {
    const reflections = [
      makeReflection({ date: '2026-01-01', quoteId: 1, favorite: true }),
      makeReflection({ date: '2026-01-08', quoteId: 8, favorite: true }), // week 2
      makeReflection({ date: '2026-01-02', quoteId: 2, favorite: false }),
    ];
    const stats = computeVirtueWeekStats(reflections, 14);
    expect(stats[0].favoritesCount).toBe(1); // week 1
    expect(stats[1].favoritesCount).toBe(1); // week 2
  });
});

describe('computeWeekdayStats', () => {
  it('returns all 7 weekdays with zero counts for an empty history', () => {
    const stats = computeWeekdayStats([]);
    expect(stats).toHaveLength(7);
    expect(stats.every((s) => s.count === 0 && s.percentage === 0)).toBe(true);
  });

  it('tallies reflections by the weekday of their date field', () => {
    // 2026-07-13 is a Monday, 2026-07-14 is a Tuesday.
    const reflections = [
      makeReflection({ date: '2026-07-13', quoteId: 1 }),
      makeReflection({ date: '2026-07-13', quoteId: 2 }), // same weekday, different entry
      makeReflection({ date: '2026-07-14', quoteId: 3 }),
    ];
    const stats = computeWeekdayStats(reflections);
    const monday = stats.find((s) => s.label === 'Mon')!;
    const tuesday = stats.find((s) => s.label === 'Tue')!;
    expect(monday.count).toBe(2);
    expect(tuesday.count).toBe(1);
    expect(monday.percentage).toBe(67); // 2/3 rounded
  });

  it('ignores records with a missing or unparseable date', () => {
    const reflections = [
      makeReflection({ date: '', quoteId: 1 }),
      makeReflection({ date: 'not-a-date', quoteId: 2 }),
    ];
    const stats = computeWeekdayStats(reflections);
    expect(stats.every((s) => s.count === 0)).toBe(true);
  });
});

describe('computeCurrentCycleHeatmap', () => {
  it('returns exactly 28 cells scoped to the in-progress cycle', () => {
    const heatmap = computeCurrentCycleHeatmap([], 35); // cycle 2 (days 29-56)
    expect(heatmap).toHaveLength(28);
    expect(heatmap[0].day).toBe(29);
    expect(heatmap[27].day).toBe(56);
  });

  it('marks days after today as future, and matches logged/favorited flags', () => {
    const reflections = [makeReflection({ date: '2026-01-01', quoteId: 29, favorite: true })];
    const heatmap = computeCurrentCycleHeatmap(reflections, 30); // today = day 30, mid-cycle-2

    const day29 = heatmap.find((d) => d.day === 29)!;
    const day30 = heatmap.find((d) => d.day === 30)!;
    const day31 = heatmap.find((d) => d.day === 31)!;

    expect(day29.logged).toBe(true);
    expect(day29.favorited).toBe(true);
    expect(day29.isFuture).toBe(false);

    expect(day30.isFuture).toBe(false); // today itself is not "future"
    expect(day31.isFuture).toBe(true);
    expect(day31.logged).toBe(false);
  });
});
