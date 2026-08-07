import { describe, it, expect } from 'vitest';
import {
  findDuplicateGroups,
  scorePair,
  descriptionSimilarity,
  normalizeDescription,
  buildHabitIndex,
  habitCount,
  groupKey,
  withoutDismissed,
  mergeFields,
  DEFAULT_DAY_WINDOW,
  HABITUAL_OCCURRENCES,
} from './duplicates';

const tx = (over = {}) => ({
  id: 't1', description: 'Netflix', date: '2026-07-05', amount: 60,
  type: 'Expense', categoryId: 'c1', accountId: 'a1', tags: [], notes: '', ...over,
});

describe('normalizeDescription', () => {
  it('strips diacritics, punctuation and case', () => {
    expect(normalizeDescription('Café  in Vienna!')).toBe('cafe in vienna');
  });

  it('is empty for nothing', () => {
    expect(normalizeDescription(null)).toBe('');
  });
});

describe('descriptionSimilarity', () => {
  it('is 1 for the same words however they were typed', () => {
    expect(descriptionSimilarity('Café in Vienna', 'cafe in vienna')).toBe(1);
  });

  it('is high when one contains the other', () => {
    expect(descriptionSimilarity('Netflix', 'Netflix subscription')).toBe(0.9);
  });

  it('is 0 for unrelated text', () => {
    expect(descriptionSimilarity('Netflix', 'Dentist')).toBe(0);
  });
});

describe('buildHabitIndex / habitCount', () => {
  it('counts the distinct days a vendor charged this exact amount', () => {
    const rows = [
      tx({ id: 'a', description: 'Metro', amount: 3, date: '2026-07-01' }),
      tx({ id: 'b', description: 'Metro', amount: 3, date: '2026-07-02' }),
      tx({ id: 'c', description: 'Metro', amount: 3, date: '2026-07-03' }),
      tx({ id: 'd', description: 'Metro', amount: 9, date: '2026-07-04' }),
    ];
    const index = buildHabitIndex(rows);
    expect(habitCount(index, rows[0])).toBe(3);
    expect(habitCount(index, rows[3])).toBe(1);
  });

  it('counts two charges on the same day as one day', () => {
    const rows = [
      tx({ id: 'a', description: 'Metro', amount: 3, date: '2026-07-01' }),
      tx({ id: 'b', description: 'Metro', amount: 3, date: '2026-07-01' }),
    ];
    expect(habitCount(buildHabitIndex(rows), rows[0])).toBe(1);
  });
});

