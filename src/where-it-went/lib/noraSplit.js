/**
 * Nora split — automatic 50/50 expense sharing.
 *
 * When a transaction description contains the phrase "with Nora" (case-insensitive),
 * the entry is split into two equal halves:
 *   1. Your share  — same category as the original, half the amount.
 *   2. Nora's share — "Nora" category, half the amount.
 *
 * Both entries carry the cleaned description (the "with Nora" fragment and any
 * surrounding punctuation/whitespace are stripped), the original account, date,
 * and type. The original single transaction is never written; only the two halves.
 *
 * If the description does NOT contain "with Nora", the function returns the
 * original transaction unchanged inside a single-element array so callers can
 * always iterate over the result uniformly.
 */

const WITH_NORA_RE = /\s*[,\-–—]?\s*with nora\s*[,\-–—]?/gi;

/**
 * Strip "with Nora" (and any adjacent separators/whitespace) from a description,
 * then trim the result so there are no leading/trailing spaces or stray punctuation.
 */
function cleanDescription(description) {
  return (description || '')
    .replace(WITH_NORA_RE, ' ')
    .replace(/\s{2,}/g, ' ')   // collapse double-spaces left behind
    .replace(/^[\s,\-–—]+|[\s,\-–—]+$/g, '') // trim leading/trailing separators
    .trim();
}

/**
 * Returns `true` when the description contains "with Nora" (case-insensitive).
 */
export function hasNoraTrigger(description) {
  return /with nora/i.test(description || '');
}

/**
 * Given a single transaction object and a categories array, returns:
 *   - `[tx]` if the description does not contain "with Nora".
 *   - `[yourTx, noraTx]` if it does — each at half the original amount.
 *
 * The "Nora" category is looked up by name (case-insensitive).
 * If it cannot be found the split is skipped and `[tx]` is returned so the
 * caller never silently loses money.
 */
export function applyNoraSplit(tx, categories) {
  if (!hasNoraTrigger(tx.description)) return [tx];

  const noraCategory = (categories || []).find(
    c => c.name.toLowerCase() === 'nora'
  );

  // Safety net: if the category doesn't exist, save the original transaction
  // rather than silently dropping it.
  if (!noraCategory) {
    console.warn('[noraSplit] No "Nora" category found — saving as single transaction.');
    return [tx];
  }

  const half = Math.round(((Number(tx.amount) || 0) / 2) * 100) / 100;
  const cleanDesc = cleanDescription(tx.description);

  const yourTx = {
    ...tx,
    description: cleanDesc,
    amount: half,
  };

  const noraTx = {
    ...tx,
    description: cleanDesc,
    amount: half,
    categoryId: noraCategory.id,
  };

  return [yourTx, noraTx];
}
