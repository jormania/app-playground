/**
 * Finding the same charge entered twice.
 *
 * Directly relevant to audit P0-5: before the subscriptions engine had an
 * idempotency guard it re-posted charges whenever a `lastProcessed` write
 * failed, and two devices opening the app on the same day still double-post
 * anything entered by hand. This is the cleanup for whatever already slipped
 * through.
 *
 * Deliberately conservative. A false positive here invites you to delete a real
 * transaction, which is far worse than missing a duplicate you'd spot yourself,
 * so every rule below is biased towards *not* flagging.
 */
import { parseTxDate } from './period';

/** Single source for the dismissed-groups storage key — App.jsx (nav badge
 * count) and DuplicateReview.jsx (the review card itself) both read/write it
 * and need to agree on the exact string. */
export const DUPE_DISMISS_KEY = 'whereItWent_dupe_dismissed';

/**
 * Days either side of a transaction that a duplicate may land on.
 *
 * Was 3, which was far too generous: a commute charged the same fare on Monday
 * and Wednesday is not a double-entry. A real double-entry is almost always the
 * same day, or a midnight-boundary neighbour.
 */
export const DEFAULT_DAY_WINDOW = 1;

/**
 * How many separate days a given (vendor, amount) pair has to appear on before
 * it reads as a habitual charge rather than a mistake. A fixed-price purchase —
 * the same coffee, the same metro fare — repeats by nature, so an exact amount
 * match tells you nothing about it. A vendor whose charges vary (a taxi, a
 * supermarket shop) landing on the identical figure twice is far more telling.
 */
export const HABITUAL_OCCURRENCES = 3;

/** Token overlap above which two descriptions are considered the same thing. */
const SIMILARITY_THRESHOLD = 0.6;

/** The markers Split (`lib/analytics` App.jsx) and the Nora auto-split
 * (`lib/noraSplit.js`) append to the carved-out row's description, precisely
 * so a genuine, deliberate split is never mistaken for a double-entry. */
const DELIBERATE_SPLIT_SUFFIXES = [' (Split)', ' (Nora)'];

/** True when one description is exactly the other plus a split marker — a
 * transaction and the row it was deliberately split into, not two separate
 * purchases that happen to look alike. */
function isDeliberateSplitPair(a, b) {
  const da = a.description || '';
  const db = b.description || '';
  return DELIBERATE_SPLIT_SUFFIXES.some(suffix => da === db + suffix || db === da + suffix);
}

/**
 * Lowercase, strip diacritics and punctuation, collapse whitespace.
 * "Café  in Vienna!" and "cafe in vienna" have to land on the same string.
 */
