/**
 * Book matching for Kobo import. SILVA.md: "Book matching is a step, not an
 * inference... the importer proposes a match against existing Sources and
 * lets you confirm... or create — the same posture as WhereItWent's
 * duplicate detection" (src/where-it-went/lib/duplicates.js).
 *
 * Two tiers, checked in order:
 *   1. Exact `koboVolumeId` match — deterministic, no user decision. The
 *      schema calls this out explicitly as "the key the importer matches
 *      on", so it's checked before any fuzzy logic runs at all.
 *   2. Fuzzy title similarity (adapted from WhereItWent's
 *      `descriptionSimilarity`: Jaccard token overlap after normalizing
 *      diacritics/punctuation/case) — only reached when no Source has a
 *      matching Kobo id yet. Never auto-applied; always a proposal for the
 *      importer UI to confirm or reject.
 */

import type { Source } from './sources'

const SIMILARITY_THRESHOLD = 0.6
const HIGH_CONFIDENCE_THRESHOLD = 0.9

/** Strips parenthetical/bracketed edition noise ("(Penguin Classics)",
 *  "[Unabridged]") before normalizing — the single biggest source of a
 *  title that reads as different but is the same book, per SILVA.md's
 *  "Kobo's EPUB metadata gives different strings for different editions". */
function stripEditionNoise(value: string): string {
  return String(value || '').replace(/[([][^)\]]*[)\]]/g, ' ')
}

export function normalizeTitle(value: string): string {
  return stripEditionNoise(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Jaccard token overlap after normalization. 1 for an exact match, 0.9 for
 *  substring containment (a subtitle difference), otherwise the shared/union
 *  word-set ratio. 0 if either side is empty after normalizing. */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a)
  const nb = normalizeTitle(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.9

  const setA = new Set(na.split(' '))
  const setB = new Set(nb.split(' '))
  let shared = 0
  for (const token of setA) if (setB.has(token)) shared++
  const union = setA.size + setB.size - shared
  return union === 0 ? 0 : shared / union
}

export interface SourceMatch {
  source: Source
  confidence: 'exact' | 'high' | 'medium'
  similarity: number
}

/**
 * Proposes at most one candidate Source for a Kobo book. Returns null when
 * nothing clears the threshold — the importer UI reads that as "create a
 * new Source", never as "guess anyway".
 */
export function matchSource(
  bookTitle: string,
  koboVolumeId: string | null | undefined,
  existingSources: Source[],
): SourceMatch | null {
  if (koboVolumeId) {
    const exact = existingSources.find((s) => s.koboVolumeId === koboVolumeId)
    if (exact) return { source: exact, confidence: 'exact', similarity: 1 }
  }

  let best: SourceMatch | null = null
  for (const source of existingSources) {
    const similarity = titleSimilarity(bookTitle, source.title)
    if (similarity < SIMILARITY_THRESHOLD) continue
    if (!best || similarity > best.similarity) {
      best = { source, similarity, confidence: similarity >= HIGH_CONFIDENCE_THRESHOLD ? 'high' : 'medium' }
    }
  }
  return best
}
