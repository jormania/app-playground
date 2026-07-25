// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import InsightsView from './InsightsView';

// Mock generateDeepInsights algorithm
vi.mock('../lib/analytics', () => ({
  generateDeepInsights: vi.fn((data) => {
    if (!data.transactions || data.transactions.length === 0) {
      return null;
    }
    return {
      financialHealth: {
        totalExpense: 1000,
        totalIncome: 2000,
        netCashFlow: 1000,
        savingsRate: 0.5,
        fixedCostsRatio: 0.3,
        investmentRate: 0.2,
        overviews: { taxes: 100, property: 200 },
        needsWantsSavings: { needs: 500, wants: 300, savings: 200 },
        catSums: { '1': { id: '1', name: 'Dining', type: 'Expense', total: 1000 } }
      },
      behavioral: {
        frequentSpending: [{ desc: 'Coffee', count: 5, avg: 20, total: 100 }],
        subscriptions: [{ name: 'Netflix', total: 50 }],
        spendingByCategoryChange: [{ name: 'Dining', current: 200, prev: 100, pctChange: 100 }],
        largestTransactions: [{ id: 't1', description: 'Grocery', amount: 500, categoryName: 'Food' }]
      },
      incomeStreams: [{ name: 'Salary', total: 2000 }],
      alerts: [{ type: 'warning', title: 'High Spend', message: 'Spike in dining' }],
      wins: ['Saved more this month'],
      summaryParagraph: 'Great financial progress this month!'
    };
  })
}));

describe('InsightsView Component', () => {
  it('renders correctly with no data', () => {
    render(<InsightsView data={{ transactions: [] }} />);
    expect(screen.getByText('Not enough data to generate insights for this period.')).toBeDefined();
  });

  it('renders correctly with data', () => {
    render(<InsightsView data={{ transactions: [{ id: 1 }] }} />);
    expect(screen.getByText(/Month in Review:/)).toBeDefined();
    expect(screen.getByText('Great financial progress this month!')).toBeDefined();
    expect(screen.getByText('High Spend')).toBeDefined();
    expect(screen.getByText('Spike in dining')).toBeDefined();
    expect(screen.getByText(/Financial Health/)).toBeDefined();
    expect(screen.getByText(/Fixed Costs/)).toBeDefined();
    expect(screen.getByText(/50\/30\/20 Rule/)).toBeDefined();
  });
});


