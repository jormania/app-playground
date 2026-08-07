import { describe, it, expect } from 'vitest';
import { applyFilters } from './filtering';

const categoriesById = new Map([
  ['cat-groceries', { id: 'cat-groceries', name: 'Groceries' }],
]);
const accountsById = new Map([
  ['acc-cash', { id: 'acc-cash', name: 'Cash' }],
]);

const income = { id: '1', type: 'Income', amount: 100, description: 'Salary', categoryId: '', accountId: 'acc-cash', notes: '' };
const expense = { id: '2', type: 'Expense', amount: 50, description: 'Groceries', categoryId: 'cat-groceries', accountId: 'acc-cash', notes: '' };

describe('applyFilters', () => {
  // The real shape App.jsx builds and passes as `filterProps` — every call
  // site destructures `filterType`, not `filter`. A previous version of this
  // module destructured `filter` instead, so the type filter silently matched
  // nothing was passed and every row always came back regardless of the
  // selected type.
  it('filters by filterType (the key every caller actually passes)', () => {
    const result = applyFilters([income, expense], { filterType: 'Income', categoryFilter: 'All', searchQuery: '' }, categoriesById, accountsById);
    expect(result.map(t => t.id)).toEqual(['1']);
  });

  it('returns everything for filterType "All"', () => {
    const result = applyFilters([income, expense], { filterType: 'All', categoryFilter: 'All', searchQuery: '' }, categoriesById, accountsById);
    expect(result).toHaveLength(2);
  });

  it('ignores an unrelated "filter" key — it is not the contract', () => {
    // Guards against silently reintroducing the old destructured name.
    const result = applyFilters([income, expense], { filter: 'Income', categoryFilter: 'All', searchQuery: '' }, categoriesById, accountsById);
    expect(result).toHaveLength(2);
  });

  it('filters by category', () => {
    const result = applyFilters([income, expense], { filterType: 'All', categoryFilter: 'cat-groceries', searchQuery: '' }, categoriesById, accountsById);
    expect(result.map(t => t.id)).toEqual(['2']);
  });

  it('searches description, category, account, notes and amount', () => {
    expect(applyFilters([expense], { searchQuery: 'groceries' }, categoriesById, accountsById)).toHaveLength(1);
    expect(applyFilters([expense], { searchQuery: 'cash' }, categoriesById, accountsById)).toHaveLength(1);
    expect(applyFilters([expense], { searchQuery: '50' }, categoriesById, accountsById)).toHaveLength(1);
    expect(applyFilters([expense], { searchQuery: 'nothing-matches' }, categoriesById, accountsById)).toHaveLength(0);
  });

  it('combines type, category and search', () => {
    const result = applyFilters(
      [income, expense],
      { filterType: 'Expense', categoryFilter: 'cat-groceries', searchQuery: 'grocer' },
      categoriesById,
      accountsById,
    );
    expect(result.map(t => t.id)).toEqual(['2']);
  });

  it('unreconciledOnly drops any transaction already marked reconciled', () => {
    const reconciled = { ...expense, id: '3', reconciled: true };
    const result = applyFilters(
      [income, expense, reconciled],
      { filterType: 'All', categoryFilter: 'All', searchQuery: '', unreconciledOnly: true },
      categoriesById,
      accountsById,
    );
    expect(result.map(t => t.id)).toEqual(['1', '2']);
  });

  it('unreconciledOnly is a no-op when off, reconciled or not', () => {
    const reconciled = { ...expense, id: '3', reconciled: true };
    const result = applyFilters(
      [income, expense, reconciled],
      { filterType: 'All', categoryFilter: 'All', searchQuery: '', unreconciledOnly: false },
      categoriesById,
      accountsById,
    );
    expect(result).toHaveLength(3);
  });
});
