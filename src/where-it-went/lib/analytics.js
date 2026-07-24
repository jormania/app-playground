import { formatCurrency } from './currency';

export function generateDeepInsights(data, period = 'this_month', filterProps = null) {
  const { categories, transactions } = data;
  if (!transactions || transactions.length === 0) {
    return {
      financialHealth: null,
      behavioral: null,
      trajectory: null
    };
  }

  const now = new Date();
  
  const { filterType = 'All', categoryFilter = 'All', searchQuery = '' } = filterProps || {};

  // 1. Timeframe filtering
  const txInHorizon = transactions.filter(t => {
    // 1. Apply global funnels
    if (filterType !== 'All' && t.type !== filterType) return false;
    if (categoryFilter !== 'All' && t.categoryId !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const descMatch = (t.description || '').toLowerCase().includes(q);
      const catMatch = (categories.find(c => c.id === t.categoryId)?.name || '').toLowerCase().includes(q);
      if (!descMatch && !catMatch) return false;
    }

    // 2. Apply timeframe
    const txDate = new Date(t.date);
    if (!period || period === 'all_time') return true;
    if (period === 'this_month') {
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    }
    if (period === 'last_month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return txDate.getMonth() === lastMonth.getMonth() && txDate.getFullYear() === lastMonth.getFullYear();
    }
    if (period === 'this_year') {
      return txDate.getFullYear() === now.getFullYear();
    }
    if (period.match(/^\d{4}-\d{2}$/)) {
      const [y, m] = period.split('-');
      return txDate.getFullYear() === parseInt(y) && txDate.getMonth() === parseInt(m) - 1;
    }
    if (period.match(/^\d{4}$/)) {
      return txDate.getFullYear() === parseInt(period);
    }
    return true;
  });
  
  const getCatName = (id) => categories.find(c => c.id === id)?.name || 'Uncategorized';

  const expenses = txInHorizon.filter(t => t.type === 'Expense');
  const incomes = txInHorizon.filter(t => t.type === 'Income');

  const totalExpense = expenses.reduce((a, b) => a + b.amount, 0);
  const totalIncome = incomes.reduce((a, b) => a + b.amount, 0);

  // --- Financial Health ---
  const savingsRate = totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 0;

  // 50/30/20 Rule Mapping
  const needsKeywords = ['house', 'housing', 'utilit', 'grocer', 'food', 'health', 'medical', 'transport', 'car', 'auto', 'insur', 'debt', 'loan', 'mortgage'];
  const wantsKeywords = ['din', 'restaurant', 'entertain', 'fun', 'shop', 'cloth', 'travel', 'vacation', 'personal', 'hobby', 'gift'];
  const savingsKeywords = ['invest', 'saving', 'transfer'];

  let needsTotal = 0;
  let wantsTotal = 0;
  let savingsTotal = 0;
  let fixedCostsTotal = 0;

  expenses.forEach(tx => {
    const catName = getCatName(tx.categoryId).toLowerCase();
    
    // Check fixed costs (recurring logic)
    if (tx.recurring || catName.includes('subscript') || catName.includes('rent') || catName.includes('hous')) {
      fixedCostsTotal += tx.amount;
    }

    if (savingsKeywords.some(k => catName.includes(k))) {
      savingsTotal += tx.amount;
    } else if (needsKeywords.some(k => catName.includes(k))) {
      needsTotal += tx.amount;
    } else if (wantsKeywords.some(k => catName.includes(k))) {
      wantsTotal += tx.amount;
    } else {
      // Default to wants if unknown
      wantsTotal += tx.amount;
    }
  });

  const fixedCostsRatio = totalIncome > 0 ? fixedCostsTotal / totalIncome : 0;

  const financialHealth = {
    savingsRate,
    totalIncome,
    totalExpense,
    needsWantsSavings: {
      needs: needsTotal,
      wants: wantsTotal,
      savings: savingsTotal
    },
    fixedCostsRatio
  };

  // --- Behavioral Patterns ---
  const vendorCounts = {};
  let subscriptionsList = [];
  let recurringList = [];
  
  expenses.forEach(tx => {
    const catName = getCatName(tx.categoryId).toLowerCase();
    
    // Check if it's a subscription or recurring
    const isSubscription = catName.includes('subscription');
    const isRecurring = tx.recurring || catName.includes('rent') || catName.includes('hous') || catName.includes('utilit') || catName.includes('insur');
    
    // Normalize description: remove numbers, special chars, lowercase, trim
    let desc = (tx.description || '').toLowerCase();
    desc = desc.replace(/[0-9#\-_,.*]/g, ' ').replace(/\s+/g, ' ').trim();
    if (desc.length < 3) return; // skip too short
    
    if (isSubscription) {
      if (!subscriptionsList[desc]) subscriptionsList[desc] = { name: tx.description, count: 0, total: 0 };
      subscriptionsList[desc].count++;
      subscriptionsList[desc].total += tx.amount;
      return; // Exclude from Latte Factor
    } else if (isRecurring) {
      if (!recurringList[desc]) recurringList[desc] = { name: tx.description, count: 0, total: 0 };
      recurringList[desc].count++;
      recurringList[desc].total += tx.amount;
      return; // Exclude from Latte Factor
    }

    // Exclude common broad terms
    if (['transfer', 'atm', 'cash', 'payment'].includes(desc)) return;

    if (!vendorCounts[desc]) {
      vendorCounts[desc] = { name: tx.description, count: 0, total: 0, catName: getCatName(tx.categoryId) };
    }
    vendorCounts[desc].count += 1;
    vendorCounts[desc].total += tx.amount;
  });

  const latteFactor = Object.values(vendorCounts)
    .filter(v => v.count >= 3 && v.total > 0) // At least 3 transactions to be a "habit"
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5

  const behavioral = {
    latteFactor,
    subscriptions: Object.values(subscriptionsList).sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
    recurring: Object.values(recurringList).sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
  };

  // --- Trajectory & Forecasting (Only makes sense for 'this_month') ---
  let trajectory = null;
  if (period === 'this_month') {
    const todayDate = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
    // Average daily burn rate (excluding rent/housing which are usually one-offs)
    let burnTotal = 0;
    expenses.forEach(tx => {
      const catName = getCatName(tx.categoryId).toLowerCase();
      if (!catName.includes('hous') && !catName.includes('rent')) {
        burnTotal += tx.amount;
      }
    });

    const dailyBurnRate = todayDate > 0 ? burnTotal / todayDate : 0;
    const daysLeft = daysInMonth - todayDate;
    
    // Projected end of month total (Already spent + (burn rate * days left))
    const projectedEnd = totalExpense + (dailyBurnRate * daysLeft);

    trajectory = {
      dailyBurnRate,
      projectedEnd,
      daysLeft,
      daysInMonth,
      todayDate
    };
  }

  return {
    financialHealth,
    behavioral,
    trajectory
  };
}
