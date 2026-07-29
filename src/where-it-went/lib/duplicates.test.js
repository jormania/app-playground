import { describe, it, expect } from 'vitest';
import {
  findDuplicateGroups,
  scorePair,
  descriptionSimilarity,
  normalizeDescription,
  groupKey,
  withoutDismissed,
  mergeFields,
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

  it('scores partial overlap between 0 and 1', () => {
    const s = descriptionSimilarity('Lidl groceries run', 'Lidl groceries');
    expect(s).toBeGreaterThan(0.6);
    expect(s).toBeLessThan(1);
  });

  it('is 0 for unrelated text', () => {
    expect(descriptionSimilarity('Netflix', 'Dentist')).toBe(0);
  });
});

describe('scorePair', () => {
  it('pairs an identical charge a day apart', () => {
    const score = scorePair(tx(), tx({ id: 't2', date: '2026-07-06' }));
    expect(score.confidence).toBe('high');
    expect(score.reason).toMatch(/1 day apart/);
  });

  it('refuses a different amount, however similar the rest', () => {
    expect(scorePair(tx(), tx({ id: 't2', amount: 60.01 }))).toBeNull();
  });

  it('refuses a gap wider than the window', () => {
    expect(scorePair(tx(), tx({ id: 't2', date: '2026-07-20' }))).toBeNull();
  });

  it('refuses unrelated descriptions', () => {
    expect(scorePair(tx(), tx({ id: 't2', description: 'Dentist' }))).toBeNull();
  });

  it('refuses to pair an Expense with an Income of the same amount', () => {
    expect(scorePair(tx(), tx({ id: 't2', type: 'Income' }))).toBeNull();
  });

  it('does not flag two same-day purchases in different categories', () => {
    // Two coffees at the same price on the same day are not a double-entry.
    const a = tx({ description: 'Coffee', categoryId: 'c_dining', amount: 15 });
    const b = tx({ id: 't2', description: 'Coffee shop', categoryId: 'c_food', amount: 15 });
    expect(scorePair(a, b)).toBeNull();
  });

  it('still flags a same-day, cross-category pair when the description is identical', () => {
    const a = tx({ description: 'Coffee', categoryId: 'c_dining', amount: 15 });
    const b = tx({ id: 't2', description: 'coffee', categoryId: 'c_food', amount: 15 });
    expect(scorePair(a, b)).not.toBeNull();
  });

  it('rates a different-account match as merely medium', () => {
    const score = scorePair(tx(), tx({ id: 't2', date: '2026-07-06', accountId: 'a2' }));
    expect(score.confidence).toBe('medium');
  });

  it('never pairs a row with itself', () => {
    expect(scorePair(tx(), tx())).toBeNull();
  });
});

describe('findDuplicateGroups', () => {
  it('finds the obvious double-entry', () => {
    const groups = findDuplicateGroups([
      tx({ id: 't1' }),
      tx({ id: 't2', date: '2026-07-06' }),
      tx({ id: 't3', description: 'Rent', amount: 2400, date: '2026-07-01' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].txs.map(t => t.id)).toEqual(['t1', 't2']);
    expect(groups[0].amount).toBe(60);
  });

  it('returns nothing for a clean ledger', () => {
    expect(findDuplicateGroups([
      tx({ id: 't1' }),
      tx({ id: 't2', description: 'Rent', amount: 2400 }),
    ])).toEqual([]);
  });

  it('puts each transaction in at most one group', () => {
    const groups = findDuplicateGroups([
      tx({ id: 't1', date: '2026-07-05' }),
      tx({ id: 't2', date: '2026-07-06' }),
      tx({ id: 't3', date: '2026-07-07' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].txs).toHaveLength(3);
  });

  it('orders high confidence before medium', () => {
    const groups = findDuplicateGroups([
      // medium: different account
      tx({ id: 'm1', description: 'Gym', amount: 150, date: '2026-06-01' }),
      tx({ id: 'm2', description: 'Gym', amount: 150, date: '2026-06-02', accountId: 'a2' }),
      // high: everything matches
      tx({ id: 'h1', description: 'Netflix', amount: 60, date: '2026-05-01' }),
      tx({ id: 'h2', description: 'Netflix', amount: 60, date: '2026-05-02' }),
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
    const groups = findDuplicateGroups([tx({ id: 't1' }), tx({ id: 't2', date: '2026-07-06' })]);
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
