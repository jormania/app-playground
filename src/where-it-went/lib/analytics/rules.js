import { RULES, matchesAny } from './constants';
import { formatCurrency } from '../currency';

export function ruleOverspendingPace(currentMetrics, historicalPacePct, currentPeriodStr, now = new Date()) {
  if (currentPeriodStr !== 'this_month' || !historicalPacePct) return null;

  const dayOfMonth = now.getDate();
  // historicalPacePct = (spend to day X) / (whole-month spend), averaged over history.
  const projectedTotal = currentMetrics.totalExpense / historicalPacePct;

  if (currentMetrics.totalIncome > 0 && projectedTotal > currentMetrics.totalIncome) {
    return {
      type: 'warning',
      title: 'High Spending Pace',
      message: `By day ${dayOfMonth} you have usually spent ${(historicalPacePct * 100).toFixed(0)}% of the month's expenses. At this pace you are projected to spend ${formatCurrency(projectedTotal)} — more than this period's income.`
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
    // One month of history is not an average — it just means "different from last month".
    if ((hist.monthsAssessed || 0) < RULES.MIN_MONTHS_FOR_BASELINE) return;

    const isSporadic = matchesAny((c.name || '').toLowerCase(), RULES.SPORADIC_CATEGORIES);
    const diff = c.total - hist.average;
    const pctChange = (diff / hist.average) * 100;
    const thresholdPct = isSporadic ? 150 : RULES.CATEGORY_SPIKE_PCT;

    if (pctChange > thresholdPct && diff >= RULES.CATEGORY_SPIKE_MIN_AMT) {
      alerts.push({
        type: 'warning',
        title: 'Category Spike',
        weight: diff,
        message: `Your ${c.name} spending (${formatCurrency(c.total)}) is ${pctChange.toFixed(0)}% higher than your ${hist.monthsAssessed}-month average (${formatCurrency(hist.average)}).`
      });
    }
  });

  return alerts;
}

export function ruleLargeTransaction(largestTransactions, histTxAverages, categories) {
  const alerts = [];
  const byId = new Map((categories || []).map(c => [c.id, c]));

  largestTransactions.forEach(tx => {
    const catHist = histTxAverages[tx.categoryId];
    if (!catHist || catHist.average <= 0) return;
    // Needs a real history behind it, or every first purchase in a category is "unusual".
    if (catHist.count < RULES.LARGE_TX_MIN_HISTORY) return;

    const catName = byId.get(tx.categoryId)?.name || 'Uncategorized';
    if (tx.amount > catHist.average * RULES.LARGE_TX_MULTIPLIER && tx.amount >= RULES.LARGE_TX_MIN_AMT) {
      alerts.push({
        type: 'warning',
        title: 'Unusually Large Transaction',
        weight: tx.amount,
        message: `Your ${catName} purchase for ${formatCurrency(tx.amount)} (${tx.description || 'no description'}) is ${(tx.amount / catHist.average).toFixed(1)}× your usual ${catName} transaction.`
      });
    }
  });

  // Two is plenty — the top-5 list used to emit five near-identical alerts at once.
  return alerts.sort((a, b) => b.weight - a.weight).slice(0, 2);
}

export function generateWins(currentMetrics, prevMetrics) {
  const wins = [];

  if (currentMetrics.savingsRate > RULES.SAVINGS_TARGET) {
    wins.push(`Savings rate exceeded target (${(currentMetrics.savingsRate * 100).toFixed(1)}%)`);
  }

  if (prevMetrics && currentMetrics.investmentRate > prevMetrics.investmentRate && currentMetrics.investmentRate > 0) {
    wins.push('Investment contributions increased');
  }

  // The biggest category reduction, whatever it is — this used to be hardcoded to Dining.
  if (prevMetrics && currentMetrics.catSums && prevMetrics.catSums) {
    let best = null;
    Object.values(currentMetrics.catSums).forEach(c => {
      if (c.type !== 'Expense') return;
      const prev = prevMetrics.catSums[c.id]?.total || 0;
      if (prev <= 0) return;
      const drop = prev - c.total;
      if (drop > 0 && (!best || drop > best.drop)) best = { name: c.name, drop };
    });
    if (best && best.drop >= 50) {
      wins.push(`${best.name} spending decreased by ${formatCurrency(best.drop)}`);
    }
  }

  return wins;
}

/** Keeps the "Attention Needed" list readable: strongest signals first, capped. */
export function rankAlerts(alerts) {
  return [...alerts]
    .sort((a, b) => (b.weight || 0) - (a.weight || 0))
    .slice(0, RULES.MAX_ALERTS)
    .map(({ weight: _weight, ...rest }) => rest);
}
