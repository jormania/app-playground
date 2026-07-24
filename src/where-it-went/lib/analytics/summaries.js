import { formatCurrency } from '../currency';

export function generateSummaryParagraph(currentMetrics, prevMetrics, spendingByCategoryChange, alerts, wins) {
  let summary = '';

  // Sentence 1: Macro comparison
  if (prevMetrics && currentMetrics.totalExpense > 0 && prevMetrics.totalExpense > 0) {
    const diff = currentMetrics.totalExpense - prevMetrics.totalExpense;
    if (Math.abs(diff) / prevMetrics.totalExpense < 0.05) {
      summary += 'Overall spending remained close to your historical average. ';
    } else if (diff > 0) {
      summary += `Overall spending increased by ${formatCurrency(diff)} compared to the previous period. `;
    } else {
      summary += `Overall spending decreased by ${formatCurrency(Math.abs(diff))} compared to the previous period. `;
    }
  } else {
    summary += 'Overall spending data has been calculated. ';
  }

  // Sentence 2: Specific category movers
  if (spendingByCategoryChange.length > 0) {
    // Top increaser
    const topIncrease = spendingByCategoryChange.find(c => c.diff > 0);
    // Top decreaser
    const topDecrease = [...spendingByCategoryChange].reverse().find(c => c.diff < 0);

    if (topIncrease && topDecrease) {
      summary += `${topIncrease.name} expenses increased this month, but lower ${topDecrease.name.toLowerCase()} expenses helped balance the budget. `;
    } else if (topIncrease) {
      summary += `${topIncrease.name} expenses drove the majority of this period's spending increase. `;
    } else if (topDecrease) {
      summary += `Significant reductions in ${topDecrease.name.toLowerCase()} contributed to a lighter month. `;
    }
  }

  // Sentence 3: Savings Target context
  if (currentMetrics.savingsRate > 0.20) {
    summary += 'Strong cash retention kept your savings rate above target.';
  } else if (currentMetrics.savingsRate > 0 && currentMetrics.savingsRate <= 0.20) {
    summary += 'Your savings rate remained positive but fell below the 20% target.';
  } else if (currentMetrics.savingsRate <= 0) {
    summary += 'You spent more than your incoming cash flow this period.';
  }

  return summary.trim();
}
