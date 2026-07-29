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

/** Days either side of a transaction that a duplicate may land on. */
export const DEFAULT_DAY_WINDOW = 3;

/** Token overlap above which two descriptions are considered the same thing. */
const SIMILARITY_THRESHOLD = 0.6;

/**
 * Lowercase, strip diacritics and punctuation, collapse whitespace.
 * "Café  in Vienna!" and "cafe in vienna" have to land on the same string.
 */
export function normalizeDescription(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // combining marks, escaped rather than literal
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

/**
 * How confident are we that these two rows are the same charge?
 * Returns `null` when they shouldn't be paired at all.
 */
export function scorePair(a, b, dayWindow = DEFAULT_DAY_WINDOW) {
  if (!a || !b || a.id === b.id) return null;
  // Amounts must match to the cent. A "near-miss" amount is a different charge.
  if (Number(a.amount) !== Number(b.amount)) return null;
  if ((a.type || 'Expense') !== (b.type || 'Expense')) return null;

  const gap = dayGap(a.date, b.date);
  if (gap === null || gap > dayWindow) return null;

  const similarity = descriptionSimilarity(a.description, b.description);
  if (similarity < SIMILARITY_THRESHOLD) return null;

  const sameAccount = !!a.accountId && a.accountId === b.accountId;
  const sameCategory = (a.categoryId || '') === (b.categoryId || '');

  // Two identical amounts on the *same day* in *different* categories are much
  // more likely to be two real purchases than one entered twice — two coffees,
  // not a double-entry. Only an exact description rescues that case.
  if (gap === 0 && !sameCategory && similarity < 1) return null;

  const exact = similarity === 1 && sameAccount && sameCategory;
  const confidence = exact || (similarity >= 0.9 && sameAccount) ? 'high' : 'medium';

  const reasons = [];
  reasons.push(gap === 0 ? 'same day' : `${gap} day${gap === 1 ? '' : 's'} apart`);
  reasons.push(similarity === 1 ? 'identical description' : 'similar description');
  if (sameAccount) reasons.push('same account');

  return { confidence, similarity, gap, reason: reasons.join(' · ') };
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
        const score = scorePair(sorted[i], sorted[j], dayWindow);
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
