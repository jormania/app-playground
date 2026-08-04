import { useEffect } from 'react';
import { daysInMonth, parseTxDate, toDateString, toMonthKey } from './period';
import { fetchRate, convert, canConvert, BASE_CURRENCY } from './fx';

/** Hard stop so a very stale `lastProcessed` can't generate years of back-charges. */
export const MAX_BACKFILL_MONTHS = 12;

/** Same hard stop, expressed in years, for a Yearly subscription. */
export const MAX_BACKFILL_YEARS = 5;

export const SUBSCRIPTION_TAG = 'Subscription';
export const GENERATED_TAG = 'Auto-generated';

/**
 * The concrete date a subscription is due in a given month, as `YYYY-MM-DD`.
 *
 * `new Date(2026, 1, 31)` silently rolls over to 3 March, which used to post
 * February's rent in March *and* seed the next candidate from the drifted date, so
 * the error compounded every month. Clamping to the month's real length fixes both.
 */
export function dueDateFor(year, monthIndex, dayOfMonth) {
  const day = Math.min(Math.max(Number(dayOfMonth) || 1, 1), daysInMonth(year, monthIndex));
  return toDateString(new Date(year, monthIndex, day));
}

/**
 * Every due date at or before `today` that hasn't been processed yet.
 * Dates are plain local `YYYY-MM-DD` strings — never `toISOString()`, which shifted
 * a 1st-of-the-month charge into the previous month for any timezone east of UTC.
 *
 * `frequency` defaults to `'Monthly'` so every existing caller (and every
 * subscription saved before Yearly existed) is unaffected. A `'Yearly'`
 * subscription fires once a year, in `monthOfYear` (1-12) — the loop still
 * walks a month at a time so a clamped day-of-month never drifts, it just
 * skips every cursor whose month doesn't match.
 */
export function getDueDates(dayOfMonth, lastProcessedDate, today = new Date(), frequency = 'Monthly', monthOfYear = 1) {
  const todayStr = toDateString(today);
  const due = [];
  const isYearly = frequency === 'Yearly';
  const targetMonthIndex = Math.min(Math.max(Number(monthOfYear) || 1, 1), 12) - 1;

  const lastProcessed = lastProcessedDate ? parseTxDate(lastProcessedDate) : null;
  // Start the month after the last processed one; with no history, just this
  // month for Monthly. A Yearly subscription with no history instead starts
  // from January, so a target month earlier in the current year than "today"
  // (a March renewal found in July) is still picked up as due, the same way
  // a Monthly subscription treats an already-passed day this month as due.
  const startYear = lastProcessed ? lastProcessed.getFullYear() : today.getFullYear();
  const startMonth = lastProcessed ? lastProcessed.getMonth() + 1 : (isYearly ? 0 : today.getMonth());

  const limit = isYearly ? MAX_BACKFILL_YEARS * 12 : MAX_BACKFILL_MONTHS;

  for (let i = 0; i < limit; i++) {
    // Anchored on the *start* month each iteration, so a clamped date never drifts.
    const cursor = new Date(startYear, startMonth + i, 1);
    if (cursor.getFullYear() > today.getFullYear() ||
        (cursor.getFullYear() === today.getFullYear() && cursor.getMonth() > today.getMonth())) {
      break;
    }
    if (isYearly && cursor.getMonth() !== targetMonthIndex) continue;
    const dateStr = dueDateFor(cursor.getFullYear(), cursor.getMonth(), dayOfMonth);
    if (dateStr <= todayStr && (!lastProcessedDate || dateStr > String(lastProcessedDate).slice(0, 10))) {
      due.push(dateStr);
    }
  }

  return due;
}

/**
 * Has this charge already been written?
 *
 * Without this, a failed `lastProcessed` update (which was caught and only logged)
 * meant the same charges were posted again on the next launch — and two devices
 * opening the app on the same day double-posted every subscription.
 *
 * A foreign-currency subscription's RON figure is *re-derived per occurrence*
 * (see `resolvePostingAmount`) so it tracks the actual exchange rate each
 * month rather than freezing whatever rate happened to apply when the
 * subscription was first configured — which means it can no longer be relied
 * on to match `sub.amount` when checking for a previous post. The original
 * amount is what stays fixed (Netflix always charges the same 10 EUR
 * regardless of what that's worth in RON this month), so that's what a
 * foreign subscription matches on instead.
 */
export function isAlreadyPosted(transactions, sub, dateStr) {
  const month = toMonthKey(dateStr);
  const isForeign = !!sub.originalCurrency && sub.originalAmount != null;
  return (transactions || []).some(tx => {
    if (!tx) return false;
    if ((tx.description || '') !== sub.name) return false;
    if (toMonthKey(tx.date) !== month) return false;
    if (isForeign) {
      return tx.originalCurrency === sub.originalCurrency && Number(tx.originalAmount) === Number(sub.originalAmount);
    }
    return Number(tx.amount) === Number(sub.amount);
  });
}