describe('scorePair', () => {
  it('rates a same-day, same-vendor, same-card repeat as high', () => {
    // The strongest tell there is, and the one the brief called out.
    const score = scorePair(tx(), tx({ id: 't2' }));
    expect(score.confidence).toBe('high');
    expect(score.reason).toMatch(/same day/);
  });

  it('rates a next-day repeat as no better than medium', () => {
    // Crossing a date boundary is a suggestion, not an assertion.
    const score = scorePair(tx(), tx({ id: 't2', date: '2026-07-06' }));
    expect(score.confidence).toBe('medium');
  });

  it('refuses a different amount, however similar the rest', () => {
    expect(scorePair(tx(), tx({ id: 't2', amount: 60.01 }))).toBeNull();
  });

  it('refuses a two-day gap by default', () => {
    // A commute charged the same fare on Monday and Wednesday is not a
    // double-entry; the window used to be 3 days and flagged exactly that.
    expect(DEFAULT_DAY_WINDOW).toBe(1);
    expect(scorePair(tx(), tx({ id: 't2', date: '2026-07-07' }))).toBeNull();
  });

  it('refuses unrelated descriptions', () => {
    expect(scorePair(tx(), tx({ id: 't2', description: 'Dentist' }))).toBeNull();
  });

  it('refuses to pair an Expense with an Income of the same amount', () => {
    expect(scorePair(tx(), tx({ id: 't2', type: 'Income' }))).toBeNull();
  });

  it('refuses a cross-day pair filed under different categories', () => {
    // Filed differently at the time means they were understood as different
    // purchases.
    const a = tx({ categoryId: 'c_dining' });
    const b = tx({ id: 't2', date: '2026-07-06', categoryId: 'c_food' });
    expect(scorePair(a, b)).toBeNull();
  });

  it('never flags a cross-category pair, even same-day with an identical description', () => {
    // This used to be an override ("must be a miscategorised re-entry"), but a
    // deliberate split (Nora's share vs. yours, a manual Split) produces this
    // exact shape on purpose — same day, same description, different category
    // — and the two cases are indistinguishable from these fields alone.
    const a = tx({ categoryId: 'c_dining' });
    const b = tx({ id: 't2', categoryId: 'c_food' });
    expect(scorePair(a, b)).toBeNull();
  });

  it('drops a cross-day pair whose amount is a regular charge for that vendor', () => {
    // The coffee/metro case: a fixed price repeats by nature, so an exact
    // amount match says nothing.
    const rows = [
      tx({ id: 'a', description: 'Metro', amount: 3, date: '2026-07-01' }),
      tx({ id: 'b', description: 'Metro', amount: 3, date: '2026-07-02' }),
      tx({ id: 'c', description: 'Metro', amount: 3, date: '2026-07-09' }),
    ];
    const habitIndex = buildHabitIndex(rows);
    expect(habitCount(habitIndex, rows[0])).toBeGreaterThanOrEqual(HABITUAL_OCCURRENCES);
    expect(scorePair(rows[0], rows[1], { habitIndex })).toBeNull();
  });

  it('drops a same-day repeat of a habitual amount too — two fares in one day is normal, not a slip', () => {
    // A fixed-price habitual charge (a bus fare, a daily coffee) can legitimately
    // happen twice in one day; nothing about landing on the same day tells you
    // that's a mistake rather than a second, real purchase.
    const rows = [
      tx({ id: 'a', description: 'Metro', amount: 3, date: '2026-07-01' }),
      tx({ id: 'b', description: 'Metro', amount: 3, date: '2026-07-01' }),
      tx({ id: 'c', description: 'Metro', amount: 3, date: '2026-07-05' }),
      tx({ id: 'd', description: 'Metro', amount: 3, date: '2026-07-09' }),
    ];
    const habitIndex = buildHabitIndex(rows);
    expect(scorePair(rows[0], rows[1], { habitIndex })).toBeNull();
  });

  it('keeps a cross-day pair when the vendor rarely charges that exact amount', () => {
    // A taxi landing on the identical fare twice is a real coincidence — the
    // case the brief singled out as worth surfacing.
    const rows = [
      tx({ id: 'a', description: 'Uber/Bolt', amount: 39, date: '2026-07-01', categoryId: 'c_transport' }),
      tx({ id: 'b', description: 'Uber/Bolt', amount: 39, date: '2026-07-02', categoryId: 'c_transport' }),
      tx({ id: 'c', description: 'Uber/Bolt', amount: 22, date: '2026-07-05', categoryId: 'c_transport' }),
      tx({ id: 'd', description: 'Uber/Bolt', amount: 51, date: '2026-07-09', categoryId: 'c_transport' }),
    ];
    const score = scorePair(rows[0], rows[1], { habitIndex: buildHabitIndex(rows) });
    expect(score).not.toBeNull();
    expect(score.confidence).toBe('medium');
  });

  it('never pairs a row with itself', () => {
    expect(scorePair(tx(), tx())).toBeNull();
  });
});