export function normalizeDescription(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining marks, escaped rather than literal
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Jaccard overlap of the two descriptions' word sets, 0..1. */
export function descriptionSimilarity(a, b) {
  const na = normalizeDescription(a);
  const nb = normalizeDescription(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;

  const setA = new Set(na.split(' '));
  const setB = new Set(nb.split(' '));
  let shared = 0;
  for (const token of setA) if (setB.has(token)) shared++;
  const union = setA.size + setB.size - shared;
  return union === 0 ? 0 : shared / union;
}

/** Whole days between two transaction dates, or null if either is unparseable. */
function dayGap(a, b) {
  const da = parseTxDate(a);
  const db = parseTxDate(b);
  if (!da || !db) return null;
  return Math.abs(Math.round((da.getTime() - db.getTime()) / 86400000));
}

function habitKey(tx) {
  return `${normalizeDescription(tx.description)}|${Number(tx.amount).toFixed(2)}`;
}

/**
 * How many distinct days each (vendor, amount) pair shows up on.
 *
 * This is what separates "I paid for the same taxi twice" from "I buy the same
 * coffee every week". Derived from the ledger itself rather than a hardcoded
 * list of vendors or categories, so it adapts to how someone actually spends
 * instead of to what a developer guessed.
 */
export function buildHabitIndex(transactions) {
  const index = new Map();
  for (const tx of transactions || []) {
    if (!tx) continue;
    const key = habitKey(tx);
    if (!index.has(key)) index.set(key, new Set());
    index.get(key).add(String(tx.date).slice(0, 10));
  }
  return index;
}

/** Distinct days this exact vendor+amount pair was charged on. */
export function habitCount(index, tx) {
  const entry = index?.get(habitKey(tx));
  return entry ? entry.size : 0;
}

/**
 * How confident are we that these two rows are the same charge?
 * Returns `null` when they shouldn't be paired at all.
 */
export function scorePair(a, b, options = {}) {
  const { dayWindow = DEFAULT_DAY_WINDOW, habitIndex = null } = options;
  if (!a || !b || a.id === b.id) return null;
  // Amounts must match to the cent. A "near-miss" amount is a different charge.
  if (Number(a.amount) !== Number(b.amount)) return null;
  if ((a.type || 'Expense') !== (b.type || 'Expense')) return null;

  // Two *foreign* charges can convert to the same RON figure while being
  // genuinely different purchases, so when both carry an original amount it has
  // to match too. Only compared when both sides have one — a foreign charge and
  // a domestic one at the same RON total can still be a real double-entry.
  const aForeign = a.originalAmount != null && !!a.originalCurrency;
  const bForeign = b.originalAmount != null && !!b.originalCurrency;
  if (aForeign && bForeign) {
    if (a.originalCurrency !== b.originalCurrency) return null;
    if (Number(a.originalAmount) !== Number(b.originalAmount)) return null;
  }

  const gap = dayGap(a.date, b.date);
  if (gap === null || gap > dayWindow) return null;

  const similarity = descriptionSimilarity(a.description, b.description);
  if (similarity < SIMILARITY_THRESHOLD) return null;

  // A deliberate Split or Nora auto-split, regardless of which category either
  // half landed in. Without this, picking the *same* category for both halves
  // of an even split (same amount, same day, same account) skipped the
  // different-category override below entirely and still got flagged.
  if (isDeliberateSplitPair(a, b)) return null;

  const sameAccount = !!a.accountId && a.accountId === b.accountId;
  const sameCategory = (a.categoryId || '') === (b.categoryId || '');

  // Different categories means they were understood as different purchases at
  // the time — two coffees, not one entered twice. Only an exact same-day,
  // same-description match overrides that.
  if (!sameCategory && !(gap === 0 && similarity === 1)) return null;

  // A vendor+amount pair seen on several separate days is a habit, not a slip.
  // Those only count when they land on the *same* day, where a genuine
  // double-entry still stands out against the pattern.
  const habitual = habitIndex ? habitCount(habitIndex, a) >= HABITUAL_OCCURRENCES : false;
  if (habitual && gap !== 0) return null;

  const reasons = [];
  reasons.push(gap === 0 ? 'same day' : `${gap} day${gap === 1 ? '' : 's'} apart`);
  reasons.push(similarity === 1 ? 'identical description' : 'similar description');
  if (sameAccount) reasons.push('same account');
  if (habitual) reasons.push('though this amount is a regular charge here');

  // Same day, same vendor, same amount, same card is the strongest tell there
  // is. Anything spanning a date boundary stays a suggestion, not an assertion.
  const confidence = (gap === 0 && similarity === 1 && sameAccount && !habitual) ? 'high' : 'medium';

  return { confidence, similarity, gap, habitual, reason: reasons.join(' · ') };
}

/**
 * Group likely-duplicate transactions.
 *
 * Bucketed by exact amount first, so this stays near-linear on a real ledger
 * instead of comparing every row against every other one.
 */
export function findDuplicateGroups(transactions, options = {}) {
  const { dayWindow = DEFAULT_DAY_WINDOW } = options;
  const rows = (transactions || []).filter(t => t && t.id && Number.isFinite(Number(t.amount)));
  // Built from the whole ledger, not just the bucket, so "is this a habit?"
  // is answered against everything known about that vendor.
  const habitIndex = buildHabitIndex(rows);

  const byAmount = new Map();
  for (const tx of rows) {
    const key = Number(tx.amount).toFixed(2);
    if (!byAmount.has(key)) byAmount.set(key, []);
    byAmount.get(key).push(tx);
  }

  const groups = [];
  const claimed = new Set();

  for (const bucket of byAmount.values()) {
    if (bucket.length < 2) continue;
    // Oldest first, so the survivor suggested below is the original entry.
    const sorted = [...bucket].sort((x, y) => String(x.date).localeCompare(String(y.date)));

    for (let i = 0; i < sorted.length; i++) {
      if (claimed.has(sorted[i].id)) continue;
      const members = [sorted[i]];
      let best = null;

      for (let j = i + 1; j < sorted.length; j++) {
        if (claimed.has(sorted[j].id)) continue;
        const score = scorePair(sorted[i], sorted[j], { dayWindow, habitIndex });
        if (!score) continue;
        members.push(sorted[j]);
        if (!best || score.confidence === 'high') best = score;
      }

      if (members.length > 1) {
        members.forEach(m => claimed.add(m.id));
        groups.push({
          id: members.map(m => m.id).join('|'),
          txs: members,
          confidence: best.confidence,
          reason: best.reason,
          amount: Number(sorted[i].amount),
        });
      }
    }
  }

  // Highest-confidence and most-recent first.
  return groups.sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === 'high' ? -1 : 1;
    return String(b.txs[0].date).localeCompare(String(a.txs[0].date));
  });
}

/** A stable key for "I've already said this pair is fine". */
export function groupKey(group) {
  return [...group.txs.map(t => t.id)].sort().join('|');
}

/** Drop groups the user has already dismissed. */
export function withoutDismissed(groups, dismissedKeys) {
  const dismissed = new Set(dismissedKeys || []);
  return (groups || []).filter(g => !dismissed.has(groupKey(g)));
}

/**
 * Fields worth carrying over from the row being removed onto the one being
 * kept — never overwriting something the survivor already has.
 */
export function mergeFields(survivor, duplicate) {
  const updates = {};
  if (!survivor.notes && duplicate.notes) updates.notes = duplicate.notes;
  if (!survivor.tripId && duplicate.tripId) updates.tripId = duplicate.tripId;
  if (!survivor.categoryId && duplicate.categoryId) updates.categoryId = duplicate.categoryId;
  if (survivor.originalAmount == null && duplicate.originalAmount != null) {
    updates.originalAmount = duplicate.originalAmount;
    if (duplicate.originalCurrency) updates.originalCurrency = duplicate.originalCurrency;
  }
  const extraTags = (duplicate.tags || []).filter(t => !(survivor.tags || []).includes(t));
  if (extraTags.length > 0) updates.tags = [...(survivor.tags || []), ...extraTags];
  return updates;
}
