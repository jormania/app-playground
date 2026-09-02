/**
 * The two shapes a link needs: the one Silva **keeps**, and the one it
 * **compares**.
 *
 * They are not the same, and the difference is the whole module. A URL that
 * has been through a newsletter, a share sheet and a chat app arrives
 * wearing things that say nothing about which page it is — `utm_source`,
 * `fbclid`, a referrer breadcrumb. Those are worth removing from what gets
 * written down: they are noise on a specimen label, they survive forever in
 * a collection meant to outlive the newsletter, and they make one article
 * look like several.
 *
 * Everything *else* about the URL is left exactly as it arrived. `www.`
 * stays, a trailing slash stays, parameter order stays, the fragment stays —
 * a deep link into a long page is a real part of where you were. The
 * comparison form flattens all of that too, but only to answer "is this the
 * same page?", and it is never what gets stored.
 *
 * ── Why the strip list is closed ────────────────────────────────────────
 * Guessing which parameters matter is how a link quietly stops working: `t`
 * is a timestamp on YouTube, `id` is the whole address on half the web, and
 * a site is free to call its own routing parameter anything it likes. So
 * only campaign tags and click ids — names that exist to identify *you*, not
 * the page — are ever removed, and anything unparseable is returned
 * untouched rather than repaired.
 */

/**
 * Parameters removed from a link **before it is written down**: campaign
 * tags and click ids, every one of them a name that exists to identify the
 * reader or the referral and that no site routes on.
 *
 * Narrow on purpose, because this list rewrites what gets kept. `ref` and
 * `source` are *not* in it — they read like tracking and usually are, but
 * `?ref=main` addresses a branch on GitHub's own API and `?source=` is
 * load-bearing on more than one CMS, and a link that no longer resolves is a
 * worse outcome than a tidy one that does.
 */
const TRACKING_STORED =
  /^(utm_\w+|fbclid|gclid|dclid|msclkid|mc_[ce]id|igshid|__twitter_impression|_branch_match_id|vero_id|oly_(enc|anon)_id|wt_(mc|zmc)|at_(medium|campaign)|s_kwcid)$/i

/**
 * Parameters ignored when asking **whether two links are the same page** —
 * the stored list plus the ambiguous ones. Nothing here is ever removed from
 * a URL: guessing wrong costs a duplicate warning that doesn't appear, which
 * is a remark, not a link.
 */
const TRACKING_COMPARED =
  /^(utm_\w+|fbclid|gclid|dclid|msclkid|mc_[ce]id|igshid|__twitter_impression|_branch_match_id|vero_id|oly_(enc|anon)_id|wt_(mc|zmc)|at_(medium|campaign)|s_kwcid|ref|ref_src|referrer|source|share_id|si|feature)$/i

/**
 * The URL as Silva keeps it: exactly what arrived, minus the tracking
 * parameters. Returns the input unchanged — not merely equivalent — whenever
 * there was nothing to remove, so a URL never picks up a trailing slash or
 * an encoding change just for having passed through here.
 */
export function cleanLinkUrl(url: string): string {
  const trimmed = url.trim()
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return trimmed
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return trimmed

  const hasJunk = [...parsed.searchParams.keys()].some((key) => TRACKING_STORED.test(key))
  if (!hasJunk) return trimmed

  // Rebuilt from the original text, not from `searchParams`, which re-encodes
  // as it serialises — a space becomes `+`, a comma `%2C` — and would rewrite
  // the parameters we were asked to leave alone. Cutting on the text is safe
  // here precisely because there is a query to cut: a `?` that came *after* a
  // `#` is part of the fragment, and would have left `searchParams` empty and
  // returned above.
  const queryAt = trimmed.indexOf('?')
  const hashAt = trimmed.indexOf('#')
  const base = trimmed.slice(0, queryAt)
  const hash = hashAt > -1 ? trimmed.slice(hashAt) : ''
  const kept = trimmed
    .slice(queryAt + 1, hashAt > -1 ? hashAt : undefined)
    .split('&')
    .filter((pair) => pair && !TRACKING_STORED.test(decodeKey(pair.split('=')[0])))

  return `${base}${kept.length > 0 ? `?${kept.join('&')}` : ''}${hash}`
}

/** A parameter name as written, decoded when it can be — a malformed escape
 *  is a name we simply don't recognise, not a reason to throw. */
function decodeKey(key: string): string {
  try {
    return decodeURIComponent(key)
  } catch {
    return key
  }
}

/**
 * The comparable shape of a URL — no scheme case, no `www.`, no trailing
 * slash, no fragment, no tracking parameters, and what is left ordered, so
 * two URLs written with the same parameters in a different order still read
 * as one page.
 *
 * Never stored. Falls back to the lowercased original when the URL won't
 * parse: an unparseable string can still equal another one exactly.
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
    .filter(([key]) => !TRACKING_COMPARED.test(key))
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
