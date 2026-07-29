import { formatCurrency } from '../currency';

export function generateSummaryParagraph(currentMetrics, prevMetrics, spendingByCategoryChange) {
  let summary = '';

  // Sentence 1: macro comparison
  if (prevMetrics && currentMetrics.totalExpense > 0 && prevMetrics.totalExpense > 0) {
    const diff = currentMetrics.totalExpense - prevMetrics.totalExpense;
    if (Math.abs(diff) / prevMetrics.totalExpense < 0.05) {
      summary += 'Overall spending stayed close to the previous period. ';
    } else if (diff > 0) {
      summary += `Overall spending increased by ${formatCurrency(diff)} compared to the previous period. `;
    } else {
      summary += `Overall spending decreased by ${formatCurrency(Math.abs(diff))} compared to the previous period. `;
    }
  } else if (currentMetrics.totalExpense > 0) {
    summary += `You spent ${formatCurrency(currentMetrics.totalExpense)} this period. `;
  } else {
    summary += 'No spending recorded for this period. ';
  }

  // Sentence 2: specific category movers
  if (spendingByCategoryChange.length > 0) {
    const topIncrease = spendingByCategoryChange.find(c => c.diff > 0);
    const topDecrease = [...spendingByCategoryChange].reverse().find(c => c.diff < 0);

    if (topIncrease && topDecrease) {
      summary += `${topIncrease.name} expenses rose, while lower ${topDecrease.name.toLowerCase()} expenses helped offset it. `;
    } else if (topIncrease) {
      summary += `${topIncrease.name} expenses drove most of this period's increase. `;
    } else if (topDecrease) {
      summary += `Reductions in ${topDecrease.name.toLowerCase()} made for a lighter period. `;
    }
  }

  // Sentence 3: savings context — only meaningful when there was income to save from.
  if (currentMetrics.totalIncome <= 0) {
    summary += 'No income was recorded this period, so the savings rate is not meaningful.';
  } else if (currentMetrics.savingsRate > 0.20) {
    summary += 'Strong cash retention kept your savings rate above the 20% target.';
  } else if (currentMetrics.savingsRate > 0) {
    summary += 'Your savings rate stayed positive but fell below the 20% target.';
  } else {
    summary += 'You spent more than you took in this period.';
  }

  return summary.trim();
}
