import { formatCurrency } from './currency';

export function generateDeepInsights(data, horizon = 'this_month') {
  const { categories, transactions } = data;
  if (!transactions || transactions.length === 0) {
    return {
      financialHealth: null,
      behavioral: null,
      trajectory: null
    };
  }

  const now = new Date();
  
  // 1. Timeframe filtering
  let startDate = new Date();
  if (horizon === 'this_month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (horizon === 'this_quarter') {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
  } else if (horizon === 'this_year') {
    startDate = new Date(now.getFullYear(), 0, 1);
  } else {
    // all time
    startDate = new Date(0); 
  }

  const txInHorizon = transactions.filter(t => new Date(t.date) >= startDate && new Date(t.date) <= now);
  
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

  // --- Behavioral Patterns (Latte Factor) ---
  const vendorCounts = {};
  expenses.forEach(tx => {
    // Normalize description: remove numbers, special chars, lowercase, trim
    let desc = (tx.description || '').toLowerCase();
    desc = desc.replace(/[0-9#\-_,.*]/g, ' ').replace(/\s+/g, ' ').trim();
    if (desc.length < 3) return; // skip too short
    
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
    latteFactor
  };

  // --- Trajectory & Forecasting (Only makes sense for 'this_month') ---
  let trajectory = null;
  if (horizon === 'this_month') {
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
