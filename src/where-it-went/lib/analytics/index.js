import { calculateMetrics, categoryIndex } from './metrics';
import {
  getHistoricalAverages,
  getCumulativePaceByDay,
  getHistoricalTransactionAverages,
  monthlyBaseline
} from './comparisons';
import { ruleOverspendingPace, ruleCategorySpike, ruleLargeTransaction, generateWins, rankAlerts } from './rules';
import { generateSummaryParagraph } from './summaries';
import { formatCurrency } from '../currency';
import {
  RULES,
  TRAVEL_KEYWORDS,
  PROPERTY_KEYWORDS,
  NORA_KEYWORDS,
  OBLIGATION_KEYWORDS,
  matchesAny
} from './constants';
import { filterByPeriod, filterByPreviousPeriod, parseTxDate, toMonthKey } from '../period';

/** Description + notes + tags, lower-cased — the text every classifier reads. */
function searchText(tx) {
  return [tx.description, tx.notes, ...(Array.isArray(tx.tags) ? tx.tags : [])]
    .filter(Boolean).join(' ').toLowerCase();
}

/** First bucket whose keywords match, else `fallback`. */
function classify(text, buckets, fallback = 'other') {
  for (const [key, keywords] of Object.entries(buckets)) {
    if (matchesAny(text, keywords)) return key;
  }
  return fallback;
}

function sumInto(buckets, key, amount) {
  buckets[key] = (buckets[key] || 0) + amount;
}

/** Applies the type/category/search filters (period handling lives in lib/period). */
function applyFilters(transactions, byId, accountsById, filterProps) {
  const { filterType = 'All', categoryFilter = 'All', searchQuery = '' } = filterProps || {};
  const q = searchQuery.trim().toLowerCase();

  return transactions.filter(t => {
    if (filterType !== 'All' && t.type !== filterType) return false;
    if (categoryFilter !== 'All' && t.categoryId !== categoryFilter) return false;
    if (!q) return true;
    // Same fields as the Dashboard and the ledger — the three views used to search
    // different things for the same query.
    const desc = (t.description || '').toLowerCase();
    const cat = (byId.get(t.categoryId)?.name || '').toLowerCase();
    const acc = (accountsById.get(t.accountId)?.name || '').toLowerCase();
    const notes = (t.notes || '').toLowerCase();
    return desc.includes(q) || cat.includes(q) || acc.includes(q) || notes.includes(q);
  });
}

