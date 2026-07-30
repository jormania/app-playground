/**
 * Budget windows and envelope rollover.
 *
 * A budget used to be one number meaning "per calendar month", which made
 * annual costs (insurance, taxes, a yearly domain bill) impossible to express:
 * a 6,000 L yearly premium had to be entered as 500 L/month and then blew the
 * bar apart in whichever month it actually landed.
 *
 * Two ideas here:
 *   - a category owns its own *window* (monthly, quarterly, yearly, optionally
 *     anchored to a renewal date), and is always measured against the current
 *     instance of that window;
 *   - with rollover on, unspent room carries into the next window.
 *
 * Carry is **derived, never stored**. Nothing is written back to Notion, so
 * there's no second source of truth to fall out of sync, no extra writes, and
 * correcting a transaction from three months ago re-derives every window after
 * it automatically.
 */
import { parseTxDate, daysInMonth } from './period';

export const BUDGET_PERIODS = ['Monthly', 'Quarterly', 'Yearly'];

/** Months per window, by period name. */
export const MONTHS_PER = { Monthly: 1, Quarterly: 3, Yearly: 12 };

/** Hard stop on how far back carry accumulates — the spirit of MAX_BACKFILL_MONTHS. */
export const MAX_CARRY_WINDOWS = 12;

const MONTH_SHORT = (y, m) =>
  new Date(y, m, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

/** Normalize whatever Notion gave us to one of BUDGET_PERIODS. */
export function normalizePeriod(value) {
  return BUDGET_PERIODS.includes(value) ? value : 'Monthly';
}

/**
 * The instance of this category's budget window that contains `now`.
 *
 * Returns a half-open `[start, end)` range, matching `lib/period.js` so the two
 * can't disagree about whether the last day of a window is inside it.
 */
export function getBudgetWindow(category, now = new Date()) {
  const period = normalizePeriod(category?.budgetPeriod);
  const span = MONTHS_PER[period];

  // Monthly deliberately ignores the anchor: a "budget month" that runs 6th to
  // 5th would disagree with every other month-based figure in the app.
  if (period === 'Monthly') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end, period, label: MONTH_SHORT(now.getFullYear(), now.getMonth()), anchored: false };
  }

  const anchor = category?.budgetAnchor ? parseTxDate(category.budgetAnchor) : null;
  // Anchored windows count in whole months from the anchor's month; unanchored
  // ones fall on calendar quarters / calendar years.
  const anchorMonthIndex = anchor ? anchor.getFullYear() * 12 + anchor.getMonth() : 0;
  const nowMonthIndex = now.getFullYear() * 12 + now.getMonth();

  const elapsed = nowMonthIndex - anchorMonthIndex;
  // Floor division that stays correct for dates *before* the anchor.
  const windowIndex = Math.floor(elapsed / span);
  const startMonthIndex = anchorMonthIndex + windowIndex * span;

  const startYear = Math.floor(startMonthIndex / 12);
  const startMonth = startMonthIndex % 12;
  const start = new Date(startYear, startMonth, 1);
  const end = new Date(startYear, startMonth + span, 1);

  let label;
  if (period === 'Yearly') {
    label = startMonth === 0
      ? String(startYear)
      : `${MONTH_SHORT(startYear, startMonth)} – ${MONTH_SHORT(...monthYear(startMonthIndex + span - 1))}`;
  } else {
    label = startMonth % 3 === 0 && !anchor
      ? `Q${Math.floor(startMonth / 3) + 1} ${startYear}`
      : `${MONTH_SHORT(startYear, startMonth)} – ${MONTH_SHORT(...monthYear(startMonthIndex + span - 1))}`;
  }

  return { start, end, period, label, anchored: !!anchor };
}

function monthYear(monthIndex) {
  return [Math.floor(monthIndex / 12), monthIndex % 12];
}

/** The window immediately before a given one. */
export function previousWindow(category, window) {
  // One day before the start is always inside the previous window, whatever
  // its length — no month arithmetic to get wrong.
  const dayBefore = new Date(window.start.getTime() - 86400000);
  return getBudgetWindow(category, dayBefore);
}

