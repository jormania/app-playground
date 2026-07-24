import { RULES, KEYWORDS } from './constants';
import { formatCurrency } from '../currency';

export function ruleOverspendingPace(currentMetrics, historicalPacePct, currentPeriodStr, now = new Date()) {
  if (currentPeriodStr !== 'this_month' || historicalPacePct === null || historicalPacePct === 0) return null;
  
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentMonthPacePct = currentMetrics.totalIncome > 0 ? (currentMetrics.totalExpense / currentMetrics.totalIncome) : (currentMetrics.totalExpense > 0 ? 1 : 0);
  
  // E.g. we spent 48% of income by day 12, but historically we only spend 32% of income by day 12.
  // We compare the percentage of total monthly spend expected vs actual.
  // Actually, historicalPacePct is (historical cumulative to Day X) / (historical total for month).
  // E.g. if by Day 12 we usually spend 32% of our monthly total.
  // If we project current month: if we are at Day 12, we spent X. Projected total = X / 0.32.
  const projectedTotal = historicalPacePct > 0 ? currentMetrics.totalExpense / historicalPacePct : currentMetrics.totalExpense;
  
  if (currentMetrics.totalIncome > 0 && projectedTotal > currentMetrics.totalIncome) {
    return { 
      type: 'warning', 
      title: 'High Spending Pace', 
      message: `Historically you spend ${(historicalPacePct * 100).toFixed(0)}% of your monthly expenses by day ${dayOfMonth}. At your current pace, you are projected to exceed your income.` 
    };
  }
  return null;
}

export function ruleCategorySpike(currentCatSums, historicalAverages) {
  const alerts = [];
  Object.values(currentCatSums).forEach(c => {
    if (c.type !== 'Expense') return;
    
    const hist = historicalAverages[c.id];
    if (!hist || hist.average === 0) return;

    const isSporadic = RULES.SPORADIC_CATEGORIES.some(k => c.name.toLowerCase().includes(k));
    const diff = c.total - hist.average;
    const pctChange = (diff / hist.average) * 100;

    let thresholdPct = RULES.CATEGORY_SPIKE_PCT;
    // Sporadic categories require a much larger spike to be flagged
    if (isSporadic) thresholdPct = 150; 

    if (pctChange > thresholdPct && diff >= RULES.CATEGORY_SPIKE_MIN_AMT) {
      alerts.push({
        type: 'warning',
        title: 'Category Spike',
        message: `Your ${c.name} spending (${formatCurrency(c.total)}) is ${(pctChange).toFixed(0)}% higher than your historical average (${formatCurrency(hist.average)}).`
      });
    }
  });
  return alerts;
}

export function ruleLargeTransaction(largestTransactions, histTxAverages, categories) {
  const alerts = [];
  largestTransactions.forEach(tx => {
    const catHist = histTxAverages[tx.categoryId];
    const catName = categories.find(c => c.id === tx.categoryId)?.name || 'Uncategorized';
    
    if (catHist && catHist.average > 0) {
      if (tx.amount > catHist.average * RULES.LARGE_TX_MULTIPLIER && tx.amount >= 100) { // arbitrary minimum floor to avoid flagging tiny 3x transactions
        alerts.push({
          type: 'warning',
          title: 'Unusually Large Transaction',
          message: `Your ${catName} purchase for ${formatCurrency(tx.amount)} (${tx.description || 'Unknown'}) is ${(tx.amount / catHist.average).toFixed(1)}x larger than your average ${catName} visit.`
        });
      }
    }
  });
  return alerts;
}

export function generateWins(currentMetrics, prevMetrics, currentPeriod) {
  const wins = [];
  
  if (currentMetrics.savingsRate > RULES.SAVINGS_TARGET) {
    wins.push(`Savings rate exceeded target (${(currentMetrics.savingsRate * 100).toFixed(1)}%)`);
  }
  
  if (prevMetrics && currentMetrics.investmentRate > prevMetrics.investmentRate && currentMetrics.investmentRate > 0) {
    wins.push(`Investment contributions increased`);
  }
  
  // Find categories that decreased
  if (prevMetrics && currentMetrics.catSums && prevMetrics.catSums) {
    const diningCat = Object.values(currentMetrics.catSums).find(c => c.name.toLowerCase().includes('din'));
    if (diningCat) {
      const prevDining = prevMetrics.catSums[diningCat.id]?.total || 0;
      if (prevDining > 0 && diningCat.total < prevDining && diningCat.total > 0) {
        wins.push(`Dining spending decreased by ${formatCurrency(prevDining - diningCat.total)}`);
      }
    }
  }

  return wins;
}
