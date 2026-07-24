// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import InsightsView from './InsightsView';

// Mock the generateInsights algorithm to avoid dependency logic
vi.mock('../lib/analytics', () => ({
  generateInsights: vi.fn((data) => {
    if (!data.transactions || data.transactions.length === 0) {
      return { 
        highlights: [], 
        expenses: { increases: [], decreases: [], subscriptions: [], utilities: [], otherRecurring: [], investing: [] }, 
        income: { total: 0, insights: [] } 
      };
    }
    return {
      highlights: [
        { icon: '📈', title: 'Test Highlight', value: 'Mock value', description: 'Mock description', positive: true }
      ],
      expenses: {
        increases: ['Mock increase'],
        decreases: ['Mock decrease'],
        subscriptions: [{ type: 'twistie', title: 'Sub Total', items: ['Netflix - 10 RON'] }],
        utilities: [],
        otherRecurring: [],
        investing: ['Mock investing']
      },
      income: {
        total: 100,
        insights: ['Mock income insight']
      }
    };
  })
}));

describe('InsightsView Component', () => {
  it('renders correctly with no data', () => {
    render(<InsightsView data={{ transactions: [] }} />);
    expect(screen.getByText('Not enough data to generate a review this month.')).toBeDefined();
  });

  it('renders correctly with data', () => {
    render(<InsightsView data={{ transactions: [{ id: 1 }] }} />);
    expect(screen.getByText('Test Highlight')).toBeDefined();
    expect(screen.getByText('Mock value')).toBeDefined();
    expect(screen.getByText('Mock description')).toBeDefined();
    expect(screen.getByText('Mock increase')).toBeDefined();
    expect(screen.getByText('Mock decrease')).toBeDefined();
    expect(screen.getByText('Sub Total')).toBeDefined();
    expect(screen.getByText('Netflix - 10 RON')).toBeDefined();
    expect(screen.getByText('Mock investing')).toBeDefined();
  });
});
