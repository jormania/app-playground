// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Dashboard from './Dashboard';

// Mock chart.js so it doesn't crash in node/happy-dom
vi.mock('chart.js/auto', () => {
  return {
    default: class {
      constructor() {}
      destroy() {}
    }
  };
});

describe('Dashboard Component', () => {
  it('calculates KPIs for the current month correctly', () => {
    const now = new Date();
    
    const data = {
      categories: [
        { id: '1', name: 'Salary' },
        { id: '2', name: 'Groceries' }
      ],
      transactions: [
        { id: 't1', date: now.toISOString(), type: 'Income', amount: 5000, categoryId: '1' },
        { id: 't2', date: now.toISOString(), type: 'Expense', amount: 1000, categoryId: '2' },
        { id: 't3', date: '2020-01-01', type: 'Expense', amount: 9999, categoryId: '2' } // Ignored (old)
      ]
    };

    render(<Dashboard data={data} />);

    // Income should be 5,000
    expect(screen.getAllByText(/5,000/).length).toBeGreaterThan(0);
    // Expenses should be 1,000
    expect(screen.getAllByText(/1,000/).length).toBeGreaterThan(0);
    // Net should be 4,000
    expect(screen.getAllByText(/4,000/).length).toBeGreaterThan(0);
  });
});
