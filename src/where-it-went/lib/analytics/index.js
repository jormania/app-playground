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

  const behavioral = {
    frequentSpending,
    subscriptions: Object.values(subscriptionsList).sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
    spendingByCategoryChange,
    largestTransactions,
    travelAnalysis
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
