import { describe, it, expect } from 'vitest';
import { generateInsights } from './analytics';

describe('analytics.js', () => {
  it('handles empty data', () => {
    const result = generateInsights({ categories: [], transactions: [] });
    expect(result.highlights).toEqual([]);
    expect(result.expenses.increases).toEqual([]);
    expect(result.expenses.decreases).toEqual([]);
    expect(result.expenses.subscriptions).toEqual([]);
    expect(result.expenses.utilities).toEqual([]);
    expect(result.expenses.otherRecurring).toEqual([]);
    expect(result.expenses.investing).toEqual([]);
  });

  it('generates a review comparing two months', () => {
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

    const result = generateInsights(data);
    
    // Total exp last month = 150. Total exp this month = 250.
    // 250 / 150 = 1.666 -> spent 67% more
    const spendingTrend = result.highlights.find(h => h.title === 'Spending Trend');
    expect(spendingTrend).toBeDefined();
    expect(spendingTrend.value).toContain('67% More');
    
    const topDiscretionary = result.highlights.find(h => h.title === 'Top Discretionary');
    expect(topDiscretionary).toBeDefined();
    expect(topDiscretionary.value).toBe('Dining');
    
    // Dining spending increased from 100 to 200
    expect(result.expenses.increases).toContain('Dining spending increased by 100% compared to last month.');
    
    // Subscriptions total 50. Since it's a twistie now, it returns an object.
    const subsTwistie = result.expenses.subscriptions.find(o => typeof o === 'object' && o.title.includes('Subscriptions Total'));
    expect(subsTwistie).toBeDefined();
    expect(subsTwistie.title).toContain('50 RON');
  });
});
