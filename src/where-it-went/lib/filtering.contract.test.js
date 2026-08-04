/**
 * `lib/filtering.js` (Dashboard, the ledger) and `lib/analytics/index.js`'s own
 * copy (Insights) exist because the period-filter logic already drifted once
 * (see WHERE_IT_WENT.md's 2026-07-29 audit) and the type/search filter drifted
 * a second time — Insights kept reading `filterType` correctly while the other
 * two silently regressed to destructuring `filter`, a key nobody ever passed.
 * This test runs identical input through both and asserts identical output, so
 * a future edit to one without the other fails here instead of shipping.
 */
import { describe, it, expect } from 'vitest';
import { applyFilters as applyFiltersLedger } from './filtering';
import { applyFilters as applyFiltersInsights } from './analytics/index';

const categoriesById = new Map([
  ['cat-groceries', { id: 'cat-groceries', name: 'Groceries' }],
  ['cat-salary', { id: 'cat-salary', name: 'Salary' }],
]);
const accountsById = new Map([
  ['acc-cash', { id: 'acc-cash', name: 'Cash' }],
  ['acc-revolut', { id: 'acc-revolut', name: 'Revolut' }],
]);

const transactions = [
  { id: '1', type: 'Income', amount: 3000, description: 'Salary', categoryId: 'cat-salary', accountId: 'acc-revolut', notes: '' },
  { id: '2', type: 'Expense', amount: 45, description: 'Mega Image run', categoryId: 'cat-groceries', accountId: 'acc-cash', notes: 'weekly shop' },
  { id: '3', type: 'Transfer', amount: 200, description: 'Cash top-up', categoryId: '', accountId: 'acc-revolut', notes: '' },
];

const cases = [
  { filterType: 'All', categoryFilter: 'All', searchQuery: '' },
  { filterType: 'Income', categoryFilter: 'All', searchQuery: '' },
  { filterType: 'Expense', categoryFilter: 'All', searchQuery: '' },
  { filterType: 'Transfer', categoryFilter: 'All', searchQuery: '' },
  { filterType: 'All', categoryFilter: 'cat-groceries', searchQuery: '' },
  { filterType: 'All', categoryFilter: 'All', searchQuery: 'mega' },
  { filterType: 'All', categoryFilter: 'All', searchQuery: 'revolut' },
  { filterType: 'All', categoryFilter: 'All', searchQuery: 'weekly' },
  { filterType: 'All', categoryFilter: 'All', searchQuery: '45' },
  { filterType: 'Expense', categoryFilter: 'cat-groceries', searchQuery: 'shop' },
];

describe('lib/filtering.js and lib/analytics/index.js applyFilters stay in step', () => {
  it.each(cases)('matches for %j', (filterProps) => {
    const ledgerResult = applyFiltersLedger(transactions, filterProps, categoriesById, accountsById).map(t => t.id);
    const insightsResult = applyFiltersInsights(transactions, categoriesById, accountsById, filterProps).map(t => t.id);
    expect(ledgerResult).toEqual(insightsResult);
  });
});
