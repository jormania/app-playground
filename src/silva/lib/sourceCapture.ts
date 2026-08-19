/**
 * Turning "where did you encounter this?" into a Source, at capture time.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * SILVA.md places `loci` firmly after the fact ("A locus can never be
 * assigned at capture time. The UI must not offer it") but says nothing of
 * the sort about `source` — it is simply "optional — a thing may have no
 * origin". The Kobo lane already sets a source at capture, so provenance at
 * intake is established practice in this app, not a new idea.
 *
 * And the two fields are asymmetric in a way that matters. A locus is a
 * pattern you can only see later, so deferring it costs nothing. A source is
 * the opposite: it is the piece of context most likely to *evaporate*. You
 * will still know in six months why a sentence stopped you; you will not
 * remember which of four books you were holding. Deferring the source
 * doesn't defer the decision, it loses the answer — leaving a beautiful
 * orphaned quotation whose provenance is gone.
 *
 * So "capture first, curate later" is preserved, with one correction:
 * capturing later must never mean capturing *without context*. The minimum
 * capture keeps whatever is most perishable. The note ("why this") can wait.
 * The source often can't.
 *
 * ── Why free text, resolved here ─────────────────────────────────────────
 * `Thing.source` is a Notion *relation*, so a typed string has to become a
 * real Sources row before it can be attached. The alternative — a free-text
 * holding column on Things, promoted later — would mean a schema change, a
 * new property in everybody's database, and two fields that can disagree.
 * Resolving at the moment of capture keeps one source of truth and needs no
 * schema change at all.
 *
 * The cost is one Sources row per distinct string, which is what
 * `resolveSource` below exists to avoid: it reuses an existing Source when
 * the text clearly names one, and only proposes a new one otherwise.
 */

import { titleSimilarity } from './bookMatch'
import type { Source } from './sources'

/**
 * The bar for silently attaching typed text to an existing Source. Higher
 * than the Kobo importer's 0.6, deliberately: that path *proposes* a match
 * and waits for a human to confirm it, so it can afford to be generous. This
 * one attaches without asking, in the middle of a capture, so it only fires
 * on what `titleSimilarity` treats as the same title — an exact match, or
 * one title contained in the other ("Meditations" / "Meditations (Penguin
 * Classics)"). Anything less certain becomes a new Source rather than a
 * quietly wrong one.
 */
export const CAPTURE_MATCH_THRESHOLD = 0.9

export interface ParsedSource {
  title: string
  author: string
}

/**
 * Splits what was typed into a title and an author — but only on `by`, the
 * one separator that says which half is which. "Shelby Foote — The Civil
 * War" and "The Civil War — Shelby Foote" are the same shape, and guessing
 * between them is exactly the kind of confident inference this app is not
 * allowed to make. An unsplit string is kept whole as the title: legible on
 * the card, stable for matching, and never wrong.
 */
export function parseSourceInput(input: string): ParsedSource {
  const text = String(input || '').replace(/\s+/g, ' ').trim()
  if (!text) return { title: '', author: '' }

  // Last " by " wins, so "The Death of Ivan Ilyich by Tolstoy" splits after
  // the title rather than inside it.
  const match = text.match(/^(.*\S)\s+by\s+(\S.*)$/i)
  if (match) {
    const [, title, author] = match
    return { title: title.trim(), author: author.trim() }
  }
  return { title: text, author: '' }
}

export type SourceResolution =
  | { kind: 'none' }
  | { kind: 'existing'; source: Source }
  | { kind: 'new'; title: string; author: string }

/**
 * What a typed source line should become. Pure — the caller does the actual
 * creating, so this stays testable and free of the store.
 */
export function resolveSource(input: string, existingSources: Source[]): SourceResolution {
  const { title, author } = parseSourceInput(input)
  if (!title) return { kind: 'none' }

  let best: { source: Source; similarity: number } | null = null
  for (const source of existingSources) {
    const similarity = titleSimilarity(title, source.title)
    if (similarity < CAPTURE_MATCH_THRESHOLD) continue
    if (!best || similarity > best.similarity) best = { source, similarity }
  }

  return best ? { kind: 'existing', source: best.source } : { kind: 'new', title, author }
}

/**
 * How an already-attached Source should read back in an input the reader can
 * edit — the inverse of `parseSourceInput`, so opening the edit screen shows
 * what they typed rather than an id.
 */
export function sourceInputValue(source: Source | undefined): string {
  if (!source) return ''
  return source.author ? `${source.title} by ${source.author}` : source.title
}
