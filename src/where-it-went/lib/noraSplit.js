/**
 * Nora split — automatic expense sharing when "with Nora" appears in a transaction.
 *
 * Supported patterns (case-insensitive):
 *   "with Nora"            → 2 people total → Nora gets 1/2, you keep 1/2
 *   "with Nora and Vio"    → 3 people total → Nora gets 1/3, you keep 2/3
 *   "with Nora, Vio"       → 3 people total → same as above
 *   "with Nora and X and Y"→ 4 people total → Nora gets 1/4, you keep 3/4
 *
 * Only two transactions are ever created: your share and Nora's share.
 * Other people (like Vio) have no category and are simply factored into the
 * group size — raising the divisor but not generating extra entries.
 *
 * The "with Nora [and ...]" fragment is stripped from both the description and
 * notes on both resulting transactions.
 */

// Matches "with Nora" optionally followed by comma/and-separated names.
// e.g.  "with Nora", "with Nora and Vio", "with Nora, Vio and Alex"
const WITH_NORA_GROUP_RE = /\bwith\s+nora(?:(?:\s*,\s*|\s+and\s+|\s*&\s*)\w+)*/gi;

// Simpler trigger — just needs to see "with nora" anywhere.
const HAS_NORA_RE = /\bwith\s+nora\b/i;

/**
 * Parse the "with Nora [and ...]" segment from a raw text string.
 * Returns { found, totalPeople } where totalPeople includes yourself.
 *
 * Examples:
 *   "Dinner with Nora"          → { found: true, totalPeople: 2 }
 *   "Dinner with Nora and Vio"  → { found: true, totalPeople: 3 }
 *   "Dinner with Nora, Vio"     → { found: true, totalPeople: 3 }
 */
export function parseNoraSplitGroup(text) {
  const m = (text || '').match(/\bwith\s+nora(?:(?:\s*,\s*|\s+and\s+|\s*&\s*)\w+)*/i);
  if (!m) return { found: false, totalPeople: 2 };

  // Strip "with " prefix, then split the remaining names.
  const namesStr = m[0].replace(/^with\s+/i, ''); // e.g. "Nora and Vio"
  const names = namesStr
    .split(/\s+and\s+|\s*,\s*|\s*&\s*/i)
    .map(n => n.trim())
    .filter(Boolean);

  // names.length = number of companions (including Nora), +1 = yourself.
  return { found: true, totalPeople: names.length + 1 };
}

/**
 * Strip the full "with Nora [and ...]" group (and adjacent punctuation/spaces)
 * from a string, leaving a clean description.
 */
export function stripNoraGroup(text) {
  return (text || '')
    .replace(WITH_NORA_GROUP_RE, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,\-–—]+|[\s,\-–—]+$/g, '')
    .trim();
}

/**
 * Returns `true` when the description OR notes contain "with Nora".
 */
export function hasNoraTrigger(tx) {
  return HAS_NORA_RE.test(tx?.description || '') ||
         HAS_NORA_RE.test(tx?.notes || '');
}

/**
 * Given a single transaction and a categories array, returns either:
 *   - `[tx]`              if no Nora trigger is found.
 *   - `[yourTx, noraTx]` with amounts proportional to group size.
 *
 * tx.withNoraCount (set by SmartTextEntry before AI parsing) takes priority
 * over any in-text detection, because the AI never sees the phrase.
 */
export function applyNoraSplit(tx, categories) {
  // Determine group size. SmartTextEntry sets withNoraCount when it strips the
  // phrase before sending to the AI — so the AI can't misinterpret it.
  let totalPeople = tx.withNoraCount || null;

  if (!totalPeople) {
    // Fallback: try to detect from description / notes directly.
    const combined = (tx.description || '') + ' ' + (tx.notes || '');
    const { found, totalPeople: n } = parseNoraSplitGroup(combined);
    if (!found) return [tx];
    totalPeople = n;
  }

  const noraCategory = (categories || []).find(
    c => c.name.toLowerCase() === 'nora'
  );

  if (!noraCategory) {
    console.warn('[noraSplit] No "Nora" category found — saving as single transaction.');
    return [tx];
  }

  const total = Number(tx.amount) || 0;
  // Nora always gets exactly 1/totalPeople of the total.
  const noraShare = Math.round((total / totalPeople) * 100) / 100;
  const yourShare = Math.round((total - noraShare) * 100) / 100;

  const cleanDesc = stripNoraGroup(tx.description);
  const cleanNotes = stripNoraGroup(tx.notes) || undefined;

  const yourTx  = { ...tx, description: cleanDesc, amount: yourShare,  notes: cleanNotes };
  const noraTx  = { ...tx, description: cleanDesc, amount: noraShare,   notes: cleanNotes, categoryId: noraCategory.id };

  return [yourTx, noraTx];
}
