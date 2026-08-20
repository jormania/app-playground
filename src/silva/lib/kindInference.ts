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
 * The one Kind Silva sets at capture, and the only one it can: a pasted body
 * that is nothing but a URL is a Link, which is recognising literal data
 * rather than classifying what the thing means to you (the same reading
 * `isBareUrl` already does for the `link` field itself). Null for everything
 * else — every other Kind stays a judgment made later through Suggest, or
 * never made at all.
 */
export function intakeKind(body: string): ThingKind | null {
  return isBareUrl(body) ? 'Link' : null
}

/**
 * Leaves the guess unset (null) rather than force a pick when nothing
 * about the text is distinctive — an unset Kind is honest; a wrong one
 * looks authoritative it isn't.
 */
export function inferKind(body: string, hasSource: boolean, hasLink = false): ThingKind | null {
  const trimmed = body.trim()
  if (!trimmed) return null

  // A thing carrying a URL in its own `link` field is a Link whatever its
  // body now reads as — which matters since a kept link's body is replaced
  // by the article's title (lib/linkTitle.ts), so the URL that used to be
  // the whole giveaway is no longer in the text at all.
  if (hasLink || URL_ONLY.test(trimmed)) return 'Link'
  if (trimmed.endsWith('?')) return 'Question'
  if (QUOTED_DIALOGUE.test(trimmed)) return 'Dialogue'
  if (trimmed.length < 40) return 'Fragment'
  return hasSource ? 'Passage' : 'Observation'
}