export function generateDeepInsights(data, period = 'this_month', filterProps = null, now = new Date()) {
  const { categories, transactions, accounts } = data || {};
  if (!transactions || transactions.length === 0) return null;

  const byId = categoryIndex(categories);
  const accountsById = new Map((accounts || []).map(a => [a.id, a]));
  const getCatName = (id) => byId.get(id)?.name || 'Uncategorized';

  const scoped = applyFilters(transactions, byId, accountsById, filterProps);
  const txInHorizon = filterByPeriod(scoped, period, now);
  // Nothing in the selected window: the caller shows an empty state rather than a
  // dashboard full of zeroes and NaN percentages.
  if (txInHorizon.length === 0) return null;

  const prevTxInHorizon = filterByPreviousPeriod(scoped, period, now);

  const currentMetrics = calculateMetrics(txInHorizon, categories);
  const prevMetrics = calculateMetrics(prevTxInHorizon, categories);

  // ── Category movement ────────────────────────────────────────────────────
  const spendingByCategoryChange = Object.values(currentMetrics.catSums)
    .filter(c => c.type === 'Expense' && (c.total > 0 || (prevMetrics.catSums[c.id]?.total || 0) > 0))
    .map(c => {
      const prev = prevMetrics.catSums[c.id]?.total || 0;
      const curr = c.total;
      const diff = curr - prev;
      let pctChange = 0;
      if (prev > 0) pctChange = (diff / prev) * 100;
      else if (curr > 0) pctChange = 100;
      return { ...c, prevTotal: prev, currTotal: curr, diff, pctChange, absPctChange: Math.abs(pctChange) };
    })
    .sort((a, b) => (b.absPctChange - a.absPctChange) || (Math.abs(b.diff) - Math.abs(a.diff)));

  const largestTransactions = txInHorizon
    .filter(t => t.type === 'Expense')
    .slice()
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map(t => ({ ...t, categoryName: getCatName(t.categoryId) }));

  // ── Behavioural patterns ─────────────────────────────────────────────────
  const vendorCounts = {};
  const subscriptionsList = {};

  txInHorizon.filter(t => t.type === 'Expense').forEach(tx => {
    const catName = getCatName(tx.categoryId).toLowerCase();
    const rawDesc = (tx.description || '').toLowerCase();
    const isSubscription = matchesAny(catName, ['subscript']) || matchesAny(rawDesc, OBLIGATION_KEYWORDS);
    const desc = rawDesc.replace(/[0-9#\-_,.*]/g, ' ').replace(/\s+/g, ' ').trim();
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

  // ── Travel ───────────────────────────────────────────────────────────────
  const matchTrip = t => {
    const tripFilter = filterProps?.tripFilter;
    if (!tripFilter || tripFilter === 'ALL') return true;
    if (tripFilter === 'UNASSIGNED') return !t.tripId;
    return t.tripId === tripFilter;
  };
  const isTravelTx = t => t.type === 'Expense' && matchesAny(getCatName(t.categoryId).toLowerCase(), ['travel']) && matchTrip(t);

  const travelTx = txInHorizon.filter(isTravelTx);
  const totalTravelSpend = travelTx.reduce((sum, t) => sum + t.amount, 0);

  const travelBreakdown = { accommodation: 0, transit: 0, dining: 0, activities: 0, shopping: 0, other: 0 };
  travelTx.forEach(t => {
    const bucket = classify(searchText(t), TRAVEL_KEYWORDS, null);
    if (bucket) {
      sumInto(travelBreakdown, bucket, t.amount);
      return;
    }
    // Unrecognised: a large lump sum on a trip is almost always an upfront booking,
    // small ones are on-the-ground spending.
    sumInto(travelBreakdown, t.amount >= 500 ? 'accommodation' : 'other', t.amount);
  });

  const prepaidSpending = travelBreakdown.accommodation + travelBreakdown.transit;
  const inDestinationSpending = travelBreakdown.dining + travelBreakdown.activities + travelBreakdown.shopping + travelBreakdown.other;
  const topTravelTx = travelTx.slice().sort((a, b) => b.amount - a.amount).slice(0, 3);
  const averageTxAmount = travelTx.length > 0 ? totalTravelSpend / travelTx.length : 0;

  const prevTravelTx = prevTxInHorizon.filter(isTravelTx);
  const prevTotalSpend = prevTravelTx.reduce((sum, t) => sum + t.amount, 0);
  const diffFromPrev = totalTravelSpend - prevTotalSpend;
  const pctChangeFromPrev = prevTotalSpend > 0 ? (diffFromPrev / prevTotalSpend) : null;

  const subcatLabels = {
    accommodation: { iconName: 'accommodation', name: 'Accommodation & Resort' },
    transit: { iconName: 'transit', name: 'Transit & Flights' },
    dining: { iconName: 'dining', name: 'Dining & Bar' },
    activities: { iconName: 'activities', name: 'Tours & Activities' },
    shopping: { iconName: 'shopping', name: 'Souvenirs & Shopping' },
    other: { iconName: 'other', name: 'Travel Overhead' }
  };
  const dominantEntry = Object.entries(travelBreakdown).sort((a, b) => b[1] - a[1])[0];
  const dominantSubcategory = dominantEntry && dominantEntry[1] > 0 ? {
    key: dominantEntry[0],
    ...subcatLabels[dominantEntry[0]],
    amount: dominantEntry[1],
    percentage: totalTravelSpend > 0 ? dominantEntry[1] / totalTravelSpend : 0
  } : null;

  // Baseline excludes the period under review — otherwise a spike dilutes its own alert.
  const travelBaseline = monthlyBaseline(transactions.filter(isTravelTx), period, now);
  let unusualSpending = null;
  if (travelBaseline.months >= RULES.MIN_MONTHS_FOR_BASELINE && travelBaseline.average > 0) {
    if (totalTravelSpend > travelBaseline.average * 1.5 && (totalTravelSpend - travelBaseline.average) > 500) {
      const pctAbove = ((totalTravelSpend - travelBaseline.average) / travelBaseline.average) * 100;
      unusualSpending = {
        type: 'high',
        pctAbove: Math.round(pctAbove),
        avgHistorical: travelBaseline.average,
        message: `Travel spending in this period is ${Math.round(pctAbove)}% above your ${travelBaseline.months}-month travel average.`
      };
    } else if (totalTravelSpend > 0 && totalTravelSpend < travelBaseline.average * 0.4 && travelBaseline.average > 1000) {
      unusualSpending = {
        type: 'low',
        avgHistorical: travelBaseline.average,
        message: 'Travel spending in this period is noticeably below your usual travel baseline.'
      };
    }
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
    avgHistoricalSpend: travelBaseline.average
  };

  // ── Property ─────────────────────────────────────────────────────────────
  const isPropertyTx = t => {
    const cat = getCatName(t.categoryId).toLowerCase();
    if (matchesAny(cat, ['propert', 'rental', 'real estate'])) return true;
    return matchesAny(searchText(t), ['propert', 'tenant', 'mortgage', 'rental']);
  };

  const propTx = txInHorizon.filter(isPropertyTx);
  const propIncTx = propTx.filter(t => t.type === 'Income');
  const propExpTx = propTx.filter(t => t.type === 'Expense');
  const totalPropIncome = propIncTx.reduce((sum, t) => sum + t.amount, 0);
  const totalPropExpense = propExpTx.reduce((sum, t) => sum + t.amount, 0);
  const netPropertyFlow = totalPropIncome - totalPropExpense;
  const propExpenseRatio = totalPropIncome > 0 ? (totalPropExpense / totalPropIncome) : null;

  const emptyPropBuckets = () => ({ mortgage: 0, maintenance: 0, taxes: 0, utilities: 0, other: 0 });
  const propBreakdown = emptyPropBuckets();
  propExpTx.forEach(t => sumInto(propBreakdown, classify(searchText(t), PROPERTY_KEYWORDS), t.amount));

  const topPropExpenses = propExpTx.slice().sort((a, b) => b.amount - a.amount).slice(0, 3).map(tx => ({
    ...tx,
    percentageOfExpense: totalPropExpense > 0 ? (tx.amount / totalPropExpense) * 100 : 0
  }));

  const prevPropTx = prevTxInHorizon.filter(isPropertyTx);
  const prevPropIncome = prevPropTx.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
  const prevPropExpense = prevPropTx.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0);
  const prevNetPropertyFlow = prevPropIncome - prevPropExpense;
  const diffPropFlowFromPrev = netPropertyFlow - prevNetPropertyFlow;
  const diffIncomeFromPrev = totalPropIncome - prevPropIncome;
  const diffExpenseFromPrev = totalPropExpense - prevPropExpense;
  const prevExpenseRatio = prevPropIncome > 0 ? (prevPropExpense / prevPropIncome) : null;
  const diffRatioFromPrev = (propExpenseRatio !== null && prevExpenseRatio !== null) ? (propExpenseRatio - prevExpenseRatio) : null;

  const prevPropBreakdown = emptyPropBuckets();
  prevPropTx.filter(t => t.type === 'Expense')
    .forEach(t => sumInto(prevPropBreakdown, classify(searchText(t), PROPERTY_KEYWORDS), t.amount));

  const propSubcatLabels = {
    mortgage: { iconName: 'mortgage', name: 'Mortgage & Loans' },
    maintenance: { iconName: 'maintenance', name: 'Maintenance & Repairs' },
    taxes: { iconName: 'taxes', name: 'Taxes & Insurance' },
    utilities: { iconName: 'utilities', name: 'Utilities & HOA Fees' },
    other: { iconName: 'other', name: 'Property Overhead' }
  };
  const dominantPropEntry = Object.entries(propBreakdown).sort((a, b) => b[1] - a[1])[0];
  const dominantPropSubcat = dominantPropEntry && dominantPropEntry[1] > 0 ? {
    key: dominantPropEntry[0],
    ...propSubcatLabels[dominantPropEntry[0]],
    amount: dominantPropEntry[1],
    percentage: totalPropExpense > 0 ? (dominantPropEntry[1] / totalPropExpense) : 0
  } : null;

  const growthDrivers = Object.keys(propBreakdown).map(k => ({
    key: k,
    ...propSubcatLabels[k],
    diff: propBreakdown[k] - (prevPropBreakdown[k] || 0)
  })).sort((a, b) => b.diff - a.diff);
  const primaryDriver = growthDrivers[0] && growthDrivers[0].diff > 30 ? growthDrivers[0] : null;

  const propBaseline = monthlyBaseline(transactions.filter(t => t.type === 'Expense' && isPropertyTx(t)), period, now);
  let propUnusualSpending = null;
  if (propBaseline.months >= RULES.MIN_MONTHS_FOR_BASELINE && propBaseline.average > 0 &&
      totalPropExpense > propBaseline.average * 1.25 && (totalPropExpense - propBaseline.average) > 150) {
    const pctAbove = ((totalPropExpense - propBaseline.average) / propBaseline.average) * 100;
    const driverText = primaryDriver
      ? `, driven primarily by a ${formatCurrency(primaryDriver.diff)} increase in ${primaryDriver.name}`
      : '';
    propUnusualSpending = {
      type: 'high',
      pctAbove: Math.round(pctAbove),
      message: `Property operating overhead is ${Math.round(pctAbove)}% above your ${propBaseline.months}-month baseline (${formatCurrency(totalPropExpense - propBaseline.average)} above average)${driverText}.`
    };
  }

  const monthlyCashFlowMap = {};
  transactions.filter(isPropertyTx).forEach(t => {
    const ym = toMonthKey(t.date);
    if (!ym) return;
    if (!monthlyCashFlowMap[ym]) monthlyCashFlowMap[ym] = { income: 0, expense: 0, net: 0, month: ym };
    if (t.type === 'Income') monthlyCashFlowMap[ym].income += t.amount;
    if (t.type === 'Expense') monthlyCashFlowMap[ym].expense += t.amount;
    monthlyCashFlowMap[ym].net = monthlyCashFlowMap[ym].income - monthlyCashFlowMap[ym].expense;
  });
  const cashFlowTrend = Object.values(monthlyCashFlowMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-4);

  let operationsSummary;
  if (netPropertyFlow > 0) {
    operationsSummary = `Properties generated a positive cash flow of ${formatCurrency(netPropertyFlow)} on ${formatCurrency(totalPropIncome)} of gross rental revenue (operating ratio: ${propExpenseRatio !== null ? `${(propExpenseRatio * 100).toFixed(0)}%` : 'n/a'}). `;
  } else if (totalPropIncome > 0) {
    operationsSummary = `Operating overhead (${formatCurrency(totalPropExpense)}) exceeded gross revenue (${formatCurrency(totalPropIncome)}), a net deficit of ${formatCurrency(Math.abs(netPropertyFlow))}. `;
  } else {
    operationsSummary = `Logged ${formatCurrency(totalPropExpense)} of property operating overhead with no rental revenue recorded this period. `;
  }
  if (propUnusualSpending && primaryDriver) {
    operationsSummary += `The spike was driven by ${primaryDriver.name} (${formatCurrency(propBreakdown[primaryDriver.key])}).`;
  } else if (diffExpenseFromPrev !== 0 && prevPropExpense > 0) {
    const dir = diffExpenseFromPrev > 0 ? 'increased' : 'decreased';
    operationsSummary += `Operating overhead ${dir} by ${formatCurrency(Math.abs(diffExpenseFromPrev))} versus the previous period.`;
  } else {
    operationsSummary += 'Operating overhead and net cash flow were stable, with no unexpected maintenance.';
  }

  const propertyAnalysis = {
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
  };

  // ── Family support ───────────────────────────────────────────────────────
  const isNoraTx = t => {
    if (t.type !== 'Expense') return false;
    if (matchesAny(getCatName(t.categoryId).toLowerCase(), ['nora', 'child'])) return true;
    return matchesAny(searchText(t), ['nora', 'daughter', 'child support', 'alimony']);
  };

  const noraTx = txInHorizon.filter(isNoraTx);
  const totalNoraSpend = noraTx.reduce((sum, t) => sum + t.amount, 0);
  const averageNoraTx = noraTx.length > 0 ? totalNoraSpend / noraTx.length : 0;

  const emptyNoraBuckets = () => ({ education: 0, activities: 0, health: 0, clothes: 0, gifts: 0, other: 0 });
  const noraBreakdown = emptyNoraBuckets();
  noraTx.forEach(t => sumInto(noraBreakdown, classify(searchText(t), NORA_KEYWORDS), t.amount));

  const prevNoraTx = prevTxInHorizon.filter(isNoraTx);
  const prevTotalNoraSpend = prevNoraTx.reduce((sum, t) => sum + t.amount, 0);
  const diffNoraFromPrev = totalNoraSpend - prevTotalNoraSpend;
  const pctChangeNoraFromPrev = prevTotalNoraSpend > 0 ? (diffNoraFromPrev / prevTotalNoraSpend) : null;

  const prevNoraBreakdown = emptyNoraBuckets();
  prevNoraTx.forEach(t => sumInto(prevNoraBreakdown, classify(searchText(t), NORA_KEYWORDS), t.amount));

  const noraSubcatLabels = {
    education: { iconName: 'education', name: 'Education & Tuition' },
    activities: { iconName: 'activities', name: 'Sports & Extracurriculars' },
    health: { iconName: 'health', name: 'Healthcare & Pediatrician' },
    clothes: { iconName: 'clothes', name: 'Clothing & Shoes' },
    gifts: { iconName: 'gifts', name: 'Toys & Gifts' },
    other: { iconName: 'other', name: 'Child Overhead' }
  };

  const noraGrowthDrivers = Object.keys(noraBreakdown).map(k => ({
    key: k,
    ...noraSubcatLabels[k],
    diff: noraBreakdown[k] - (prevNoraBreakdown[k] || 0)
  })).sort((a, b) => b.diff - a.diff);
  const noraPrimaryDriver = noraGrowthDrivers[0] && noraGrowthDrivers[0].diff > 20 ? noraGrowthDrivers[0] : null;

  const dominantNoraEntry = Object.entries(noraBreakdown).sort((a, b) => b[1] - a[1])[0];
  const dominantNoraSubcat = dominantNoraEntry && dominantNoraEntry[1] > 0 ? {
    key: dominantNoraEntry[0],
    ...noraSubcatLabels[dominantNoraEntry[0]],
    amount: dominantNoraEntry[1],
    percentage: totalNoraSpend > 0 ? (dominantNoraEntry[1] / totalNoraSpend) : 0
  } : null;

  const noraBaseline = monthlyBaseline(transactions.filter(isNoraTx), period, now);
  let noraUnusualSpending = null;
  let noraSeasonalNote = null;
  if (noraBaseline.months >= RULES.MIN_MONTHS_FOR_BASELINE && noraBaseline.average > 0 &&
      totalNoraSpend > noraBaseline.average * 1.25 && (totalNoraSpend - noraBaseline.average) > 150) {
    const pctAbove = ((totalNoraSpend - noraBaseline.average) / noraBaseline.average) * 100;
    const driverText = noraPrimaryDriver
      ? `, driven primarily by ${noraPrimaryDriver.name} (${formatCurrency(noraBreakdown[noraPrimaryDriver.key])})`
      : '';

    // Seasonality is judged on the period's own months, not on one arbitrary row.
    const activeMonths = new Set(noraTx.map(t => (toMonthKey(t.date) || '').slice(5, 7)).filter(Boolean));
    const isHolidaySeason = (activeMonths.has('11') || activeMonths.has('12')) &&
      noraPrimaryDriver && (noraPrimaryDriver.key === 'gifts' || noraPrimaryDriver.key === 'clothes');
    const isTuitionSeason = (activeMonths.has('08') || activeMonths.has('09') || activeMonths.has('01')) &&
      noraPrimaryDriver && noraPrimaryDriver.key === 'education';

    if (isHolidaySeason || isTuitionSeason) {
      noraSeasonalNote = {
        type: 'seasonal',
        message: `Family support is ${Math.round(pctAbove)}% above average this period, reflecting expected seasonal ${isHolidaySeason ? 'holiday gift and winter clothing' : 'school tuition and support'} commitments.`
      };
    } else {
      noraUnusualSpending = {
        type: 'high',
        pctAbove: Math.round(pctAbove),
        message: `Family support is ${Math.round(pctAbove)}% above your ${noraBaseline.months}-month average (${formatCurrency(totalNoraSpend - noraBaseline.average)} above baseline)${driverText}.`
      };
    }
  }

  const shareOfTotalExpense = currentMetrics.totalExpense > 0 ? totalNoraSpend / currentMetrics.totalExpense : 0;
  const prevShareOfTotal = prevMetrics.totalExpense > 0 ? prevTotalNoraSpend / prevMetrics.totalExpense : null;
  const diffShareFromPrev = prevShareOfTotal !== null ? (shareOfTotalExpense - prevShareOfTotal) : null;

  const educationShare = totalNoraSpend > 0 ? (noraBreakdown.education / totalNoraSpend) * 100 : 0;
  const primaryFocusText = noraBreakdown.education > 0
    ? `Education (${educationShare.toFixed(0)}%)`
    : (dominantNoraSubcat ? dominantNoraSubcat.name : 'General Support');

  let supportSummary = `Family support accounted for ${(shareOfTotalExpense * 100).toFixed(1)}% (${formatCurrency(totalNoraSpend)}) of total household spending this period. `;
  if (noraBreakdown.education > 0) {
    supportSummary += `The primary commitment was Education & Tuition (${formatCurrency(noraBreakdown.education)}, ${educationShare.toFixed(0)}% of support)`;
    supportSummary += totalNoraSpend - noraBreakdown.education > 0
      ? ', supported by routine enrichment in sports, activities and seasonal needs. '
      : ', representing all recorded support this period. ';
  } else if (dominantNoraSubcat) {
    supportSummary += `${dominantNoraSubcat.name} was the largest support focus (${formatCurrency(dominantNoraSubcat.amount)}). `;
  }
  if (noraSeasonalNote) {
    supportSummary += 'Spending reflects expected seasonal commitments rather than unexpected growth.';
  } else if (diffNoraFromPrev !== 0 && prevTotalNoraSpend > 0) {
    const dir = diffNoraFromPrev > 0 ? 'increased' : 'decreased';
    supportSummary += `Support commitments ${dir} by ${formatCurrency(Math.abs(diffNoraFromPrev))} versus the previous period.`;
  } else {
    supportSummary += 'Overall support allocation stayed consistent with previous periods.';
  }

  const topNoraExpenses = noraTx.slice().sort((a, b) => b.amount - a.amount).slice(0, 3).map(tx => ({
    ...tx,
    percentageOfSpend: totalNoraSpend > 0 ? (tx.amount / totalNoraSpend) * 100 : 0
  }));

  const noraAnalysis = {
    totalSpend: totalNoraSpend,
    count: noraTx.length,
    averageTxAmount: averageNoraTx,
    breakdown: noraBreakdown,
    topExpenses: topNoraExpenses,
    shareOfTotalExpense,
    prevTotalSpend: prevTotalNoraSpend,
    diffFromPrev: diffNoraFromPrev,
    pctChangeFromPrev: pctChangeNoraFromPrev,
    prevShareOfTotal,
    diffShareFromPrev,
    dominantSubcategory: dominantNoraSubcat,
    unusualSpending: noraUnusualSpending,
    seasonalNote: noraSeasonalNote,
    avgHistoricalSpend: noraBaseline.average,
    primaryFocusText,
    supportSummary
  };

  const behavioral = {
    frequentSpending,
    subscriptions: Object.values(subscriptionsList).sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
    spendingByCategoryChange,
    largestTransactions,
    travelAnalysis,
    propertyAnalysis,
    noraAnalysis
  };

  // ── Income streams ───────────────────────────────────────────────────────
  const incomeSources = {};
  txInHorizon.filter(t => t.type === 'Income').forEach(tx => {
    const desc = (tx.description || getCatName(tx.categoryId) || 'Other Income').trim() || 'Other Income';
    if (!incomeSources[desc]) incomeSources[desc] = { name: desc, total: 0 };
    incomeSources[desc].total += tx.amount;
  });
  const incomeStreams = Object.values(incomeSources).sort((a, b) => b.total - a.total);

  // ── Rules ────────────────────────────────────────────────────────────────
  const histAverages = getHistoricalAverages(transactions, categories, period, now);
  const histTxAverages = getHistoricalTransactionAverages(transactions, period, now);
  const histPace = getCumulativePaceByDay(transactions, now.getDate(), period, now);

  const alerts = [];
  const paceRule = ruleOverspendingPace(currentMetrics, histPace, period, now);
  if (paceRule) alerts.push({ ...paceRule, weight: Number.MAX_SAFE_INTEGER });
  alerts.push(...ruleCategorySpike(currentMetrics.catSums, histAverages));
  alerts.push(...ruleLargeTransaction(largestTransactions, histTxAverages, categories));

  const wins = generateWins(currentMetrics, prevMetrics);
  const summaryParagraph = generateSummaryParagraph(currentMetrics, prevMetrics, spendingByCategoryChange);

  return {
    financialHealth: currentMetrics,
    behavioral,
    incomeStreams,
    alerts: rankAlerts(alerts),
    wins,
    summaryParagraph,
    meta: {
      period,
      transactionCount: txInHorizon.length,
      previousTransactionCount: prevTxInHorizon.length,
      hasComparablePrevious: prevTxInHorizon.length > 0,
      generatedAt: now.toISOString(),
      // Surfaced so the UI can be honest about a period that hasn't finished yet.
      firstDate: txInHorizon.map(t => parseTxDate(t.date)).filter(Boolean).sort((a, b) => a - b)[0] || null
    }
  };
}
