/**
 * Deciding, without asking the model, whether a transaction belongs to a trip.
 *
 * The AI parser is given the trip list with dates, status and currency, and is
 * told when to link one — but trip membership is *derivable*, and the rule this
 * file applies is the same one `hardenTransaction` applies to currencies and
 * ids: don't trust a model for something the data already answers. It also
 * means the keyword parser (which has never known trips existed) gets the same
 * behaviour for free.
 *
 * Three things follow from a trip being attached:
 *   1. `tripId` is set.
 *   2. An amount with no currency named is read as the *trip's* currency. On a
 *      trip you spend the destination's money; "30 for lunch" in Kraków is 30
 *      PLN, not 30 RON. This is why the prompt insists the model state
 *      `originalCurrency` explicitly whenever the user names one — including
 *      RON — so "no currency" here really means the user didn't say.
 *   3. The category becomes Travel. Not a preference: `TransactionForm` only
 *      writes `tripId` when the category is Travel (a trip on a Dining row is
 *      silently dropped the next time that row is saved), and the Travel
 *      Insights engine keys on the same category. Trip-linked ⇒ Travel keeps
 *      those three in step.
 */

const BASE_CURRENCY = 'RON';

function dayOf(value) {
  return String(value || '').slice(0, 10);
}

/**
 * Is `dateStr` inside this trip's window? Comparison is lexicographic on
 * `YYYY-MM-DD`, which is exactly what the rest of the app does (`lib/period`).
 * A one-sided window counts — a trip with a start and no end is still running.
 */
export function isTripOngoing(trip, dateStr) {
  if (!trip || !dateStr) return false;
  const start = dayOf(trip.startDate);
  const end = dayOf(trip.endDate);
  if (!start && !end) return false;
  if (start && dateStr < start) return false;
  if (end && dateStr > end) return false;
  return true;
}

/** Every trip whose window contains the date. Usually zero or one. */
export function tripsOnDate(trips, dateStr) {
  return (trips || []).filter(t => t && t.id && isTripOngoing(t, dateStr));
}

/**
 * The one trip a transaction on `dateStr` belongs to, or null.
 *
 * Overlapping trips are the interesting case: a currency that matches exactly
 * one of them settles it (that's the whole point of the PLN signal), and
 * anything still ambiguous is left alone rather than guessed at — a wrong trip
 * is worse than no trip, because no trip is visibly missing and a wrong one
 * isn't.
 */
export function inferTrip(trips, dateStr, currency) {
  const candidates = tripsOnDate(trips, dateStr);

  if (candidates.length === 0) {
    // A trip with no dates at all can only announce itself through Status.
    // `useTripEngine` keeps Status in step with the dates for every trip that
    // has them, so this never competes with the date check above.
    const undatedActive = (trips || []).filter(
      t => t && t.id && t.status === 'Active' && !t.startDate && !t.endDate,
    );
    return undatedActive.length === 1 ? undatedActive[0] : null;
  }

  if (candidates.length === 1) return candidates[0];

  const code = String(currency || '').trim().toUpperCase();
  if (code) {
    const byCurrency = candidates.filter(
      t => String(t.currency || '').trim().toUpperCase() === code,
    );
    if (byCurrency.length === 1) return byCurrency[0];
  }

  return null;
}

/** The Travel category, if this workspace has one. Expense side only. */
export function findTravelCategory(categories) {
  return (categories || []).find(c =>
    c && c.id
    && c.active !== false
    && c.type !== 'Income'
    && String(c.name || '').toLowerCase().includes('travel'),
  ) || null;
}

/**
 * Applies the three consequences above to one parsed transaction, and reports
 * what it changed so the UI can say so — silent inference on three fields at
 * once is exactly the kind of help that becomes mistrust the first time it's
 * wrong.
 *
 * Returns `{ tx, inferred }`, where `inferred` names only the fields this
 * function decided (an explicit trip the model already resolved isn't
 * reported as an inference).
 */
export function applyTripContext(tx, { trips = [], categories = [] } = {}) {
  const inferred = {};
  if (!tx || tx.action === 'delete' || tx.type === 'Transfer') return { tx, inferred };

  // A recurring bill that happens to land mid-trip is not trip spending —
  // Netflix renewing while you're in Kraków is still a domestic subscription
  // in RON. The one carve-out to "a transaction inside the window belongs to
  // the trip".
  if (tx.isSubscription) return { tx, inferred };

  const dateStr = dayOf(tx.date);
  if (!dateStr) return { tx, inferred };

  const next = { ...tx };
  const explicit = next.tripId
    ? (trips || []).find(t => t && t.id === next.tripId)
    : null;

  // Only *infer* a trip for spending. An income landing during a trip (a
  // refund, a transfer in) isn't trip spend, and Travel is an expense
  // category — but an explicit trip the model resolved is still honoured.
  const trip = explicit
    || (next.type === 'Expense' ? inferTrip(trips, dateStr, next.originalCurrency) : null);
  if (!trip) return { tx: next, inferred };

  if (!explicit) {
    next.tripId = trip.id;
    inferred.trip = trip;
  }

  const tripCurrency = String(trip.currency || '').trim().toUpperCase();
  if (!next.originalCurrency && tripCurrency && tripCurrency !== BASE_CURRENCY && next.amount != null) {
    next.originalCurrency = tripCurrency;
    next.originalAmount = next.amount;
    inferred.currency = tripCurrency;
  }

  if (next.type === 'Expense') {
    const travel = findTravelCategory(categories);
    if (travel && next.categoryId !== travel.id) {
      next.categoryId = travel.id;
      inferred.category = travel;
    }
  }

  return { tx: next, inferred };
}
