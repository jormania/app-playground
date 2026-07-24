// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Insights from './Insights';

// Mock the generateInsights algorithm to avoid dependency logic
vi.mock('../lib/analytics', () => ({
  generateInsights: vi.fn((data) => {
    if (!data.transactions || data.transactions.length === 0) {
      return { review: 'Not enough data', insights: [] };
    }
    return {
      review: 'Mock review text',
      question: 'Mock question?',
      insights: ['Mock insight 1', 'Mock insight 2']
    };
  })
}));

describe('Insights Component', () => {
  it('renders correctly with no data', () => {
    render(<Insights data={{ transactions: [] }} />);
    expect(screen.getByText('Not enough data')).toBeDefined();
    expect(screen.getByText('Not enough data to generate insights yet.')).toBeDefined();
  });

  it('renders correctly with data', () => {
    render(<Insights data={{ transactions: [{ id: 1 }] }} />);
    expect(screen.getByText('Mock review text')).toBeDefined();
    expect(screen.getByText('Mock question?')).toBeDefined();
    expect(screen.getByText('Mock insight 1')).toBeDefined();
    expect(screen.getByText('Mock insight 2')).toBeDefined();
  });
});
