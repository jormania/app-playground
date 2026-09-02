/**
 * Whether a link arriving from the share sheet is one the forest already
 * holds — and which thing that is.
 *
 * Sharing is the one lane with no memory in it. Typing a passage a second
 * time, you recognise your own words halfway through; tapping "share" on an
 * article you already kept in June looks exactly like tapping it on one you
 * have never seen, and Silva said nothing either way. Two rows for the same
 * page, and the second one carries none of the reading you did on the first.
 *
 * What counts as the same page — campaign tags, `www.`, a trailing slash and
 * parameter order all ignored — is `comparableUrl` in `lib/linkUrl.ts`, which
 * is also where the stored form of a link is decided. Nothing here writes.
 *
 * And it never blocks the capture. It says so, and you decide — the same
 * posture as everything else in the understory, where a thing is only ever
 * kept by a human act.
 */
import type { Thing } from './notion'
import { effectiveLink } from './kindInference'
import { comparableUrl } from './linkUrl'

/**
 * The thing already holding this link, or null. Prefers the most recently
 * encountered one when a forest somehow holds several — that is the copy
 * whose note you are most likely to remember writing.
 */
export function findLinkDuplicate(things: Thing[], url: string | null | undefined): Thing | null {
  if (!url || !url.trim()) return null
  const target = comparableUrl(url)

  let best: Thing | null = null
  for (const thing of things) {
    // `effectiveLink` rather than `link`, so a row that predates Silva's own
    // link field — or one written straight into Notion — still counts.
    const link = effectiveLink(thing.body, thing.link)
    if (!link || comparableUrl(link) !== target) continue
    if (!best || thing.encountered > best.encountered) best = thing
  }
  return best
}

/**
 * How to say it, in the app's own words for the two states a thing can be
 * in — or null when there is nothing to say.
 */
export function duplicateNotice(existing: Thing | null): string | null {
  if (!existing) return null
  return existing.state === 'Kept'
    ? `You already have this — grown ${existing.kept || existing.encountered}.`
    : `This is already in the nursery — sown ${existing.encountered}.`
}
