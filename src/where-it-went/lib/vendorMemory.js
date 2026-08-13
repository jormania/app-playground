/**
 * What the ledger already knows about where you shop.
 *
 * The AI prompt carries a hardcoded list of Romanian merchants ("Mega Image →
 * Groceries, Catena → Health"). That list is static, guesses at chains you may
 * never use, and knows nothing about how *you* file things — whether Glovo is
 * Dining or Groceries in your workspace, or which card you actually put it on.
 * Your own ledger answers both, and it stays right as your habits change.
 *
 * Derived on every parse, never stored: there is no second source of truth to
 * desync, and correcting a mis-filed transaction re-teaches it immediately.
 * The same shape as the derived-not-stored rule the rollover engine follows.
 */

/**
 * The vendor a description names. Descriptions are written by the parser as
 * "<item> at <venue>" (prompt rule 8), so the venue is what follows "at" or
 * "from"; anything else is treated as the vendor itself ("Netflix", "Salary").
 *
 * The `(Split)` / `(Nora)` markers are stripped first — they're appended by
 * the split features specifically to keep duplicate detection off, and they'd
 * otherwise fork one vendor into three.
 */
export function vendorKey(description) {
  const cleaned = String(description || '')
    .replace(/\s*\((?:split|nora)\)\s*$/i, '')
    .toLowerCase()
    .trim();
  if (!cleaned) return '';

  const at = cleaned.match(/\b(?:at|from)\s+(.+)$/);
  return (at ? at[1] : cleaned)
    .replace(/[^\p{L}\p{N}\s&'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function modal(counts) {
  let best = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return { value: best, count: bestCount };
}

function bump(map, key) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

/**
 * Vendor → the category and account you usually file it under.
 *
 * A vendor qualifies when it has been seen `minCount` times *and* one category
 * holds a majority of those. A vendor split evenly between two categories is a
 * genuine judgment call every time, so it teaches nothing and is left out
 * rather than resolved by a coin toss.
 *
 * Sorted by how often you use it, capped at `limit` — this goes into every
 * prompt, so it has to stay small.
 */
export function buildVendorMemory(transactions, { minCount = 2, limit = 20 } = {}) {
  const byVendor = new Map();

  for (const tx of transactions || []) {
    if (!tx || tx.type === 'Transfer' || !tx.categoryId) continue;
    const key = vendorKey(tx.description);
    if (key.length < 3) continue;

    let entry = byVendor.get(key);
    if (!entry) {
      entry = { vendor: key, categories: new Map(), accounts: new Map(), count: 0 };
      byVendor.set(key, entry);
    }
    entry.count++;
    bump(entry.categories, tx.categoryId);
    bump(entry.accounts, tx.accountId);
  }

  const learned = [];
  for (const entry of byVendor.values()) {
    if (entry.count < minCount) continue;
    const category = modal(entry.categories);
    if (!category.value || category.count * 2 <= entry.count) continue;
    const account = modal(entry.accounts);
    learned.push({
      vendor: entry.vendor,
      categoryId: category.value,
      accountId: account.count * 2 > entry.count ? account.value : null,
      count: entry.count,
    });
  }

  return learned.sort((a, b) => b.count - a.count || a.vendor.localeCompare(b.vendor)).slice(0, limit);
}

/** The remembered filing for one description, or null. */
export function lookupVendor(memory, description) {
  const key = vendorKey(description);
  if (!key) return null;
  return (memory || []).find(m => m.vendor === key) || null;
}

/**
 * The account you've actually been paying with on this trip.
 *
 * The parser's default is "the plain RON Revolut unless told otherwise", which
 * is right at home and wrong abroad if you've been using a different card all
 * week. Requires a clear majority for the same reason `buildVendorMemory`
 * does — two transactions on two different cards say nothing.
 */
export function preferredAccountForTrip(transactions, tripId) {
  if (!tripId) return null;
  const counts = new Map();
  let total = 0;
  for (const tx of transactions || []) {
    if (!tx || tx.tripId !== tripId || !tx.accountId) continue;
    total++;
    bump(counts, tx.accountId);
  }
  if (total === 0) return null;
  const { value, count } = modal(counts);
  return count * 2 > total ? value : null;
}
