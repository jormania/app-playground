import { describe, it, expect } from 'vitest';
import { generateDeepInsights } from './analytics';

describe('analytics.js', () => {
  it('handles empty data', () => {
    const result = generateDeepInsights({ categories: [], transactions: [] });
    expect(result).toBeNull();
  });

  it('generates deep insights comparing two months', () => {
    const now = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const data = {
      categories: [
        { id: '1', name: 'Dining', type: 'Expense' },
        { id: '2', name: 'Subscriptions', type: 'Expense' }
      ],
      transactions: [
        { id: 't1', date: now.toISOString(), type: 'Expense', amount: 200, categoryId: '1' },
        { id: 't2', date: now.toISOString(), type: 'Expense', amount: 50, categoryId: '2' },
        { id: 't3', date: lastMonth.toISOString(), type: 'Expense', amount: 100, categoryId: '1' },
        { id: 't4', date: lastMonth.toISOString(), type: 'Expense', amount: 50, categoryId: '2' }
      ]
    };

    const result = generateDeepInsights(data, 'this_month');
    expect(result).toBeDefined();
    expect(result.financialHealth.totalExpense).toBe(250);
    expect(result.behavioral.spendingByCategoryChange).toBeDefined();
  });
});
