import { formatCurrency } from './currency';

export function generateInsights(data) {
  const { categories, transactions } = data;
  if (!transactions || transactions.length === 0) {
    return {
      highlights: [],
      expenses: { increases: [], decreases: [], subscriptions: [], utilities: [], otherRecurring: [], investing: [] },
      income: { total: 0, topSource: null, insights: [] }
    };
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const lastMonthDate = new Date(now);
  lastMonthDate.setMonth(currentMonth - 1);
  const lastMonth = lastMonthDate.getMonth();
  const lastMonthYear = lastMonthDate.getFullYear();

  const isCurrentMonth = (dateStr) => {
    const d = new Date(dateStr);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  };

  const isLastMonth = (dateStr) => {
    const d = new Date(dateStr);
    return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
  };

  const txThisMonth = transactions.filter(t => isCurrentMonth(t.date));
  const txLastMonth = transactions.filter(t => isLastMonth(t.date));

  const expThisMonth = txThisMonth.filter(t => t.type === 'Expense');
  const expLastMonth = txLastMonth.filter(t => t.type === 'Expense');
  const incThisMonth = txThisMonth.filter(t => t.type === 'Income');
  const incLastMonth = txLastMonth.filter(t => t.type === 'Income');

  const sum = (txs) => txs.reduce((acc, t) => acc + t.amount, 0);

  const totalExpThis = sum(expThisMonth);
  const totalExpLast = sum(expLastMonth);
  const totalIncThis = sum(incThisMonth);
  const totalIncLast = sum(incLastMonth);

  // Helper to get category name safely
  const getCatName = (id) => categories.find(c => c.id === id)?.name || 'Uncategorized';
  
  // Group expenses by category
  const groupByCategory = (txs) => {
    const grouped = {};
    txs.forEach(t => {
      const cat = getCatName(t.categoryId);
      grouped[cat] = (grouped[cat] || 0) + t.amount;
    });
    return grouped;
  };

  const expByCatThis = groupByCategory(expThisMonth);
  const expByCatLast = groupByCategory(expLastMonth);

  // Identify non-discretionary vs discretionary
  const nonDiscretionary = ['Housing', 'Utilities', 'Taxes & Fees', 'Health', 'Property', 'Investing'];
  
  let largestDiscretionary = { name: null, amount: 0 };
  let largestUnexpected = { name: null, amount: 0 }; // We'll just define 'unexpected' as a category they didn't have last month or "Other"

  Object.entries(expByCatThis).forEach(([cat, amount]) => {
    if (!nonDiscretionary.includes(cat) && amount > largestDiscretionary.amount) {
      largestDiscretionary = { name: cat, amount };
    }
    if (!expByCatLast[cat] && amount > largestUnexpected.amount && cat !== 'Uncategorized') {
      largestUnexpected = { name: cat, amount };
    }
  });

  // Calculate structured highlights
  const highlights = [];
  
  if (totalExpLast > 0) {
    const diff = Math.abs(Math.round((totalExpThis / totalExpLast - 1) * 100));
    const isLess = totalExpThis < totalExpLast;
    highlights.push({
      icon: isLess ? '📉' : '📈',
      title: 'Spending Trend',
      value: `${diff}% ${isLess ? 'Less' : 'More'}`,
      description: `Than last month. (${formatCurrency(totalExpThis)} total)`,
      positive: isLess
    });
  } else {
    highlights.push({
      icon: '📊',
      title: 'Total Spent',
      value: formatCurrency(totalExpThis),
      description: 'Total spending this month.',
      positive: true
    });
  }

  if (largestDiscretionary.name) {
    highlights.push({
      icon: '🛍️',
      title: 'Top Discretionary',
      value: largestDiscretionary.name,
      description: `${formatCurrency(largestDiscretionary.amount)} spent`,
      positive: false
    });
  }

  const rentIncThis = sum(incThisMonth.filter(t => {
    const n = getCatName(t.categoryId).toLowerCase();
    return n.includes('rent') || n.includes('property');
  }));
  if (rentIncThis > 0 && totalExpThis > 0) {
    const pct = Math.round((rentIncThis / totalExpThis) * 100);
    highlights.push({
      icon: '🏠',
      title: 'Rent Coverage',
      value: `${pct}%`,
      description: 'Of expenses covered by rental income.',
      positive: true
    });
  }

  if (largestUnexpected.name) {
    highlights.push({
      icon: '⚠️',
      title: 'New Expense',
      value: largestUnexpected.name,
      description: `${formatCurrency(largestUnexpected.amount)} unexpected`,
      positive: false
    });
  }

  // Insight Categories
  const expenses = { increases: [], decreases: [], subscriptions: [], utilities: [], otherRecurring: [], investing: [] };
  const income = { total: totalIncThis, topSource: null, insights: [] };

  // Top increases & decreases
  const catDiffs = [];
  // Use a Set to get unique categories from both months
  const allCats = new Set([...Object.keys(expByCatThis), ...Object.keys(expByCatLast)]);
  
  allCats.forEach(cat => {
    const thisV = expByCatThis[cat] || 0;
    const lastV = expByCatLast[cat] || 0;
    if (lastV > 0) {
      const pct = (thisV / lastV - 1) * 100;
      catDiffs.push({ cat, pct, diff: thisV - lastV });
    }
  });

  const sortedIncreases = catDiffs.filter(d => d.pct > 5).sort((a, b) => b.pct - a.pct).slice(0, 3);
  const sortedDecreases = catDiffs.filter(d => d.pct < -5).sort((a, b) => a.pct - b.pct).slice(0, 3);

  sortedIncreases.forEach(d => {
    expenses.increases.push(`${d.cat} spending increased by ${Math.round(d.pct)}% compared to last month.`);
  });
  sortedDecreases.forEach(d => {
    expenses.decreases.push(`${d.cat} spending decreased by ${Math.abs(Math.round(d.pct))}% compared to last month.`);
  });

  // Recurring transactions logic (only expenses)
  const recurring = [];
  const recurringSubscriptions = [];
  const recurringUtilities = [];

  const getDescCount = (txs) => {
    const counts = {};
    txs.forEach(t => {
      const desc = (t.description || '').toLowerCase().trim();
      counts[desc] = (counts[desc] || 0) + 1;
    });
    return counts;
  };

  const descCountThis = getDescCount(expThisMonth);
  const descCountLast = getDescCount(expLastMonth);

  expThisMonth.forEach(t => {
    const desc = (t.description || '').toLowerCase().trim();
    const catName = getCatName(t.categoryId);

    const matchesLast = expLastMonth.filter(lt => 
      lt.categoryId === t.categoryId && 
      (lt.description || '').toLowerCase().trim() === desc
    );

    if (matchesLast.length > 0) {
      const freqThis = descCountThis[desc];
      const freqLast = descCountLast[desc];
      const isExactAmount = matchesLast.some(lt => lt.amount === t.amount);
      const isDailyCategory = ['Food', 'Dining', 'Shopping', 'Transport'].includes(catName);

      let isRecurring = false;

      if (catName === 'Subscriptions' || catName === 'Utilities' || catName === 'Housing') {
        isRecurring = true;
      } else if (!isDailyCategory && catName !== 'Investing') {
        if ((freqThis === 1 && freqLast === 1) || isExactAmount) {
          isRecurring = true;
        }
      } else {
        if (freqThis === 1 && freqLast === 1 && isExactAmount) {
          isRecurring = true;
        }
      }

      if (isRecurring && desc) {
        if (catName === 'Subscriptions') {
          if (!recurringSubscriptions.find(x => (x.description || '').toLowerCase().trim() === desc)) {
            recurringSubscriptions.push(t);
          }
        } else if (catName === 'Utilities') {
          if (!recurringUtilities.find(x => (x.description || '').toLowerCase().trim() === desc)) {
            recurringUtilities.push(t);
          }
        } else {
          if (!recurring.find(x => (x.description || '').toLowerCase().trim() === desc)) {
            recurring.push(t);
          }
        }
      }
    }
  });

  if (expByCatThis['Subscriptions'] > 0 || recurringSubscriptions.length > 0) {
    expenses.subscriptions.push({
      type: 'twistie',
      title: `Subscriptions Total: ${formatCurrency(expByCatThis['Subscriptions'] || 0)}`,
      items: recurringSubscriptions.length > 0 
        ? recurringSubscriptions.map(t => `${t.description} - ${formatCurrency(t.amount)}`)
        : ['No recurring subscriptions detected.']
    });
  }

  if (expByCatThis['Utilities'] > 0 || recurringUtilities.length > 0) {
    expenses.utilities.push({
      type: 'twistie',
      title: `Utilities Total: ${formatCurrency(expByCatThis['Utilities'] || 0)}`,
      items: recurringUtilities.length > 0
        ? recurringUtilities.map(t => `${t.description} - ${formatCurrency(t.amount)}`)
        : ['No recurring utilities detected.']
    });
  }

  if (recurring.length > 0) {
    const totalOther = recurring.reduce((acc, t) => acc + t.amount, 0);
    expenses.otherRecurring.push({
      type: 'twistie',
      title: `Other Recurring: ${formatCurrency(totalOther)}`,
      items: recurring.map(t => `${t.description} (${getCatName(t.categoryId)}) - ${formatCurrency(t.amount)}`)
    });
  }

  // Investing Insights
  const invThisMonth = expThisMonth.filter(t => getCatName(t.categoryId) === 'Investing');
  if (invThisMonth.length > 0) {
    const invTotal = sum(invThisMonth);
    expenses.investing.push(`You invested ${formatCurrency(invTotal)} this month. Great job!`);
  } else {
    expenses.investing.push("You haven't made any investments this month. Consider setting some money aside!");
  }

  // Income Insights
  if (totalIncThis > 0) {
    const incByCat = {};
    incThisMonth.forEach(t => {
      const cat = getCatName(t.categoryId);
      incByCat[cat] = (incByCat[cat] || 0) + t.amount;
    });
    const topSource = Object.entries(incByCat).sort((a, b) => b[1] - a[1])[0];
    if (topSource) {
      income.topSource = topSource[0];
      income.insights.push(`Your top income source this month is ${topSource[0]} (${formatCurrency(topSource[1])}).`);
    }

    if (totalIncLast > 0) {
      if (totalIncThis > totalIncLast) {
        const diff = ((totalIncThis / totalIncLast) - 1) * 100;
        income.insights.push(`Your income increased by ${Math.round(diff)}% compared to last month.`);
      } else if (totalIncThis < totalIncLast) {
        const diff = (1 - (totalIncThis / totalIncLast)) * 100;
        income.insights.push(`Your income decreased by ${Math.round(diff)}% compared to last month.`);
      }
    }
  } else {
    income.insights.push("No income recorded this month.");
  }

  // Missing income
  const expectedIncomes = ['Salary', 'Rent', 'Property', 'Freelance']; 
  expectedIncomes.forEach(incName => {
    const hadLastMonth = incLastMonth.some(t => getCatName(t.categoryId) === incName);
    const hasThisMonth = incThisMonth.some(t => getCatName(t.categoryId) === incName);
    if (hadLastMonth && !hasThisMonth) {
      income.insights.push(`You haven't received ${incName} yet this month.`);
    }
  });

  return {
    highlights,
    expenses,
    income
  };
}
