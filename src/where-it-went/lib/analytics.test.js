import { describe, it, expect } from 'vitest';
import { generateInsights } from './analytics';

describe('analytics.js', () => {
  it('handles empty data', () => {
    const result = generateInsights({ categories: [], transactions: [] });
    expect(result.review).toBe('Not enough data to generate a review this month.');
    expect(result.insights).toEqual([]);
    expect(result.question).toBeUndefined();
  });

  it('generates a review comparing two months', () => {
    const now = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const data = {
      categories: [
        { id: '1', name: 'Dining' },
        { id: '2', name: 'Subscriptions' }
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
    expect(result.review).toContain('You spent 67% more than last month.');
    expect(result.review).toContain('Dining was your largest discretionary category.');
    
    // Dining spending increased from 100 to 200 -> 100% increase
    expect(result.insights).toContain('Dining spending increased 100% compared to last month.');
    
    // Subscriptions total 50
    expect(result.insights).toContain('Subscriptions total 50.00 RON/month.');
  });
});
