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
    .slice(0, 5)
    .map(t => ({ ...t, categoryName: categories.find(c => c.id === t.categoryId)?.name || 'Uncategorized' }));

  // Behavioral Patterns
  const getCatName = (id) => categories.find(c => c.id === id)?.name || 'Uncategorized';
  const vendorCounts = {};
  let subscriptionsList = {};
  
  txInHorizon.filter(t => t.type === 'Expense').forEach(tx => {
    const catName = getCatName(tx.categoryId).toLowerCase();
    const rawDesc = (tx.description || '').toLowerCase();
    const isSubscription = catName.includes('subscript') || rawDesc.includes('alimony') || rawDesc.includes('support') || rawDesc.includes('maintenance') || rawDesc.includes('tuition') || rawDesc.includes('child care');
    let desc = rawDesc.replace(/[0-9#\-_,.*]/g, ' ').replace(/\s+/g, ' ').trim();
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

  const travelTx = txInHorizon.filter(t => t.type === 'Expense' && getCatName(t.categoryId).toLowerCase().includes('travel'));
  const totalTravelSpend = travelTx.reduce((sum, t) => sum + t.amount, 0);
  
  const travelBreakdown = {
    accommodation: 0,
    transit: 0,
    dining: 0,
    activities: 0,
    shopping: 0,
    other: 0
  };

  const diningKws = ['din', 'restaur', 'café', 'cafe', 'lunch', 'dinner', 'breakfast', 'brunch', 'food', 'meal', 'snack', 'bar', 'pub', 'drink', 'bistro', 'pizzeria', 'gelato', 'ice cream', 'bakery', 'patisserie', 'supermarket', 'grocery', 'market', 'mega image', 'carrefour', 'lidl', 'kaufland', 'spar', 'billa', 'rewe', 'tesco', 'coffee', 'starbucks', 'costa', 'mcdonald', 'burger', 'pizza', 'sushi'];
  const accomKws = ['hotel', 'resort', 'airbnb', 'lodg', 'stay', 'accom', 'motel', 'booking', 'booking.com', 'expedia', 'marriott', 'hilton', 'radisson', 'sheraton', 'hyatt', 'ibero', 'hostel', 'villa', 'chalet', 'apartment', 'vrbo', 'agoda', 'hotels.com', 'room'];
  const transitKws = ['flight', 'train', 'uber', 'bolt', 'taxi', 'rental', 'gas', 'fuel', 'transit', 'airport', 'bus', 'metro', 'subway', 'coach', 'ferry', 'boat', 'toll', 'vignette', 'parking', 'park', 'ryanair', 'wizz', 'tarom', 'lufthansa', 'klm', 'air france', 'british airways', 'emirates', 'qatar', 'hertz', 'sixt', 'avis', 'europcar', 'budget', 'rail', 'obb', 'cfr', 'tren', 'cab', 'airline', 'airways', 'car share'];
  const actKws = ['ticket', 'museum', 'zoo', 'tour', 'palace', 'park', 'pass', 'ski', 'show', 'nora', 'excursion', 'guide', 'attraction', 'gallery', 'castle', 'cathedral', 'church', 'monument', 'aquarium', 'concert', 'theatre', 'theater', 'cinema', 'kid', 'child', 'boat trip', 'cruise', 'rental bike', 'cable car', 'gondola', 'lift', 'entertainment', 'adventure'];
  const shopKws = ['shop', 'souvenir', 'gift', 'duty free', 'chocolat', 'cloth', 'mall', 'store', 'boutique', 'craft', 'handicraft', 'art', 'merchandise', 'merch', 'fashion', 'zara', 'h&m'];

  const uniqueDates = new Set();
  travelTx.forEach(t => {
    uniqueDates.add(t.date);
    // Multi-field discovery: concatenate description, notes, and tags into a single searchable text blob
    const text = [t.description, t.notes, ...(Array.isArray(t.tags) ? t.tags : [])].filter(Boolean).join(' ').toLowerCase();
    
    if (accomKws.some(k => text.includes(k))) {
      travelBreakdown.accommodation += t.amount;
    } else if (transitKws.some(k => text.includes(k))) {
      travelBreakdown.transit += t.amount;
    } else if (diningKws.some(k => text.includes(k))) {
      travelBreakdown.dining += t.amount;
    } else if (actKws.some(k => text.includes(k))) {
      travelBreakdown.activities += t.amount;
    } else if (shopKws.some(k => text.includes(k))) {
      travelBreakdown.shopping += t.amount;
    } else {
      // Intelligent fallback heuristic for unrecognized travel expenses:
      // Large lump sums (>= 500) on vacation are statistically upfront structural bookings (accommodation/flights)
      // Smaller daily transactions (< 500) are statistically on-the-ground expenses (dining/activities/other)
      if (t.amount >= 500) {
        travelBreakdown.accommodation += t.amount;
      } else {
        travelBreakdown.other += t.amount;
      }
    }
  });

  const prepaidSpending = travelBreakdown.accommodation + travelBreakdown.transit;
  const inDestinationSpending = travelBreakdown.dining + travelBreakdown.activities + travelBreakdown.shopping + travelBreakdown.other;
  const topTravelTx = [...travelTx].sort((a, b) => b.amount - a.amount).slice(0, 3);
  const averageTxAmount = travelTx.length > 0 ? totalTravelSpend / travelTx.length : 0;

  // Previous period comparison
  const prevTravelTx = prevTxInHorizon.filter(t => t.type === 'Expense' && getCatName(t.categoryId).toLowerCase().includes('travel'));
  const prevTotalSpend = prevTravelTx.reduce((sum, t) => sum + t.amount, 0);
  const diffFromPrev = totalTravelSpend - prevTotalSpend;
  const pctChangeFromPrev = prevTotalSpend > 0 ? (diffFromPrev / prevTotalSpend) : null;

  // Dominant subcategory
  const subcatLabels = {
    accommodation: '🏨 Accommodation & Resort',
    transit: '✈️ Transit & Flights',
    dining: '🍽️ Dining & Bar',
    activities: '🎟️ Tours & Activities',
    shopping: '🛍️ Souvenirs & Shopping',
    other: '📦 Other Overhead'
  };
  const dominantEntry = Object.entries(travelBreakdown).sort((a, b) => b[1] - a[1])[0];
  const dominantSubcategory = dominantEntry && dominantEntry[1] > 0 ? {
    key: dominantEntry[0],
    label: subcatLabels[dominantEntry[0]],
    amount: dominantEntry[1],
    percentage: (dominantEntry[1] / totalTravelSpend)
  } : null;

  // Historical pattern deviation check
  const allTravelExpenses = transactions.filter(t => t.type === 'Expense' && getCatName(t.categoryId).toLowerCase().includes('travel'));
  const monthlyTravelTotals = {};
  allTravelExpenses.forEach(t => {
    if (!t.date) return;
    const ym = t.date.substring(0, 7);
    monthlyTravelTotals[ym] = (monthlyTravelTotals[ym] || 0) + t.amount;
  });
  const historicalMonthlyValues = Object.values(monthlyTravelTotals);
  const avgHistoricalSpend = historicalMonthlyValues.length > 0 ? historicalMonthlyValues.reduce((a, b) => a + b, 0) / historicalMonthlyValues.length : 0;
  
  let unusualSpending = null;
  if (avgHistoricalSpend > 0 && totalTravelSpend > avgHistoricalSpend * 1.5 && (totalTravelSpend - avgHistoricalSpend) > 500) {
    const pctAbove = ((totalTravelSpend - avgHistoricalSpend) / avgHistoricalSpend) * 100;
    unusualSpending = {
      type: 'high',
      pctAbove: Math.round(pctAbove),
      avgHistorical: avgHistoricalSpend,
      message: `Travel spending in this period is ${Math.round(pctAbove)}% above your historical monthly travel average.`
    };
  } else if (avgHistoricalSpend > 0 && totalTravelSpend < avgHistoricalSpend * 0.4 && totalTravelSpend > 0 && avgHistoricalSpend > 1000) {
    unusualSpending = {
      type: 'low',
      avgHistorical: avgHistoricalSpend,
      message: `Travel spending in this period is noticeably below your usual travel baseline.`
    };
  }

  const travelAnalysis = {
    totalSpend: totalTravelSpend,
    count: travelTx.length,
    averageTxAmount,
    breakdown: travelBreakdown,
    prepaidSpending,
    inDestinationSpending,
    topExpenses: topTravelTx,
    shareOfTotalExpense: currentMetrics.totalExpense > 0 ? totalTravelSpend / currentMetrics.totalExpense : 0,
    prevTotalSpend,
    diffFromPrev,
    pctChangeFromPrev,
    dominantSubcategory,
    unusualSpending,
    avgHistoricalSpend
  };

  // --- PROPERTY INSIGHTS ENGINE (OPERATIONS DASHBOARD) ---
  const isPropertyTx = t => {
    const cat = getCatName(t.categoryId).toLowerCase();
    const text = [t.description, t.notes, ...(Array.isArray(t.tags) ? t.tags : [])].filter(Boolean).join(' ').toLowerCase();
    return cat.includes('propert') || cat.includes('rental') || cat.includes('real estate') || text.includes('propert') || text.includes('tenant') || text.includes('mortgage') || text.includes('rental');
  };
  const propTx = txInHorizon.filter(isPropertyTx);
  const propIncTx = propTx.filter(t => t.type === 'Income');
  const propExpTx = propTx.filter(t => t.type === 'Expense');
  const totalPropIncome = propIncTx.reduce((sum, t) => sum + t.amount, 0);
  const totalPropExpense = propExpTx.reduce((sum, t) => sum + t.amount, 0);
  const netPropertyFlow = totalPropIncome - totalPropExpense;
  const propExpenseRatio = totalPropIncome > 0 ? (totalPropExpense / totalPropIncome) : null;

  const propBreakdown = {
    mortgage: 0,
    maintenance: 0,
    taxes: 0,
    utilities: 0,
    other: 0
  };
  const propMortgageKws = ['mortgage', 'loan', 'rate', 'credit', 'interest', 'banca', 'bank'];
  const propMaintKws = ['repair', 'fix', 'plumb', 'electric', 'mainten', 'boiler', 'ac', 'paint', 'leak', 'handyman', 'contractor', 'repairs'];
  const propTaxKws = ['tax', 'impozit', 'asigurare', 'insurance', 'pad', 'fee', 'duty'];
  const propUtilKws = ['utilit', 'hoa', 'water', 'gas', 'electric', 'internet', 'maintenance fee', 'administratie', 'gunoi', 'curatenie'];

  propExpTx.forEach(t => {
    const text = [t.description, t.notes, ...(Array.isArray(t.tags) ? t.tags : [])].filter(Boolean).join(' ').toLowerCase();
    if (propMortgageKws.some(k => text.includes(k))) propBreakdown.mortgage += t.amount;
    else if (propMaintKws.some(k => text.includes(k))) propBreakdown.maintenance += t.amount;
    else if (propTaxKws.some(k => text.includes(k))) propBreakdown.taxes += t.amount;
    else if (propUtilKws.some(k => text.includes(k))) propBreakdown.utilities += t.amount;
    else propBreakdown.other += t.amount;
  });

  const topPropExpenses = [...propExpTx].sort((a, b) => b.amount - a.amount).slice(0, 3).map(tx => ({
    ...tx,
    percentageOfExpense: totalPropExpense > 0 ? (tx.amount / totalPropExpense) * 100 : 0
  }));

  // Previous period Property comparison & Driver Analysis
  const prevPropTx = prevTxInHorizon.filter(isPropertyTx);
  const prevPropIncome = prevPropTx.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
  const prevPropExpense = prevPropTx.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0);
  const prevNetPropertyFlow = prevPropIncome - prevPropExpense;
  const diffPropFlowFromPrev = netPropertyFlow - prevNetPropertyFlow;
  const diffIncomeFromPrev = totalPropIncome - prevPropIncome;
  const diffExpenseFromPrev = totalPropExpense - prevPropExpense;
  const prevExpenseRatio = prevPropIncome > 0 ? (prevPropExpense / prevPropIncome) : null;
  const diffRatioFromPrev = (propExpenseRatio !== null && prevExpenseRatio !== null) ? (propExpenseRatio - prevExpenseRatio) : null;

  const prevPropBreakdown = { mortgage: 0, maintenance: 0, taxes: 0, utilities: 0, other: 0 };
  prevPropTx.filter(t => t.type === 'Expense').forEach(t => {
    const text = [t.description, t.notes, ...(Array.isArray(t.tags) ? t.tags : [])].filter(Boolean).join(' ').toLowerCase();
    if (propMortgageKws.some(k => text.includes(k))) prevPropBreakdown.mortgage += t.amount;
    else if (propMaintKws.some(k => text.includes(k))) prevPropBreakdown.maintenance += t.amount;
    else if (propTaxKws.some(k => text.includes(k))) prevPropBreakdown.taxes += t.amount;
    else if (propUtilKws.some(k => text.includes(k))) prevPropBreakdown.utilities += t.amount;
    else prevPropBreakdown.other += t.amount;
  });

  // Dominant Property Subcategory & Growth Driver
  const propSubcatLabels = {
    mortgage: '🏦 Mortgage & Loans',
    maintenance: '🛠️ Maintenance & Repairs',
    taxes: '🏛️ Taxes & Insurance',
    utilities: '💡 Utilities & HOA Fees',
    other: '📦 Property Overhead'
  };
  const dominantPropEntry = Object.entries(propBreakdown).sort((a, b) => b[1] - a[1])[0];
  const dominantPropSubcat = dominantPropEntry && dominantPropEntry[1] > 0 ? {
    key: dominantPropEntry[0],
    label: propSubcatLabels[dominantPropEntry[0]],
    amount: dominantPropEntry[1],
    percentage: totalPropExpense > 0 ? (dominantPropEntry[1] / totalPropExpense) : 0
  } : null;

  const growthDrivers = Object.keys(propBreakdown).map(k => ({
    key: k,
    label: propSubcatLabels[k],
    diff: propBreakdown[k] - (prevPropBreakdown[k] || 0)
  })).sort((a, b) => b.diff - a.diff);
  const primaryDriver = growthDrivers[0] && growthDrivers[0].diff > 30 ? growthDrivers[0] : null;

  // Property Historical Deviation Alert with Driver
  const allPropExp = transactions.filter(t => t.type === 'Expense' && isPropertyTx(t));
  const monthlyPropTotals = {};
  allPropExp.forEach(t => {
    if (!t.date) return;
    const ym = t.date.substring(0, 7);
    monthlyPropTotals[ym] = (monthlyPropTotals[ym] || 0) + t.amount;
  });
  const histPropVals = Object.values(monthlyPropTotals);
  const avgHistPropExpense = histPropVals.length > 0 ? histPropVals.reduce((a, b) => a + b, 0) / histPropVals.length : 0;
  
  let propUnusualSpending = null;
  if (avgHistPropExpense > 0 && totalPropExpense > avgHistPropExpense * 1.25 && (totalPropExpense - avgHistPropExpense) > 150) {
    const pctAbove = ((totalPropExpense - avgHistPropExpense) / avgHistPropExpense) * 100;
    const driverText = primaryDriver ? `, driven primarily by a $${Math.round(primaryDriver.diff)} increase in ${primaryDriver.label}` : '';
    propUnusualSpending = {
      type: 'high',
      pctAbove: Math.round(pctAbove),
      message: `Property operating overhead is ${Math.round(pctAbove)}% above your monthly baseline ($${Math.round(totalPropExpense - avgHistPropExpense)} above average)${driverText}.`
    };
  }

  // Compact Net Cash Flow Trend (Last 4 Active Months)
  const allPropTx = transactions.filter(isPropertyTx);
  const monthlyCashFlowMap = {};
  allPropTx.forEach(t => {
    if (!t.date) return;
    const ym = t.date.substring(0, 7);
    if (!monthlyCashFlowMap[ym]) monthlyCashFlowMap[ym] = { income: 0, expense: 0, net: 0, month: ym };
    if (t.type === 'Income') monthlyCashFlowMap[ym].income += t.amount;
    if (t.type === 'Expense') monthlyCashFlowMap[ym].expense += t.amount;
    monthlyCashFlowMap[ym].net = monthlyCashFlowMap[ym].income - monthlyCashFlowMap[ym].expense;
  });
  const cashFlowTrend = Object.values(monthlyCashFlowMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-4);

  // Deterministic Operations Summary
  let operationsSummary = '';
  if (netPropertyFlow > 0) {
    operationsSummary = `Properties generated a healthy positive cash flow of $${Math.round(netPropertyFlow)} on $${Math.round(totalPropIncome)} in gross rental revenue (operating ratio: ${propExpenseRatio !== null ? `${(propExpenseRatio * 100).toFixed(0)}%` : '0%'}). `;
  } else if (totalPropIncome > 0) {
    operationsSummary = `Operating overhead ($${Math.round(totalPropExpense)}) exceeded gross revenue ($${Math.round(totalPropIncome)}), resulting in a net deficit of $${Math.round(Math.abs(netPropertyFlow))}. `;
  } else {
    operationsSummary = `Logged $${Math.round(totalPropExpense)} in property operating overhead with no rental revenue recorded during this period. `;
  }

  if (propUnusualSpending && primaryDriver) {
    operationsSummary += `Noticeable expenditure spike driven by ${primaryDriver.label} ($${Math.round(propBreakdown[primaryDriver.key])}).`;
  } else if (diffExpenseFromPrev !== 0 && prevPropExpense > 0) {
    const dir = diffExpenseFromPrev > 0 ? 'increased' : 'decreased';
    operationsSummary += `Operating overhead ${dir} by $${Math.round(Math.abs(diffExpenseFromPrev))} vs. previous period, with routine structural costs under control.`;
  } else {
    operationsSummary += `Operating overhead and net cash flow remained stable with no unexpected maintenance deviations.`;
  }

  const propertyAnalysis = (totalPropIncome > 0 || totalPropExpense > 0) ? {
    totalIncome: totalPropIncome,
    totalExpense: totalPropExpense,
    netFlow: netPropertyFlow,
    expenseRatio: propExpenseRatio,
    count: propTx.length,
    breakdown: propBreakdown,
    topExpenses: topPropExpenses,
    prevNetFlow: prevNetPropertyFlow,
    diffFlowFromPrev: diffPropFlowFromPrev,
    prevTotalIncome: prevPropIncome,
    diffIncomeFromPrev,
    prevTotalExpense: prevPropExpense,
    diffExpenseFromPrev,
    prevExpenseRatio,
    diffRatioFromPrev,
    dominantSubcategory: dominantPropSubcat,
    unusualSpending: propUnusualSpending,
    cashFlowTrend,
    operationsSummary,
    shareOfTotalExpense: currentMetrics.totalExpense > 0 ? totalPropExpense / currentMetrics.totalExpense : 0
  } : null;

  // --- NORA INSIGHTS ENGINE ---
  const isNoraTx = t => {
    if (t.type !== 'Expense') return false;
    const cat = getCatName(t.categoryId).toLowerCase();
    const text = [t.description, t.notes, ...(Array.isArray(t.tags) ? t.tags : [])].filter(Boolean).join(' ').toLowerCase();
    return cat.includes('nora') || cat.includes('child') || text.includes('nora') || text.includes('daughter') || text.includes('child support') || text.includes('alimony');
  };
  const noraTx = txInHorizon.filter(isNoraTx);
  const totalNoraSpend = noraTx.reduce((sum, t) => sum + t.amount, 0);
  const averageNoraTx = noraTx.length > 0 ? totalNoraSpend / noraTx.length : 0;

  const noraBreakdown = {
    education: 0,
    activities: 0,
    health: 0,
    clothes: 0,
    gifts: 0,
    other: 0
  };
  const noraEduKws = ['school', 'tuition', 'support', 'alimony', 'kindergarten', 'afterschool', 'education', 'book', 'course', 'class'];
  const noraActKws = ['swim', 'tennis', 'sport', 'club', 'workshop', 'activity', 'camp', 'piano', 'dance', 'gym', 'zoo', 'park', 'attraction'];
  const noraHealthKws = ['doctor', 'pediatrician', 'health', 'med', 'pharmacy', 'dentist', 'clinic', 'checkup'];
  const noraClothKws = ['cloth', 'shoe', 'jacket', 'coat', 'wear', 'dress', 'fashion', 'zara', 'h&m'];
  const noraGiftKws = ['toy', 'gift', 'game', 'lego', 'doll', 'birthday', 'christmas', 'party'];

  noraTx.forEach(t => {
    const text = [t.description, t.notes, ...(Array.isArray(t.tags) ? t.tags : [])].filter(Boolean).join(' ').toLowerCase();
    if (noraEduKws.some(k => text.includes(k))) noraBreakdown.education += t.amount;
    else if (noraActKws.some(k => text.includes(k))) noraBreakdown.activities += t.amount;
    else if (noraHealthKws.some(k => text.includes(k))) noraBreakdown.health += t.amount;
    else if (noraClothKws.some(k => text.includes(k))) noraBreakdown.clothes += t.amount;
    else if (noraGiftKws.some(k => text.includes(k))) noraBreakdown.gifts += t.amount;
    else noraBreakdown.other += t.amount;
  });

  const topNoraExpenses = [...noraTx].sort((a, b) => b.amount - a.amount).slice(0, 3);

  // Previous period Nora comparison
  const prevNoraTx = prevTxInHorizon.filter(isNoraTx);
  const prevTotalNoraSpend = prevNoraTx.reduce((sum, t) => sum + t.amount, 0);
  const diffNoraFromPrev = totalNoraSpend - prevTotalNoraSpend;
  const pctChangeNoraFromPrev = prevTotalNoraSpend > 0 ? (diffNoraFromPrev / prevTotalNoraSpend) : null;

  // Dominant Nora Subcategory
  const noraSubcatLabels = {
    education: '📚 Education & Child Support',
    activities: '🎟️ Sports & Extracurriculars',
    health: '🏥 Healthcare & Pediatrician',
    clothes: '👗 Clothing & Shoes',
    gifts: '🎁 Toys & Gifts',
    other: '📦 Other Child Overhead'
  };
  const dominantNoraEntry = Object.entries(noraBreakdown).sort((a, b) => b[1] - a[1])[0];
  const dominantNoraSubcat = dominantNoraEntry && dominantNoraEntry[1] > 0 ? {
    key: dominantNoraEntry[0],
    label: noraSubcatLabels[dominantNoraEntry[0]],
    amount: dominantNoraEntry[1],
    percentage: totalNoraSpend > 0 ? (dominantNoraEntry[1] / totalNoraSpend) : 0
  } : null;

  // Nora Historical Deviation Alert
  const allNoraExp = transactions.filter(isNoraTx);
  const monthlyNoraTotals = {};
  allNoraExp.forEach(t => {
    if (!t.date) return;
    const ym = t.date.substring(0, 7);
    monthlyNoraTotals[ym] = (monthlyNoraTotals[ym] || 0) + t.amount;
  });
  const histNoraVals = Object.values(monthlyNoraTotals);
  const avgHistNoraSpend = histNoraVals.length > 0 ? histNoraVals.reduce((a, b) => a + b, 0) / histNoraVals.length : 0;
  
  let noraUnusualSpending = null;
  if (avgHistNoraSpend > 0 && totalNoraSpend > avgHistNoraSpend * 1.35 && (totalNoraSpend - avgHistNoraSpend) > 250) {
    const pctAbove = ((totalNoraSpend - avgHistNoraSpend) / avgHistNoraSpend) * 100;
    noraUnusualSpending = {
      type: 'high',
      pctAbove: Math.round(pctAbove),
      message: `Child-related spending is ${Math.round(pctAbove)}% above your historical monthly average due to seasonal tuition or gifts.`
    };
  }

  const noraAnalysis = totalNoraSpend > 0 ? {
    totalSpend: totalNoraSpend,
    count: noraTx.length,
    averageTxAmount: averageNoraTx,
    breakdown: noraBreakdown,
    topExpenses: topNoraExpenses,
    shareOfTotalExpense: currentMetrics.totalExpense > 0 ? totalNoraSpend / currentMetrics.totalExpense : 0,
    prevTotalSpend: prevTotalNoraSpend,
    diffFromPrev: diffNoraFromPrev,
    pctChangeFromPrev: pctChangeNoraFromPrev,
    dominantSubcategory: dominantNoraSubcat,
    unusualSpending: noraUnusualSpending,
    avgHistoricalSpend: avgHistNoraSpend
  } : null;

  const behavioral = {
    frequentSpending,
    subscriptions: Object.values(subscriptionsList).sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
    spendingByCategoryChange,
    largestTransactions,
    travelAnalysis,
    propertyAnalysis,
    noraAnalysis
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
