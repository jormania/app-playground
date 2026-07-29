/**
 * What's due *next* — the other half of the subscriptions story.
 *
 * `useSubscriptionsEngine` owns everything with a due date at or before today:
 * it posts those charges into the ledger. This module owns everything strictly
 * after today, which nothing did before — the engine could silently post a
 * 2,400 L rent charge without the app ever having warned that it was coming.
 *
 * The split on `dueDate > today` is deliberate and total: no date is ever
 * claimed by both, so a bill can't be both "upcoming" and auto-posted.
 */
import { dueDateFor, isAlreadyPosted } from './useSubscriptionsEngine';
import { parseTxDate, toDateString } from './period';

/** How far ahead the agenda looks by default. */
export const DEFAULT_HORIZON_DAYS = 30;

/** How close a bill has to be before the banner mentions it, by default. */
export const DEFAULT_LEAD_DAYS = 5;

/** Hard stop so an absurd horizon can't spin the month loop. */
const MAX_HORIZON_MONTHS = 24;

/** Whole days between two local dates, DST-safe (a DST day is 23h or 25h, so
 *  the raw division lands on 0.96 or 1.04 — rounding recovers the intent). */
function daysBetween(fromDate, toDate) {
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
}

/**
 * Every subscription charge due strictly after `today` and within the horizon.
 *
 * Returns one entry per *occurrence*, not per subscription — a 90-day horizon
 * legitimately yields three entries for a monthly bill, which is exactly what
 * the cash-flow forecast needs to sum.
 *
 * `alreadyPosted` marks an occurrence the ledger already contains: entering
 * next month's rent by hand shouldn't make the app nag about it. It's reported
 * rather than filtered so callers can decide (the agenda greys it out; the
 * banner skips it; the forecast still counts it, because the money is
 * committed either way).
 */
export function getUpcomingBills(subscriptions, transactions, options = {}) {
  const {
    horizonDays = DEFAULT_HORIZON_DAYS,
    today = new Date(),
  } = options;

  const subs = (subscriptions || []).filter(s => s && s.active !== false);
  if (subs.length === 0 || !(horizonDays > 0)) return [];

  const txs = transactions || [];
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayStr = toDateString(todayMidnight);
  const horizonEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + horizonDays);
  const horizonEndStr = toDateString(horizonEnd);

  const monthSpan = Math.min(
    (horizonEnd.getFullYear() - todayMidnight.getFullYear()) * 12 +
      (horizonEnd.getMonth() - todayMidnight.getMonth()),
    MAX_HORIZON_MONTHS,
  );

  const bills = [];
  for (const sub of subs) {
    for (let i = 0; i <= monthSpan; i++) {
      const cursor = new Date(todayMidnight.getFullYear(), todayMidnight.getMonth() + i, 1);
      // Clamped for short months — `new Date(2026, 1, 31)` would roll into March.
      const dueDate = dueDateFor(cursor.getFullYear(), cursor.getMonth(), sub.dayOfMonth);

      // Strictly after today: today's charge belongs to the posting engine.
      if (dueDate <= todayStr || dueDate > horizonEndStr) continue;

      const due = parseTxDate(dueDate);
      bills.push({
        sub,
        dueDate,
        daysUntil: daysBetween(todayMidnight, due),
        alreadyPosted: isAlreadyPosted(txs, sub, dueDate),
      });
    }
  }

  // Soonest first; ties broken by name so the order is stable across reloads.
  return bills.sort((a, b) =>
    a.dueDate === b.dueDate
      ? String(a.sub.name || '').localeCompare(String(b.sub.name || ''))
      : a.dueDate < b.dueDate ? -1 : 1,
  );
}

/**
 * The bills worth interrupting someone about: close enough to act on, and not
 * already in the ledger.
 */
export function billsWithinLeadTime(bills, leadDays = DEFAULT_LEAD_DAYS) {
  if (!(leadDays > 0)) return [];
  return (bills || []).filter(b => !b.alreadyPosted && b.daysUntil <= leadDays);
}

/** Total value of a set of occurrences, signed by type (Income adds, Expense subtracts). */
export function sumBills(bills) {
  return (bills || []).reduce((acc, b) => {
    const amount = Number(b.sub?.amount) || 0;
    return acc + (b.sub?.type === 'Income' ? amount : -amount);
  }, 0);
}

/** "in 3 days" / "tomorrow" / "on the 14th" — the agenda's relative phrasing. */
export function formatDaysUntil(daysUntil) {
  if (daysUntil <= 0) return 'today';
  if (daysUntil === 1) return 'tomorrow';
  return `in ${daysUntil} days`;
}

/** Is a dismissal still in force? Snoozes are stored as an epoch-ms deadline. */
export function isSnoozed(snoozedUntil, now = new Date()) {
  const until = Number(snoozedUntil);
  return Number.isFinite(until) && until > now.getTime();
}
