import { describe, it, expect } from 'vitest';
import { formatShareableSummary } from './summaries';

describe('formatShareableSummary', () => {
  it('returns an empty string when there is nothing to summarize', () => {
    expect(formatShareableSummary('July 2026', null)).toBe('');
  });

  it('composes the period label, the editorial summary and the headline figures', () => {
    const insights = {
      summaryParagraph: 'You spent 500 L this period.',
      financialHealth: { totalIncome: 1000, totalExpense: 500, netCashFlow: 500, savingsRate: 0.5 },
    };
    const text = formatShareableSummary('July 2026', insights);
    expect(text).toContain('July 2026 in Review');
    expect(text).toContain('You spent 500 L this period.');
    expect(text).toContain('Income: 1,000.00 L');
    expect(text).toContain('Expenses: 500.00 L');
    expect(text).toContain('Net: 500.00 L');
    expect(text).toContain('Savings rate: 50.0%');
  });

  it('omits the figures block when financialHealth is missing, without throwing', () => {
    const text = formatShareableSummary('July 2026', { summaryParagraph: 'Nothing much happened.' });
    expect(text).toBe('July 2026 in Review\n\nNothing much happened.');
  });
});