/** Expense total for one category inside a `[start, end)` range. */
export function spentInWindow(transactions, categoryId, window) {
  let total = 0;
  for (const tx of transactions || []) {
    if (tx.categoryId !== categoryId) continue;
    if (tx.type !== 'Expense') continue; // Transfers and Income never consume a budget
    const d = parseTxDate(tx.date);
    if (!d || d < window.start || d >= window.end) continue;
    total += Number(tx.amount) || 0;
  }
  return total;
}

/**
 * Room carried into the current window from previous ones.
 *
 * Positive when past windows underspent, negative when they overspent —
 * overspend carries forward too (YNAB semantics): money already gone can't be
 * un-spent, so pretending each window starts clean would quietly forgive it.
 */
export function computeCarry(category, transactions, now = new Date()) {
  if (!category?.budgetRollover) return 0;
  const limit = Number(category.budgetLimit) || 0;
  if (limit <= 0) return 0;

  // No point walking back past the category's own first transaction.
  let earliest = null;
  for (const tx of transactions || []) {
    if (tx.categoryId !== category.id) continue;
    const d = parseTxDate(tx.date);
    if (d && (!earliest || d < earliest)) earliest = d;
  }
  if (!earliest) return 0;

  const windows = [];
  let cursor = previousWindow(category, getBudgetWindow(category, now));
  for (let i = 0; i < MAX_CARRY_WINDOWS; i++) {
    if (cursor.end <= earliest) break;
    windows.unshift(cursor);
    cursor = previousWindow(category, cursor);
  }

  let carry = 0;
  for (const window of windows) {
    carry += limit - spentInWindow(transactions, category.id, window);
  }
  return carry;
}

/**
 * Everything the UI needs to draw one budget bar.
 *
 * `percent` is measured against the *effective* limit (base + carry) so the bar
 * matches the number printed next to it.
 */
export function computeBudgetStatus(category, transactions, now = new Date()) {
  const window = getBudgetWindow(category, now);
  const limit = Number(category.budgetLimit) || 0;
  const carry = computeCarry(category, transactions, now);
  const effectiveLimit = limit + carry;
  const spent = spentInWindow(transactions, category.id, window);
  const remaining = effectiveLimit - spent;

  // A carry deep enough to wipe out the allowance leaves nothing to measure
  // against; report 100% rather than a negative or infinite percentage.
  const percent = effectiveLimit > 0
    ? Math.min((spent / effectiveLimit) * 100, 100)
    : (spent > 0 ? 100 : 0);

  const msLeft = window.end.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000));

  return {
    ...category,
    window,
    limit,
    carry,
    effectiveLimit,
    spent,
    remaining,
    percent,
    daysLeft,
    isOver: spent > effectiveLimit,
    hasRollover: !!category.budgetRollover,
  };
}

/** Budget status for every category that has a limit set. */
export function computeAllBudgets(categories, transactions, now = new Date()) {
  return (categories || [])
    .filter(c => Number(c.budgetLimit) > 0 && c.type !== 'Income')
    .map(c => computeBudgetStatus(c, transactions, now));
}

/**
 * A category's contribution to a combined *monthly-equivalent* total.
 *
 * Summing raw limits/spent straight across categories mixes timescales — a
 * 500/month grocery budget plus a 6 000/year insurance one added to "6 500"
 * means nothing on its own. Dividing each by its own window's month-count
 * before summing gives every category an equal, comparable "per month" share,
 * so a combined figure across mixed periods is actually readable.
 */
export function monthlyEquivalent(status) {
  const months = MONTHS_PER[status?.window?.period] || 1;
  return { limit: (status?.effectiveLimit || 0) / months, spent: (status?.spent || 0) / months };
}

/** "3 000 L / quarter" — the phrasing used wherever a limit is shown on its own. */
export function formatPeriodSuffix(period) {
  const p = normalizePeriod(period);
  if (p === 'Quarterly') return 'quarter';
  if (p === 'Yearly') return 'year';
  return 'month';
}

/** Exported for tests that need to reason about month lengths. */
export { daysInMonth };
