/**
 * A 90-day cash-flow projection.
 *
 * Deliberately *not* a balance forecast. The app has an Accounts database but no
 * balances anywhere in it, so it can tell you what you spent and never how much
 * you have — projecting a balance would mean inventing an opening figure. This
 * projects net flow per month instead, and the UI says so plainly.
 *
 * Two ingredients, with very different confidence:
 *   - committed: subscription charges with a known date and amount. Near-certain.
 *   - estimated: everything else, from the trailing median of real spending.
 * They're reported separately rather than summed into one number, because a
 * single figure would hide which half is a fact and which is a guess.
 */
import { toMonthKey, daysInMonth } from '../period';
import { getUpcomingBills } from '../upcoming';
import { SUBSCRIPTION_TAG } from '../useSubscriptionsEngine';

/** Months of complete history required before the estimate is worth showing. */
export const MIN_HISTORY_MONTHS = 3;

/** How many complete months feed the trailing median. */
const TRAILING_WINDOW = 3;

const normalize = (s) => String(s || '').trim().toLowerCase();

/** `YYYY-MM` for a Date, from local parts. */
const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Median of a list of numbers (even-length takes the mean of the middle two). */
export function median(values) {
  const nums = (values || []).filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  if (nums.length === 0) return 0;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
}

/**
 * Is this transaction one of the recurring charges the forecast already counts
 * as committed?
 *
 * Checked two ways on purpose: the engine tags what it auto-posts, but a charge
 * entered by hand carries no tag, and counting it as discretionary *as well as*
 * committed would double it in every projected month.
 */
export function isRecurringCharge(tx, subscriptionNames) {
  if ((tx.tags || []).includes(SUBSCRIPTION_TAG)) return true;
  return subscriptionNames.has(normalize(tx.description));
}

/** The `YYYY-MM` keys of the N complete months before `now` (most recent first). */
function trailingMonthKeys(now, count) {
  const keys = [];
  for (let i = 1; i <= count; i++) {
    keys.push(monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return keys;
}

/**
 * Project net cash flow for the coming months.
 *
 * Returns `confidence: 'low'` (and zeroed estimates) rather than a fabricated
 * number when there isn't enough history — the same discipline the alert engine
 * uses, where a spike needs ≥2 months of baseline before it's allowed to fire.
 */
export function projectCashFlow(data, options = {}) {
  const { horizonMonths = 3, now = new Date() } = options;

  const transactions = data?.transactions || [];
  const subscriptions = (data?.subscriptions || []).filter(s => s && s.active !== false);
  const subscriptionNames = new Set(subscriptions.map(s => normalize(s.name)));

  // Complete months only — the current month is partial, and including it would
  // drag every median down early in the month.
  // Built from local parts, never `toISOString()`: that reports UTC, so on the
  // 1st of a month anywhere east of UTC it names the *previous* month and
  // silently admits a partial month into the baseline (audit P0-3, same trap).
  const currentKey = monthKeyOf(now);
  const historyKeys = new Set(
    transactions
      .map(t => toMonthKey(t.date))
      .filter(k => k && k < currentKey),
  );
  const monthsOfHistory = historyKeys.size;
  const hasHistory = monthsOfHistory >= MIN_HISTORY_MONTHS;

  // --- Trailing medians for the non-recurring half -------------------------
  const window = trailingMonthKeys(now, TRAILING_WINDOW);
  const discretionaryByMonth = new Map(window.map(k => [k, 0]));
  const otherIncomeByMonth = new Map(window.map(k => [k, 0]));

  for (const tx of transactions) {
    const key = toMonthKey(tx.date);
    if (!key || !discretionaryByMonth.has(key)) continue;
    if (tx.type === 'Transfer') continue; // never income or expense
    if (isRecurringCharge(tx, subscriptionNames)) continue; // already committed
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'Income') otherIncomeByMonth.set(key, otherIncomeByMonth.get(key) + amount);
    else discretionaryByMonth.set(key, discretionaryByMonth.get(key) + amount);
  }

  const discretionaryMedian = hasHistory ? median([...discretionaryByMonth.values()]) : 0;
  const otherIncomeMedian = hasHistory ? median([...otherIncomeByMonth.values()]) : 0;

  // --- Committed half, straight from the subscriptions engine's own maths ---
  // A horizon generous enough to cover every day of the last projected month.
  const lastMonth = new Date(now.getFullYear(), now.getMonth() + horizonMonths, 1);
  const horizonDays = Math.ceil((lastMonth - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  const bills = getUpcomingBills(subscriptions, transactions, { horizonDays, today: now });

  const months = [];
  for (let i = 0; i < horizonMonths; i++) {
    const cursor = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthKey = monthKeyOf(cursor);

    let committedIncome = 0;
    let committedExpense = 0;
    for (const b of bills) {
      if (toMonthKey(b.dueDate) !== monthKey) continue;
      const amount = Number(b.sub.amount) || 0;
      // `alreadyPosted` occurrences still count: the money is committed either
      // way, and dropping them would make the current month look artificially
      // cheap the moment a charge lands.
      if (b.sub.type === 'Income') committedIncome += amount;
      else committedExpense += amount;
    }

    // The current month is already part-spent, so only the remaining share of
    // the discretionary estimate is still ahead of us.
    const remainingShare = i === 0
      ? (daysInMonth(cursor.getFullYear(), cursor.getMonth()) - now.getDate() + 1) /
        daysInMonth(cursor.getFullYear(), cursor.getMonth())
      : 1;

    const estimatedExpense = discretionaryMedian * remainingShare;
    const estimatedIncome = otherIncomeMedian * remainingShare;

    const income = committedIncome + estimatedIncome;
    const expense = committedExpense + estimatedExpense;

    months.push({
      monthKey,
      label: cursor.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
      isCurrentMonth: i === 0,
      committedIncome,
      committedExpense,
      estimatedIncome,
      estimatedExpense,
      income,
      expense,
      net: income - expense,
    });
  }

  const firstNegative = months.find(m => m.net < 0) || null;

  return {
    months,
    monthsOfHistory,
    hasHistory,
    confidence: !hasHistory ? 'low' : monthsOfHistory >= 6 ? 'high' : 'medium',
    basis: { discretionaryMedian, otherIncomeMedian, trailingMonths: TRAILING_WINDOW },
    firstNegativeMonthKey: firstNegative ? firstNegative.monthKey : null,
  };
}

/** A one-line narrative in the app's editorial voice. */
export function summarizeForecast(forecast) {
  if (!forecast || forecast.months.length === 0) return '';
  if (!forecast.hasHistory) {
    return `Only ${forecast.monthsOfHistory} complete ${forecast.monthsOfHistory === 1 ? 'month' : 'months'} of history so far — come back once there are ${MIN_HISTORY_MONTHS} and this will project the months ahead.`;
  }

  const ahead = forecast.months.filter(m => !m.isCurrentMonth);
  const scope = ahead.length > 0 ? ahead : forecast.months;
  const avgNet = scope.reduce((a, m) => a + m.net, 0) / scope.length;
  const negative = forecast.months.find(m => m.net < 0);

  if (negative) {
    return `On current patterns ${negative.label} is the first month that runs short — committed bills plus typical spending outrun expected income.`;
  }
  if (avgNet > 0) {
    return `On current patterns the next ${scope.length} ${scope.length === 1 ? 'month' : 'months'} stay in surplus, averaging about ${Math.round(avgNet).toLocaleString('en-US')} L a month left over.`;
  }
  return 'On current patterns the months ahead land close to break-even.';
}
