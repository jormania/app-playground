/**
 * Nora split — automatic proportional expense sharing.
 *
 * Supported patterns (case-insensitive):
 *   "with Nora"              → 2 people → Nora gets 1/2,  you keep 1/2
 *   "with Nora and Vio"      → 3 people → Nora gets 1/3,  you keep 2/3
 *   "with Nora, Vio"         → 3 people → same as above
 *   "with Nora and Vio & Al" → 4 people → Nora gets 1/4,  you keep 3/4
 *
 * Only two transactions are ever created: your remainder and Nora's share.
 * Other companions (Vio, etc.) have no category — they only raise the divisor.
 */

// Simpler, unambiguous pattern.
// Matches "with Nora" optionally followed by any number of ", Name" or "and Name" / "& Name".
// Uses explicit alternations that can't accidentally consume part of the next name.
const COMPANION_SEP = /(?:\s+(?:and|&)\s+|\s*,\s*)/i;

// Full group regex used for stripping from text.
const WITH_NORA_GROUP_RE = new RegExp(
  '\\bwith\\s+nora(?:' +
    '(?:\\s+(?:and|&)\\s+|\\s*,\\s*)\\w+' +
  ')*',
  'gi'
);

/**
 * Strip the full "with Nora [and X [and Y]]" group from a string.
 * Adjacent separators and surrounding whitespace are cleaned up.
 */
export function stripNoraGroup(text) {
  return (text || '')
    .replace(new RegExp(WITH_NORA_GROUP_RE.source, 'gi'), ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,\-–—]+|[\s,\-–—]+$/g, '')
    .trim();
}

/**
 * Parse the group size from a raw text string.
 *
 * Returns { found: false } when "with Nora" is absent,
 * or { found: true, totalPeople: N } where N includes you.
 *
 * Examples:
 *   "Dinner with Nora"           → { found: true, totalPeople: 2 }
 *   "Dinner with Nora and Vio"   → { found: true, totalPeople: 3 }
 *   "Dinner with Nora, Vio & Al" → { found: true, totalPeople: 4 }
 */
export function parseNoraSplitGroup(text) {
  const re = new RegExp(WITH_NORA_GROUP_RE.source, 'i');
  const m = (text || '').match(re);
  if (!m) return { found: false, totalPeople: 2 };

  // m[0] = e.g. "with Nora and Vio"
  const withoutWith = m[0].replace(/^with\s+/i, ''); // "Nora and Vio"
  // Split by separators to count names.
  const names = withoutWith
    .split(COMPANION_SEP)
    .map(n => n.trim())
    .filter(Boolean);

  return { found: true, totalPeople: names.length + 1 }; // +1 for yourself
}

/**
 * Returns true when "with Nora" is detectable in description or notes.
 */
export function hasNoraTrigger(tx) {
  return /\bwith\s+nora\b/i.test(tx?.description || '') ||
         /\bwith\s+nora\b/i.test(tx?.notes || '');
}

/**
 * Given a transaction and categories, returns either:
 *   - [tx]             if no Nora trigger found.
 *   - [yourTx, noraTx] split proportionally by group size.
 *
 * tx.withNoraCount is set by SmartTextEntry (it strips the phrase before AI
 * parsing so the AI never misinterprets the names as categories).
 */
export function applyNoraSplit(tx, categories) {
  let totalPeople = tx.withNoraCount || null;

  if (!totalPeople) {
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
  // Nora always gets exactly 1 / totalPeople of the bill.
  const noraShare = Math.round((total / totalPeople) * 100) / 100;
  const yourShare = Math.round((total - noraShare) * 100) / 100;

  const cleanDesc  = stripNoraGroup(tx.description);
  const cleanNotes = stripNoraGroup(tx.notes) || undefined;

  // The manual Split modal marks its new row with " (Split)" specifically so
  // duplicate detection's same-day/identical-description override (which
  // otherwise ignores mismatched categories) doesn't pair it with the
  // remainder. An even-numbered Nora split (e.g. 50/50) produces two rows
  // with the *same* amount too, so without an equivalent marker here they
  // were false-flagged as duplicates. Mirrors that existing convention.
  const yourTx = { ...tx, description: cleanDesc, amount: yourShare,  notes: cleanNotes };
  const noraTx = { ...tx, description: `${cleanDesc} (Nora)`, amount: noraShare,  notes: cleanNotes, categoryId: noraCategory.id };

  return [yourTx, noraTx];
}
