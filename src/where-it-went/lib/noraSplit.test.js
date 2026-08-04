import { describe, it, expect } from 'vitest';
import { applyNoraSplit, parseNoraSplitGroup, stripNoraGroup } from './noraSplit';
import { scorePair } from './duplicates';

const CATEGORIES = [
  { id: 'dining', name: 'Dining', type: 'Expense' },
  { id: 'nora', name: 'Nora', type: 'Expense' },
];

describe('applyNoraSplit', () => {
  it('splits a 2-person "with Nora" purchase 50/50 into two transactions', () => {
    const tx = {
      id: 't1', description: 'Lunch at Japanos with Nora', amount: 132,
      date: '2026-08-02', type: 'Expense', categoryId: 'dining', accountId: 'a1',
    };
    const [yours, noras] = applyNoraSplit(tx, CATEGORIES);
    expect(yours.amount).toBe(66);
    expect(noras.amount).toBe(66);
    expect(noras.categoryId).toBe('nora');
    expect(yours.description).toBe('Lunch at Japanos');
  });

  it('marks the Nora row so an even split is never mistaken for a duplicate', () => {
    // A 50/50 split produces two rows with the same amount, same day and same
    // account — exactly what duplicate detection's same-day/identical-
    // description override is designed to catch across categories. Without a
    // distinguishing marker (mirroring the manual Split modal's "(Split)"
    // suffix) these were false-flagged as HIGH-confidence duplicates.
    const tx = {
      id: 't1', description: 'Lunch at Japanos with Nora', amount: 132,
      date: '2026-08-02', type: 'Expense', categoryId: 'dining', accountId: 'a1',
    };
    const [yours, noras] = applyNoraSplit(tx, CATEGORIES);
    const withIds = [{ ...yours, id: 'y1' }, { ...noras, id: 'n1' }];
    expect(scorePair(withIds[0], withIds[1])).toBeNull();
  });

  it('leaves a non-Nora transaction untouched', () => {
    const tx = { id: 't1', description: 'Groceries', amount: 200, date: '2026-08-02', type: 'Expense', categoryId: 'dining' };
    expect(applyNoraSplit(tx, CATEGORIES)).toEqual([tx]);
  });
});

describe('parseNoraSplitGroup / stripNoraGroup', () => {
  it('counts 3 people for "with Nora and Vio"', () => {
    expect(parseNoraSplitGroup('Dinner with Nora and Vio')).toEqual({ found: true, totalPeople: 3 });
  });

  it('strips the whole group from the description', () => {
    expect(stripNoraGroup('Dinner with Nora and Vio')).toBe('Dinner');
  });
});
