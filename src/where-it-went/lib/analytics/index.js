import { calculateMetrics } from './metrics';
import { getHistoricalAverages, getCumulativePaceByDay, getHistoricalTransactionAverages } from './comparisons';
import { ruleOverspendingPace, ruleCategorySpike, ruleLargeTransaction, generateWins } from './rules';
import { generateSummaryParagraph } from './summaries';

function getPreviousPeriod(period, now = new Date()) {
  if (period === 'this_month') {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const y = lastMonth.getFullYear();
    const m = String(lastMonth.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
  if (period === 'last_month') {
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const y = twoMonthsAgo.getFullYear();
    const m = String(twoMonthsAgo.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
  if (period === 'this_year') {
    return String(now.getFullYear() - 1);
  }
  if (period.match(/^\d{4}-\d{2}$/)) {
    const [y, m] = period.split('-');
    const prevDate = new Date(parseInt(y), parseInt(m) - 2, 1);
    const py = prevDate.getFullYear();
    const pm = String(prevDate.getMonth() + 1).padStart(2, '0');
    return `${py}-${pm}`;
  }
  if (period.match(/^\d{4}$/)) {
    return String(parseInt(period) - 1);
  }
  return null;
}

function filterTransactions(transactions, categories, filterProps, periodStr, now) {
  const { filterType = 'All', categoryFilter = 'All', searchQuery = '' } = filterProps || {};
  return transactions.filter(t => {
    if (filterType !== 'All' && t.type !== filterType) return false;
    if (categoryFilter !== 'All' && t.categoryId !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const descMatch = (t.description || '').toLowerCase().includes(q);
      const catMatch = (categories.find(c => c.id === t.categoryId)?.name || '').toLowerCase().includes(q);
      if (!descMatch && !catMatch) return false;
    }

    const txDate = new Date(t.date);
    if (!periodStr || periodStr === 'all_time') return true;
    if (periodStr === 'this_month') {
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    }
    if (periodStr === 'last_month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return txDate.getMonth() === lastMonth.getMonth() && txDate.getFullYear() === lastMonth.getFullYear();
    }
    if (periodStr === 'this_year') {
      return txDate.getFullYear() === now.getFullYear();
    }
    if (periodStr.match(/^\d{4}-\d{2}$/)) {
      const [y, m] = periodStr.split('-');
      return txDate.getFullYear() === parseInt(y) && txDate.getMonth() === parseInt(m) - 1;
    }
    if (periodStr.match(/^\d{4}$/)) {
      return txDate.getFullYear() === parseInt(periodStr);
    }
    return true;
  });
}

export function generateDeepInsights(data, period = 'this_month', filterProps = null) {
  const { categories, transactions } = data;
  if (!transactions || transactions.length === 0) return null;

  const now = new Date();
  
  // Scopes
  const txInHorizon = filterTransactions(transactions, categories, filterProps, period, now);
  const prevPeriodStr = getPreviousPeriod(period, now);
  const prevTxInHorizon = prevPeriodStr ? filterTransactions(transactions, categories, filterProps, prevPeriodStr, now) : [];

  // Metrics
  const currentMetrics = calculateMetrics(txInHorizon, categories);
  const prevMetrics = calculateMetrics(prevTxInHorizon, categories);
  
  // Category Spending Change (for UI Trends)
  const spendingByCategoryChange = Object.values(currentMetrics.catSums)
    .filter(c => c.type === 'Expense' && (c.total > 0 || (prevMetrics.catSums[c.id] && prevMetrics.catSums[c.id].total > 0)))
    .map(c => {
      const prev = prevMetrics.catSums[c.id] ? prevMetrics.catSums[c.id].total : 0;
      const curr = c.total;
      const diff = curr - prev;
      let pctChange = 0;
      if (prev > 0) pctChange = (diff / prev) * 100;
      else if (curr > 0) pctChange = 100;
      return { ...c, prevTotal: prev, currTotal: curr, diff, pctChange, absPctChange: Math.abs(pctChange) };
    })
    .sort((a, b) => {
      // Sort by absolute pct change descending, then absolute diff descending
      if (b.absPctChange !== a.absPctChange) return b.absPctChange - a.absPctChange;
      return Math.abs(b.diff) - Math.abs(a.diff);
    });

  // Largest Transactions (Expenses only)
  const largestTransactions = [...txInHorizon]
    .filter(t => t.type === 'Expense')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Behavioral Patterns
  const getCatName = (id) => categories.find(c => c.id === id)?.name || 'Uncategorized';
  const vendorCounts = {};
  let subscriptionsList = {};
  
  txInHorizon.filter(t => t.type === 'Expense').forEach(tx => {
    const catName = getCatName(tx.categoryId).toLowerCase();
    const isSubscription = catName.includes('subscript');
    let desc = (tx.description || '').toLowerCase().replace(/[0-9#\-_,.*]/g, ' ').replace(/\s+/g, ' ').trim();
    if (desc.length < 3) return; 
    
    if (isSubscription) {
      if (!subscriptionsList[desc]) subscriptionsList[desc] = { name: tx.description, count: 0, total: 0 };
      subscriptionsList[desc].count++;
      subscriptionsList[desc].total += tx.amount;
      return;
    }

    if (['transfer', 'atm', 'cash', 'payment'].includes(desc)) return;

    if (!vendorCounts[desc]) {
      vendorCounts[desc] = { name: tx.description, count: 0, total: 0, catName: getCatName(tx.categoryId) };
    }
    vendorCounts[desc].count += 1;
    vendorCounts[desc].total += tx.amount;
  });

  const frequentSpending = Object.values(vendorCounts)
    .filter(v => v.count >= 3 && v.total > 0)
    .sort((a, b) => b.count - a.count)
    .map(v => ({ ...v, average: v.total / v.count }))
    .slice(0, 5);

  const behavioral = {
    frequentSpending,
    subscriptions: Object.values(subscriptionsList).sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
    spendingByCategoryChange,
    largestTransactions
  };

  const incomeSources = {};
  txInHorizon.filter(t => t.type === 'Income').forEach(tx => {
    let desc = (tx.description || getCatName(tx.categoryId)).trim();
    if (!desc) desc = 'Other Income';
    if (!incomeSources[desc]) incomeSources[desc] = { name: desc, total: 0 };
    incomeSources[desc].total += tx.amount;
  });
  const incomeStreams = Object.values(incomeSources).sort((a, b) => b.total - a.total);

  // --- RULES ENGINE ---
  const alerts = [];
  
  // Context Data for Rules
  const histAverages = getHistoricalAverages(transactions, categories, period, now);
  const histTxAverages = getHistoricalTransactionAverages(transactions);
  const histPace = getCumulativePaceByDay(transactions, now.getDate(), period, now);

  // Execute Rules
  const paceRule = ruleOverspendingPace(currentMetrics, histPace, period, now);
  if (paceRule) alerts.push(paceRule);

  const spikeRules = ruleCategorySpike(currentMetrics.catSums, histAverages);
  alerts.push(...spikeRules);

  const txRules = ruleLargeTransaction(largestTransactions, histTxAverages, categories);
  alerts.push(...txRules);
  
  const wins = generateWins(currentMetrics, prevMetrics, period);
  const summaryParagraph = generateSummaryParagraph(currentMetrics, prevMetrics, spendingByCategoryChange, alerts, wins);

  return {
    financialHealth: currentMetrics,
    behavioral,
    incomeStreams,
    alerts,
    wins,
    summaryParagraph
  };
}
