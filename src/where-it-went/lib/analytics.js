import { formatCurrency } from './currency';

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
  return null; // For 'all_time' or unknown
}

function filterTransactions(transactions, categories, filterProps, periodStr, now) {
  const { filterType = 'All', categoryFilter = 'All', searchQuery = '' } = filterProps || {};
  return transactions.filter(t => {
    // Apply global funnels
    if (filterType !== 'All' && t.type !== filterType) return false;
    if (categoryFilter !== 'All' && t.categoryId !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const descMatch = (t.description || '').toLowerCase().includes(q);
      const catMatch = (categories.find(c => c.id === t.categoryId)?.name || '').toLowerCase().includes(q);
      if (!descMatch && !catMatch) return false;
    }

    // Apply timeframe
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
  const getCatName = (id) => categories.find(c => c.id === id)?.name || 'Uncategorized';

  // Current period transactions
  const txInHorizon = filterTransactions(transactions, categories, filterProps, period, now);
  const expenses = txInHorizon.filter(t => t.type === 'Expense');
  const incomes = txInHorizon.filter(t => t.type === 'Income');
  const totalExpense = expenses.reduce((a, b) => a + b.amount, 0);
  const totalIncome = incomes.reduce((a, b) => a + b.amount, 0);

  // Previous period transactions
  const prevPeriodStr = getPreviousPeriod(period, now);
  const prevTxInHorizon = prevPeriodStr ? filterTransactions(transactions, categories, filterProps, prevPeriodStr, now) : [];
  const prevExpenses = prevTxInHorizon.filter(t => t.type === 'Expense');
  const prevIncomes = prevTxInHorizon.filter(t => t.type === 'Income');
  const prevTotalExpense = prevExpenses.reduce((a, b) => a + b.amount, 0);
  const prevTotalIncome = prevIncomes.reduce((a, b) => a + b.amount, 0);

  // --- Financial Health & 50/30/20 ---
  const savingsRate = totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 0;
  const prevSavingsRate = prevTotalIncome > 0 ? (prevTotalIncome - prevTotalExpense) / prevTotalIncome : 0;
  const netCashFlow = totalIncome - totalExpense;

  const needsKeywords = ['hous', 'utilit', 'food', 'health', 'transport', 'propert', 'tax', 'loan'];
  const wantsKeywords = ['din', 'leisure', 'shop', 'travel', 'nora', 'gift', 'other'];
  const savingsKeywords = ['invest']; // The existing categories list uses Investing

  let needsTotal = 0;
  let wantsTotal = 0;
  let savingsTotal = 0;
  let fixedCostsTotal = 0;
  
  let propertyTotal = 0;
  let taxesTotal = 0;
  let investingTotal = 0;

  // Track category sums for current period
  const catSums = {};
  categories.forEach(c => catSums[c.id] = { id: c.id, name: c.name, type: c.type, total: 0 });

  expenses.forEach(tx => {
    const catName = getCatName(tx.categoryId).toLowerCase();
    if (catSums[tx.categoryId]) catSums[tx.categoryId].total += tx.amount;

    // Specific Overviews
    if (catName.includes('propert')) propertyTotal += tx.amount;
    if (catName.includes('tax')) taxesTotal += tx.amount;
    if (catName.includes('invest')) investingTotal += tx.amount;
    
    // Check fixed costs explicitly (Housing, Utilities, Property, Subscriptions)
    if (catName.includes('hous') || catName.includes('utilit') || catName.includes('propert') || catName.includes('subscript') || catName.includes('rent')) {
      fixedCostsTotal += tx.amount;
    }

    if (savingsKeywords.some(k => catName.includes(k))) {
      savingsTotal += tx.amount;
    } else if (needsKeywords.some(k => catName.includes(k))) {
      needsTotal += tx.amount;
    } else if (wantsKeywords.some(k => catName.includes(k))) {
      wantsTotal += tx.amount;
    } else {
      wantsTotal += tx.amount; // fallback
    }
  });

  const investmentRate = totalIncome > 0 ? investingTotal / totalIncome : 0;
  const fixedCostsRatio = totalIncome > 0 ? fixedCostsTotal / totalIncome : 0;

  // Track previous category sums for MoM
  const prevCatSums = {};
  prevExpenses.forEach(tx => {
    if (!prevCatSums[tx.categoryId]) prevCatSums[tx.categoryId] = 0;
    prevCatSums[tx.categoryId] += tx.amount;
  });

  const spendingByCategoryChange = Object.values(catSums)
    .filter(c => c.type === 'Expense' && (c.total > 0 || prevCatSums[c.id] > 0))
    .map(c => {
      const prev = prevCatSums[c.id] || 0;
      const curr = c.total;
      const diff = curr - prev;
      let pctChange = 0;
      if (prev > 0) pctChange = (diff / prev) * 100;
      else if (curr > 0) pctChange = 100;
      
      return { ...c, prevTotal: prev, currTotal: curr, diff, pctChange };
    })
    .sort((a, b) => b.currTotal - a.currTotal);

  const highestSpending = [...spendingByCategoryChange].slice(0, 5);
  
  const largestTransactions = [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5);

  const financialHealth = {
    savingsRate,
    netCashFlow,
    investmentRate,
    fixedCostsRatio,
    totalIncome,
    totalExpense,
    needsWantsSavings: {
      needs: needsTotal,
      wants: wantsTotal,
      savings: savingsTotal
    },
    overviews: {
      property: propertyTotal,
      taxes: taxesTotal
    }
  };

  // --- Behavioral Patterns ---
  const vendorCounts = {};
  let subscriptionsList = [];
  
  expenses.forEach(tx => {
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
    highestSpending,
    spendingByCategoryChange,
    largestTransactions
  };

  // --- Income Streams ---
  const incomeSources = {};
  incomes.forEach(tx => {
    let desc = (tx.description || getCatName(tx.categoryId)).trim();
    if (!desc) desc = 'Other Income';
    if (!incomeSources[desc]) incomeSources[desc] = { name: desc, total: 0 };
    incomeSources[desc].total += tx.amount;
  });
  const incomeStreams = Object.values(incomeSources).sort((a, b) => b.total - a.total);

  // --- Attention Needed (Rules Engine) ---
  const alerts = [];
  
  // Rule 1: High Burn Rate
  let trajectory = null;
  if (period === 'this_month') {
    const todayDate = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    let burnTotal = 0;
    expenses.forEach(tx => {
      const catName = getCatName(tx.categoryId).toLowerCase();
      if (!catName.includes('hous') && !catName.includes('rent') && !catName.includes('subscript')) {
        burnTotal += tx.amount;
      }
    });

    const dailyBurnRate = todayDate > 0 ? burnTotal / todayDate : 0;
    const daysLeft = daysInMonth - todayDate;
    const projectedEnd = totalExpense + (dailyBurnRate * daysLeft);

    trajectory = { dailyBurnRate, projectedEnd, daysLeft, daysInMonth, todayDate };
    
    if (totalIncome > 0 && projectedEnd > totalIncome) {
      alerts.push({ type: 'warning', title: 'High Burn Rate', message: `Your projected spend (${formatCurrency(projectedEnd)}) exceeds your income.` });
    }
  }

  // Rule 2: Exceptional Savings
  if (savingsRate > 0.20 && (savingsRate - prevSavingsRate > 0.05)) {
    alerts.push({ type: 'success', title: 'Exceptional Savings', message: `You are retaining ${(savingsRate * 100).toFixed(1)}% of your income, a notable increase from last period!` });
  }

  // Rule 3: Category Spikes
  spendingByCategoryChange.forEach(c => {
    if (c.pctChange > 50 && c.diff > 100) {
      alerts.push({ type: 'warning', title: 'Category Spike', message: `Spending in ${c.name} is up ${c.pctChange.toFixed(0)}% (+${formatCurrency(c.diff)}) compared to last period.` });
    }
  });

  // Rule 4: Large Transactions
  largestTransactions.forEach(tx => {
    if (totalIncome > 0 && tx.amount > totalIncome * 0.15) {
      alerts.push({ type: 'warning', title: 'Large Transaction', message: `${tx.description} was ${formatCurrency(tx.amount)}, which is >15% of your total income.` });
    }
  });

  return {
    financialHealth,
    behavioral,
    trajectory,
    incomeStreams,
    alerts
  };
}
