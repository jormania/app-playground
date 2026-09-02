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
 * ── Comparison only ─────────────────────────────────────────────────────
 * Nothing here rewrites a stored URL. A link is kept exactly as it arrived,
 * because the tracking junk on the end of it is occasionally load-bearing
 * (a timestamp, a page number, a session a site genuinely needs) and it is
 * not this module's business to decide which. It only decides whether two
 * URLs are *worth telling you about*, which is a much cheaper judgment: the
 * campaign tag a newsletter adds is not what makes an article a different
 * article.
 *
 * And it never blocks the capture. It says so, and you decide — the same
 * posture as everything else in the understory, where a thing is only ever
 * kept by a human act.
 */
import type { Thing } from './notion'
import { effectiveLink } from './kindInference'

/** Parameters a share can pick up on the way that say nothing about which
 *  page it is: campaign tags, click ids, referrer breadcrumbs. */
const TRACKING = /^(utm_\w+|fbclid|gclid|dclid|msclkid|mc_[ce]id|igshid|ref|ref_src|referrer|source|share_id|__twitter_impression)$/i

/**
 * The comparable shape of a URL: no scheme case, no `www.`, no trailing
 * slash, no fragment, no tracking parameters, and what is left ordered so
 * two URLs written with the same parameters in a different order still read
 * as one page.
 *
 * Falls back to the trimmed original when the URL won't parse — an
 * unparseable string can still equal another one exactly.
 */
export function comparableUrl(url: string): string {
  const trimmed = url.trim()
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return trimmed.toLowerCase()
  }

  const params = [...parsed.searchParams.entries()]
    .filter(([key]) => !TRACKING.test(key))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

  const host = parsed.host.toLowerCase().replace(/^www\./, '')
  const path = parsed.pathname.replace(/\/+$/, '')
  const query = params.map(([key, value]) => `${key}=${value}`).join('&')

  return `${parsed.protocol.toLowerCase()}//${host}${path}${query ? `?${query}` : ''}`
}

/** True when two URLs point at the same page, campaign tags aside. */
export function sameLink(a: string, b: string): boolean {
  return comparableUrl(a) === comparableUrl(b)
}

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