/**
 * The RON amount to post for one occurrence.
 *
 * Inflation and exchange-rate movement mean a EUR (or any foreign-currency)
 * subscription is worth a slightly different number of Lei every month — the
 * bank converts at that day's rate, not the rate from whenever the
 * subscription was set up. This fetches a fresh rate for the *occurrence's own
 * due date* and re-converts every time a charge posts, rather than reusing
 * `sub.amount` forever. A failed or unavailable rate falls back to the
 * subscription's last-saved RON figure — a missing rate must never block a
 * post, the same rule `lib/fx.js` already applies everywhere else.
 */
export async function resolvePostingAmount(sub, dateStr) {
  if (!sub.originalCurrency || sub.originalAmount == null || !canConvert(sub.originalCurrency)) {
    return sub.amount;
  }
  try {
    const result = await fetchRate(sub.originalCurrency, BASE_CURRENCY, dateStr);
    const converted = result?.rate != null ? convert(sub.originalAmount, result.rate) : null;
    return converted != null ? converted : sub.amount;
  } catch {
    return sub.amount;
  }
}

/** Everything a run would do, without doing it — the unit-testable core. */
export function planSubscriptionRun(data, today = new Date()) {
  const subs = (data?.subscriptions || []).filter(s => s.active);
  const transactions = data?.transactions || [];

  return subs.map(sub => {
    const dueDates = getDueDates(sub.dayOfMonth, sub.lastProcessed, today, sub.frequency, sub.monthOfYear);
    const toPost = dueDates.filter(d => !isAlreadyPosted(transactions, sub, d));
    const alreadyPresent = dueDates.filter(d => isAlreadyPosted(transactions, sub, d));
    return { sub, dueDates, toPost, alreadyPresent };
  }).filter(plan => plan.dueDates.length > 0);
}

let engineHasRun = false;

/**
 * Posts missed subscription charges once per session.
 *
 * Deliberately skipped in demo mode: writing generated rows into the sample data
 * on every reload made the demo drift away from its fixture.
 */
export function useSubscriptionsEngine({ data, client, onDataChange, enabled = true }) {
  useEffect(() => {
    if (!enabled || engineHasRun) return;
    if (!data || !data.subscriptions || data.subscriptions.length === 0) return;

    engineHasRun = true;

    (async () => {
      // `planSubscriptionRun` already filters to plans with at least one due
      // date, so an empty list means nothing due at all. Bailing out instead
      // on "nothing left *to post*" used to also skip every plan whose due
      // dates were already fully present in the ledger (hand-entered, or
      // posted by another device) — so `lastProcessed` never advanced for a
      // subscription only ever entered manually, and `getDueDates` kept
      // re-deriving the same growing backlog every session until it started
      // falling off the MAX_BACKFILL window.
      const plans = planSubscriptionRun(data, new Date());
      if (plans.length === 0) return;

      // Re-check against the freshest ledger right before writing anything,
      // rather than trusting `data` — which can be minutes or hours old on a
      // tab left open. Two devices racing to post the same occurrence is
      // exactly the scenario `isAlreadyPosted` exists to catch, and the
      // window it has to work with was previously "however long this tab
      // has been open" instead of "however long this fetch takes". This
      // can't make the check-then-write atomic — Notion has no such
      // primitive to offer — but it closes almost all of the real gap.
      let freshTransactions = data.transactions;
      try {
        freshTransactions = await client.fetchTransactions();
      } catch {
        // A failed pre-check shouldn't block posting on a good connection
        // moments later — fall back to what's already in hand.
      }

      let madeChanges = false;

      for (const { sub, dueDates } of plans) {
        let lastSettled = null;
        const toPostNow = dueDates.filter(d => !isAlreadyPosted(freshTransactions, sub, d));

        for (const dateStr of dueDates) {
          if (!toPostNow.includes(dateStr)) {
            // Already in the ledger — count it as settled so lastProcessed advances.
            lastSettled = dateStr;
            continue;
          }
          try {
            const amount = await resolvePostingAmount(sub, dateStr);
            await client.addTransaction({
              description: sub.name,
              amount,
              type: sub.type,
              categoryId: sub.categoryId,
              accountId: sub.accountId,
              date: dateStr,
              notes: 'Generated from a recurring subscription.',
              tags: [SUBSCRIPTION_TAG, GENERATED_TAG],
              // Carries the subscription's own foreign-currency context onto
              // the posted row, same as a manually-entered transaction shows.
              // The original figure is fixed (Netflix always charges the same
              // 10 EUR); only the RON conversion above re-derives per month.
              originalAmount: sub.originalAmount ?? null,
              originalCurrency: sub.originalCurrency || '',
            });
            madeChanges = true;
            lastSettled = dateStr;
          } catch (e) {
            // Stop this subscription here: leaving lastProcessed at the previous
            // success means the next run retries exactly this date, no duplicates.
            console.error(`Failed to auto-generate transaction for ${sub.name}:`, e);
            break;
          }
        }

        if (lastSettled && lastSettled !== sub.lastProcessed) {
          try {
            await client.updateSubscription(sub.id, { lastProcessed: lastSettled });
          } catch (e) {
            console.error(`Failed to update lastProcessed for ${sub.name}:`, e);
          }
        }
      }

      if (madeChanges && onDataChange) onDataChange();
    })();
  }, [data, client, onDataChange, enabled]);
}
