/**
 * A deterministic, rule-based guess at a thing's Kind — never an LLM call.
 * SILVA.md forbids the app from auto-tagging provocations with an
 * explanation; the same reasoning applies to Kind (it's why a locus can
 * never be assigned at capture time either, see lib/loci.ts) — a thing's
 * classification is the human's judgment, this is only ever a starting
 * point they see and can accept, edit, or ignore. Never called from
 * intake or Kobo import (both deliberately capture zero metadata); only
 * ever surfaced as a "Suggest" action in the edit screen.
 */

import type { ThingKind } from './notion'

const URL_ONLY = /^https?:\/\/\S+$/i
// A quoted run long enough to plausibly be spoken dialogue, not just a
// quoted word or phrase inside an otherwise ordinary sentence.
const QUOTED_DIALOGUE = /["“][^"”]{8,}["”]/

/** A body that's nothing but a URL — reading it back out isn't a judgment
 *  call the way Kind is (SILVA.md's "never at capture" rule below is about
 *  classification, not about recognising literal data that's already
 *  there), so App.tsx uses this at intake to set `link` from the pasted
 *  text itself — the one field a Link thing needs to render its preview
 *  card, which nothing in the capture form asks for separately. */
export function isBareUrl(body: string): boolean {
  return URL_ONLY.test(body.trim())
}

/**
 * Leaves the guess unset (null) rather than force a pick when nothing
 * about the text is distinctive — an unset Kind is honest; a wrong one
 * looks authoritative it isn't.
 */
export function inferKind(body: string, hasSource: boolean): ThingKind | null {
  const trimmed = body.trim()
  if (!trimmed) return null

  if (URL_ONLY.test(trimmed)) return 'Link'
  if (trimmed.endsWith('?')) return 'Question'
  if (QUOTED_DIALOGUE.test(trimmed)) return 'Dialogue'
  if (trimmed.length < 40) return 'Fragment'
  return hasSource ? 'Passage' : 'Observation'
}