describe('findDuplicateGroups', () => {
  it('finds a same-day double entry and rates it high', () => {
    const groups = findDuplicateGroups([
      tx({ id: 't1' }),
      tx({ id: 't2' }),
      tx({ id: 't3', description: 'Rent', amount: 2400, date: '2026-07-01' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].confidence).toBe('high');
    expect(groups[0].txs.map(t => t.id)).toEqual(['t1', 't2']);
  });

  it('returns nothing for a clean ledger', () => {
    expect(findDuplicateGroups([
      tx({ id: 't1' }),
      tx({ id: 't2', description: 'Rent', amount: 2400 }),
    ])).toEqual([]);
  });

  it('leaves a habitual fixed-price purchase alone across days', () => {
    const rows = [
      tx({ id: 'a', description: 'Coffee', amount: 17, date: '2026-07-01', categoryId: 'c_dining' }),
      tx({ id: 'b', description: 'Coffee', amount: 17, date: '2026-07-02', categoryId: 'c_dining' }),
      tx({ id: 'c', description: 'Coffee', amount: 17, date: '2026-07-03', categoryId: 'c_dining' }),
    ];
    expect(findDuplicateGroups(rows)).toEqual([]);
  });

  it('puts each transaction in at most one group', () => {
    const groups = findDuplicateGroups([
      tx({ id: 't1', date: '2026-07-05' }),
      tx({ id: 't2', date: '2026-07-05' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].txs).toHaveLength(2);
  });

  it('orders high confidence before medium', () => {
    const groups = findDuplicateGroups([
      // medium: a day apart
      tx({ id: 'm1', description: 'Gym', amount: 150, date: '2026-06-01' }),
      tx({ id: 'm2', description: 'Gym', amount: 150, date: '2026-06-02' }),
      // high: same day, same card
      tx({ id: 'h1', description: 'Netflix', amount: 60, date: '2026-05-01' }),
      tx({ id: 'h2', description: 'Netflix', amount: 60, date: '2026-05-01' }),
    ]);
    expect(groups.map(g => g.confidence)).toEqual(['high', 'medium']);
  });

  it('ignores rows without an id or a usable amount', () => {
    expect(findDuplicateGroups([
      tx({ id: null }), tx({ id: 't2', amount: NaN }), tx({ id: 't3' }),
    ])).toEqual([]);
  });

  it('survives empty input', () => {
    expect(findDuplicateGroups(null)).toEqual([]);
    expect(findDuplicateGroups([])).toEqual([]);
  });
});

describe('groupKey / withoutDismissed', () => {
  it('is stable regardless of member order', () => {
    const a = { txs: [{ id: 'x' }, { id: 'y' }] };
    const b = { txs: [{ id: 'y' }, { id: 'x' }] };
    expect(groupKey(a)).toBe(groupKey(b));
  });

  it('filters out a dismissed group', () => {
    const groups = findDuplicateGroups([tx({ id: 't1' }), tx({ id: 't2' })]);
    expect(withoutDismissed(groups, [groupKey(groups[0])])).toEqual([]);
    expect(withoutDismissed(groups, [])).toHaveLength(1);
  });
});

describe('mergeFields', () => {
  it('fills only the gaps on the survivor', () => {
    const survivor = tx({ notes: '', tripId: '', tags: ['A'] });
    const duplicate = tx({ id: 't2', notes: 'paid in cash', tripId: 'trip1', tags: ['B'] });
    expect(mergeFields(survivor, duplicate)).toEqual({
      notes: 'paid in cash', tripId: 'trip1', tags: ['A', 'B'],
    });
  });

  it('never overwrites something the survivor already has', () => {
    const survivor = tx({ notes: 'mine', tripId: 'trip1' });
    const duplicate = tx({ id: 't2', notes: 'theirs', tripId: 'trip2' });
    expect(mergeFields(survivor, duplicate)).toEqual({});
  });

  it('carries the foreign amount across with its currency', () => {
    const survivor = tx({ originalAmount: null, originalCurrency: '' });
    const duplicate = tx({ id: 't2', originalAmount: 8.5, originalCurrency: 'EUR' });
    expect(mergeFields(survivor, duplicate)).toMatchObject({ originalAmount: 8.5, originalCurrency: 'EUR' });
  });
});
