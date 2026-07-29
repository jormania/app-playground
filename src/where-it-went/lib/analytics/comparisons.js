import { TIME } from './constants';
import { parseTxDate, getPeriodRange } from '../period';

/**
 * The month a period is anchored on, for "compare against the previous N months".
 * Multi-month and all-time selections have no single anchor.
 */
function anchorMonth(currentPeriodStr, now) {
  const p = currentPeriodStr || 'this_month';
  if (p === 'this_month') return { year: now.getFullYear(), month: now.getMonth() };
  if (p === 'last_month') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  }
  if (/^\d{4}-\d{2}$/.test(p)) {
    const [y, m] = p.split('-').map(Number);
    return { year: y, month: m - 1 };
  }
  return null;
}

/**
 * Rolling per-category average over the months before the selected period.
 *
 * Two fixes over the original: it now works for *any* single-month period (it only
 * ever populated for `this_month`, so category-spike alerts silently vanished
 * everywhere else), and it divides by the number of months that actually contain
 * data instead of a hardcoded 3 — which used to triple-count a new user's history
 * and fire "50% above average" on almost everything.
 */
export function getHistoricalAverages(allTransactions, categories, currentPeriodStr, now = new Date()) {
  const averages = {};
  (categories || []).forEach(c => {
    averages[c.id] = { total: 0, count: 0, average: 0, monthsAssessed: 0, monthsWithData: 0 };
  });

  const anchor = anchorMonth(currentPeriodStr, now);
  if (!anchor) return averages;

  const expenses = (allTransactions || []).filter(t => t.type === 'Expense');
  const perMonth = [];

  for (let i = 1; i <= TIME.HISTORICAL_MONTHS_LOOKBACK; i++) {
    const d = new Date(anchor.year, anchor.month - i, 1);
    const monthTx = expenses.filter(t => {
      const txDate = parseTxDate(t.date);
      return txDate && txDate.getFullYear() === d.getFullYear() && txDate.getMonth() === d.getMonth();
    });
    perMonth.push(monthTx);
  }

  const monthsWithData = perMonth.filter(m => m.length > 0).length;

  (categories || []).forEach(c => {
    let total = 0;
    let count = 0;
    let monthsSeen = 0;
    perMonth.forEach(monthTx => {
      const catTx = monthTx.filter(t => t.categoryId === c.id);
      if (monthTx.length > 0) monthsSeen++;
      total += catTx.reduce((a, b) => a + b.amount, 0);
      count += catTx.length;
    });
    averages[c.id] = {
      total,
      count,
      monthsAssessed: monthsSeen,
      monthsWithData,
      average: monthsSeen > 0 ? total / monthsSeen : 0
    };
  });

  return averages;
}

/** How much of a typical month's spending has happened by day X, historically. */
export function getCumulativePaceByDay(allTransactions, dayOfMonth, currentPeriodStr, now = new Date()) {
  if (currentPeriodStr !== 'this_month') return null; // pace only applies to a month in progress

  const expenses = (allTransactions || []).filter(t => t.type === 'Expense');
  let historicalTotalToDay = 0;
  let historicalTotalFullMonth = 0;

  for (let i = 1; i <= TIME.HISTORICAL_MONTHS_LOOKBACK; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthTx = expenses.filter(t => {
      const txDate = parseTxDate(t.date);
      return txDate && txDate.getFullYear() === d.getFullYear() && txDate.getMonth() === d.getMonth();
    });

    historicalTotalFullMonth += monthTx.reduce((a, b) => a + b.amount, 0);
    historicalTotalToDay += monthTx
      .filter(t => { const td = parseTxDate(t.date); return td && td.getDate() <= dayOfMonth; })
      .reduce((a, b) => a + b.amount, 0);
  }

  return historicalTotalFullMonth > 0 ? (historicalTotalToDay / historicalTotalFullMonth) : 0;
}

/**
 * Average and max transaction size per category, over history *excluding* the
 * period being judged — otherwise a transaction was compared against an average it
 * had itself inflated.
 */
export function getHistoricalTransactionAverages(allTransactions, currentPeriodStr, now = new Date()) {
  const range = currentPeriodStr ? getPeriodRange(currentPeriodStr, now) : { start: null, end: null };
  const inCurrent = (t) => {
    if (!range.start && !range.end) return false;
    const d = parseTxDate(t.date);
    if (!d) return false;
    if (range.start && d < range.start) return false;
    if (range.end && d >= range.end) return false;
    return true;
  };

  const expenses = (allTransactions || []).filter(t => t.type === 'Expense' && !inCurrent(t));
  const catAverages = {};

  expenses.forEach(t => {
    if (!catAverages[t.categoryId]) {
      catAverages[t.categoryId] = { total: 0, count: 0, average: 0, max: 0 };
    }
    catAverages[t.categoryId].total += t.amount;
    catAverages[t.categoryId].count += 1;
    if (t.amount > catAverages[t.categoryId].max) catAverages[t.categoryId].max = t.amount;
  });

  Object.keys(catAverages).forEach(k => {
    catAverages[k].average = catAverages[k].total / catAverages[k].count;
  });

  return catAverages;
}

/**
 * Monthly totals for a set of transactions, excluding the period under review, so a
 * "deviation from baseline" alert isn't diluted by the very month it is judging.
 */
export function monthlyBaseline(transactions, currentPeriodStr, now = new Date()) {
  const range = currentPeriodStr ? getPeriodRange(currentPeriodStr, now) : { start: null, end: null };
  const totals = {};

  (transactions || []).forEach(t => {
    const d = parseTxDate(t.date);
    if (!d) return;
    if (range.start && range.end && d >= range.start && d < range.end) return; // skip current period
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    totals[ym] = (totals[ym] || 0) + t.amount;
  });

  const values = Object.values(totals);
  return {
    months: values.length,
    average: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
    totals
  };
}
