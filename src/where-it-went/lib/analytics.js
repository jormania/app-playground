export function generateInsights(data) {
  const { categories, transactions } = data;
  if (!transactions || transactions.length === 0) {
    return {
      review: "Not enough data to generate a review this month.",
      insights: []
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

  // Calculate review text
  let reviewText = "Reviewing this month: ";
  if (totalExpLast > 0) {
    if (totalExpThis < totalExpLast) {
      const diff = Math.round((1 - totalExpThis / totalExpLast) * 100);
      reviewText += `You spent ${diff}% less than last month. `;
    } else {
      const diff = Math.round((totalExpThis / totalExpLast - 1) * 100);
      reviewText += `You spent ${diff}% more than last month. `;
    }
  } else {
    reviewText += `You spent ${totalExpThis.toFixed(2)} RON this month. `;
  }

  if (largestDiscretionary.name) {
    reviewText += `${largestDiscretionary.name} was your largest discretionary category. `;
  }

  const rentIncThis = sum(incThisMonth.filter(t => {
    const n = getCatName(t.categoryId).toLowerCase();
    return n.includes('rent') || n.includes('property');
  }));
  if (rentIncThis > 0 && totalExpThis > 0) {
    const pct = Math.round((rentIncThis / totalExpThis) * 100);
    reviewText += `Rental income covered ${pct}% of total expenses. `;
  }

  if (largestUnexpected.name) {
    reviewText += `Your largest new or unexpected expense was ${largestUnexpected.name}. `;
  }

  // Reflection question
  const questions = [
    "Looking back, which expense brought you the most value this month?",
    "Were there any purchases you regret this month?",
    "What is one small habit you could change to improve your cash flow next month?",
    "Did your spending align with your personal goals this month?"
  ];
  const question = questions[new Date().getDate() % questions.length];

  // Insights List
  const insights = [];

  // Recurring transactions logic (same amount, same category as last month)
  const recurring = [];
  txThisMonth.forEach(t => {
    const matchLast = txLastMonth.find(lt => lt.categoryId === t.categoryId && lt.amount === t.amount);
    if (matchLast && !recurring.includes(t.description)) {
      recurring.push(t.description);
    }
  });
  if (recurring.length > 0) {
    insights.push(`Recurring detected: ${recurring.slice(0, 3).join(', ')}${recurring.length > 3 ? '...' : ''}.`);
  }

  // Missing income
  const expectedIncomes = ['Salary', 'Rent', 'Property', 'Checking']; // based on typical names
  expectedIncomes.forEach(incName => {
    const hadLastMonth = incLastMonth.some(t => getCatName(t.categoryId) === incName);
    const hasThisMonth = incThisMonth.some(t => getCatName(t.categoryId) === incName);
    if (hadLastMonth && !hasThisMonth) {
      insights.push(`You haven't received ${incName} yet this month.`);
    }
  });

  // Category trends
  ['Dining', 'Restaurant', 'Food', 'Shopping', 'Travel'].forEach(cat => {
    const thisV = expByCatThis[cat];
    const lastV = expByCatLast[cat];
    if (thisV && lastV && lastV > 0) {
      if (thisV > lastV) {
        const pct = Math.round((thisV / lastV - 1) * 100);
        if (pct > 10) insights.push(`${cat} spending increased ${pct}% compared to last month.`);
      }
    }
  });

  // Fixed Subscriptions
  ['Subscriptions', 'Utilities'].forEach(cat => {
    if (expByCatThis[cat] > 0) {
      insights.push(`${cat} total ${expByCatThis[cat].toFixed(2)} RON/month.`);
    }
  });

  return {
    review: reviewText.trim(),
    question,
    insights
  };
}
