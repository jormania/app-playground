import { describe, it, expect } from 'vitest';
import { generateDeepInsights } from './analytics';

// A fixed clock passed explicitly to generateDeepInsights — the old test built
// "last month" with `setMonth(m - 1)`, which rolls into the *current* month on
// the 31st of any month following a 30-day month (Jul 31 → Jun 31 → Jul 1),
// silently inflating totalExpense on five specific calendar days a year.
const NOW = new Date(2026, 6, 15); // 15 Jul 2026, well clear of any month-end edge

function lastMonth(day = 15) {
  return new Date(2026, 5, day); // 15 Jun 2026
}

const CATEGORIES = [
  { id: '1', name: 'Dining', type: 'Expense' },
  { id: '2', name: 'Subscriptions', type: 'Expense' },
  { id: '3', name: 'Salary', type: 'Income' }
];

describe('generateDeepInsights', () => {
  it('returns null for a dataset with no transactions at all', () => {
    expect(generateDeepInsights({ categories: [], transactions: [] })).toBeNull();
  });

  it('returns null when the selected period has no transactions, instead of NaN%', () => {
    const data = {
      categories: CATEGORIES,
      transactions: [{ id: 't1', date: '2020-01-01', type: 'Expense', amount: 50, categoryId: '1' }]
    };
    expect(generateDeepInsights(data, 'this_month', null, NOW)).toBeNull();
  });

  it('compares two months using an injected clock', () => {
    const data = {
      categories: CATEGORIES,
      transactions: [
        { id: 't1', date: NOW.toISOString(), type: 'Expense', amount: 200, categoryId: '1' },
        { id: 't2', date: NOW.toISOString(), type: 'Expense', amount: 50, categoryId: '2' },
        { id: 't3', date: lastMonth().toISOString(), type: 'Expense', amount: 100, categoryId: '1' },
        { id: 't4', date: lastMonth().toISOString(), type: 'Expense', amount: 50, categoryId: '2' }
      ]
    };

    const result = generateDeepInsights(data, 'this_month', null, NOW);
    expect(result).toBeDefined();
    expect(result.financialHealth.totalExpense).toBe(250);
    expect(result.behavioral.spendingByCategoryChange).toBeDefined();
  });

  it('reads notes when classifying travel/property/family spending (previously never fetched)', () => {
    const data = {
      categories: [{ id: 'travel', name: 'Travel', type: 'Expense' }],
      transactions: [
        // description alone gives no hint; the note is what identifies it as a hotel stay
        { id: 't1', date: NOW.toISOString(), type: 'Expense', amount: 600, categoryId: 'travel', description: 'Booking ref 88213', notes: 'Hotel stay in Lisbon' }
      ]
    };
    const result = generateDeepInsights(data, 'this_month', null, NOW);
    expect(result.behavioral.travelAnalysis.breakdown.accommodation).toBe(600);
  });

  it('does not let a short exact-word keyword misfire as a substring ("bar" inside "Barcelona")', () => {
    const data = {
      categories: [{ id: 'travel', name: 'Travel', type: 'Expense' }],
      transactions: [
        // Naive `text.includes('bar')` used to route this into Dining via
        // "Barcelona"; there is no dining keyword here, only the whole word "tour".
        { id: 't1', date: NOW.toISOString(), type: 'Expense', amount: 80, categoryId: 'travel', description: 'Barcelona walking tour' }
      ]
    };
    const result = generateDeepInsights(data, 'this_month', null, NOW);
    const { breakdown } = result.behavioral.travelAnalysis;
    expect(breakdown.dining).toBe(0);
    expect(breakdown.activities).toBe(80);
  });

  it('does not let "=ac" (air conditioning) misfire as a substring inside "contract"', () => {
    const data = {
      categories: [{ id: 'prop', name: 'Property', type: 'Expense' }],
      transactions: [
        // "contract" contains the substring "ac" — the old naive matcher flagged
        // this as an air-conditioning repair.
        { id: 't1', date: NOW.toISOString(), type: 'Expense', amount: 400, categoryId: 'prop', description: 'Signed a new gardening contract' }
      ]
    };
    const result = generateDeepInsights(data, 'this_month', null, NOW);
    const { breakdown } = result.behavioral.propertyAnalysis;
    expect(breakdown.maintenance).toBe(0);
    expect(breakdown.other).toBe(400);
  });

  it('does not count money moved into savings/investing as consumption in the savings rate', () => {
    const data = {
      categories: [
        { id: 'inv', name: 'Investing', type: 'Expense' },
        { id: 'sal', name: 'Salary', type: 'Income' }
      ],
      transactions: [
        { id: 't1', date: NOW.toISOString(), type: 'Income', amount: 1000, categoryId: 'sal' },
        { id: 't2', date: NOW.toISOString(), type: 'Expense', amount: 300, categoryId: 'inv' }
      ]
    };
    const result = generateDeepInsights(data, 'this_month', null, NOW);
    // Nothing was actually consumed — the only "expense" was a transfer into
    // Investing — so every leu of income is still retained. Before this fix the
    // 300 counted as ordinary spending and the rate read 70%, i.e. saving money
    // *lowered* the reported savings rate.
    expect(result.financialHealth.savingsRate).toBeCloseTo(1, 5);
    expect(result.financialHealth.spendingExpense).toBe(0);
  });

  it('excludes Transfer transactions from income, expense, and every derived total', () => {
    const data = {
      categories: [{ id: 'sal', name: 'Salary', type: 'Income' }],
      transactions: [
        { id: 't1', date: NOW.toISOString(), type: 'Income', amount: 1000, categoryId: 'sal' },
        // Moving money to another of the user's own accounts — not income or spend.
        { id: 't2', date: NOW.toISOString(), type: 'Transfer', amount: 500, categoryId: '' }
      ]
    };
    const result = generateDeepInsights(data, 'this_month', null, NOW);
    expect(result.financialHealth.totalIncome).toBe(1000);
    expect(result.financialHealth.totalExpense).toBe(0);
    expect(result.financialHealth.savingsRate).toBeCloseTo(1, 5);
  });
});
