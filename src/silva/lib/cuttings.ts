/**
 * The cuttings already taken from a thing's page.
 *
 * Taking a cutting was silent past the moment of planting: the toast passed,
 * the form closed, and the plate looked exactly as it had before. Come back a
 * week later, tap **Cutting** again, and you got the same empty field with no
 * sign that you had ever taken one — no way to tell whether the passage you
 * are about to transcribe is the passage you already have.
 *
 * ── Read from the link, not from a stored relation ──────────────────────
 * A cutting inherits its parent's link (`App.tsx`'s `handleCutting`), so
 * "what came out of this page" is already in the data and needs no new Notion
 * property, no migration, and no schema change to a database the reader owns.
 * It is also right retroactively, for every cutting taken before this existed.
 *
 * The honest name for what this returns is therefore *the other things
 * pointing at the same page* — which is what a cutting is, and also what a
 * second capture of the same article would be. Neither is worth
 * distinguishing here: both are things you already have from this page, which
 * is exactly what the question is.
 */
import type { Thing } from './notion'
import { effectiveLink } from './kindInference'
import { sameLink } from './linkUrl'

/**
 * Everything else pointing at this thing's page, newest first.
 *
 * Released things are left out: they were let go, and a compost pile you can
 * still see is the thing SILVA.md refuses to build.
 */
export function cuttingsFrom(thing: Thing, things: Thing[]): Thing[] {
  const url = effectiveLink(thing.body, thing.link)
  if (!url) return []

  return things
    .filter((other) => {
      if (other.id === thing.id || other.state === 'Released') return false
      const otherUrl = effectiveLink(other.body, other.link)
      return Boolean(otherUrl) && sameLink(url, otherUrl as string)
    })
    .sort((a, b) => (a.encountered < b.encountered ? 1 : a.encountered > b.encountered ? -1 : 0))
}

/** The opening words of a cutting, enough to recognise it by without
 *  reprinting it — the plate is not where you re-read them. */
export function cuttingGist(thing: Thing, max = 80): string {
  const text = thing.body.replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}
