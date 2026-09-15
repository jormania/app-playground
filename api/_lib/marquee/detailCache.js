// Remembering what a detail page said, so the next scan doesn't ask again.
//
// WHY THIS EXISTS. TNB is read in two hops: one listing page, then one page per
// distinct production for its poster, synopsis and price — 61 of them on a
// normal day, sequential, and until now re-fetched in full on every single
// scan. That is ~62 requests inside a minute or two from one address, made by a
// client whose own User-Agent promises "1 request/day". On 2026-09-15 tnb.ro
// started answering that with a bot check (MARQUEE.md §9.61's `looksLikeBotCheck`
// caught it and reported it honestly as `throttled`), which is the outcome
// MARQUEE.md's own "Open limits" section predicted for this venue.
//
// A production's detail page is close to static: the poster and synopsis are
// set when the production opens and the price tiers change rarely. Re-reading
// all 61 every scan buys almost nothing and costs the entire request budget. So
// they are read once and remembered.
//
// WHAT IS STORED — the EXTRACTED RECORD, never the HTML. A TNB detail page is
// 60-120KB; sixty of them would be several megabytes in one value, past what
// the Upstash REST API will take in a request. The three fields an adapter
// actually wants out of that page are about 1KB. So an adapter that wants
// caching implements `extractDetail(page)`, returning the small object it would
// otherwise have derived inside `parse`, and that is what lives here.
//
// WHERE — the Upstash Redis store `api/_lib/kv.js` already wraps, the same one
// `serverScan.js` keeps its scheduled snapshot in. One key per adapter, so the
// blobs stay small and independent and a change to one venue's record shape
// can't disturb another's. When KV isn't configured (local dev, tests) every
// call here is a no-op returning nothing, and a scan behaves exactly as it did
// before this file existed — a cache that cannot be reached is a cache miss,
// never an error.

// ─────────────────────────────────────────────────────────────────────────────
// WHAT MAY BE CACHED — the rule, for every venue present and future.
//
// The default is EPHEMERAL. An adapter caches nothing unless it implements
// `extractDetail`, and it should only implement it when all four of these hold.
// `registry.test.js`'s boundary test enforces the roster that results.
//
//   1. The hop is PER PRODUCTION, not per showing. One page shared by a run of
//      six nights is worth remembering; a page per night is not, and usually
//      means the thing being read is volatile anyway.
//
//   2. What comes out of it is a FACT ABOUT THE PRODUCTION — poster, synopsis,
//      price tiers, running time. Something the site would publish identically
//      tomorrow. Never a fact about a SHOWING: ticket state, seats left,
//      availability. Those are the whole point of checking at all, they change
//      hourly, and a stale one is a lie the app shows with confidence — a
//      remembered "tickets available" sends you to a sold-out night.
//
//   3. The page is NOT the programme. A listing page, a pagination page, a feed
//      page, a bundle page whose accordion carries the actual showings — those
//      ARE the answer, and caching them caches the answer rather than the
//      lookup. This is why eventbook (paginated halls), oveit (paged feed) and
//      iabilet (bundle children) cache nothing, though all three have a
//      `follow`.
//
//   4. NO LATER HOP READS THE PAGE ITSELF. Excelsior is the instructive
//      exclusion: its detail pages look exactly like TNB's — one per
//      production, fetched for a poster — but `enrich` also mines them for the
//      `eiId` of every open showing and posts a live seat lookup per id. Skip
//      the fetch and the seat counts go with it. A page that decides what to
//      fetch next has to be in hand.
//
// And one practical constraint that follows from where this lives: the stored
// record is kilobytes. Store what was EXTRACTED, never the page it came out of.
// ─────────────────────────────────────────────────────────────────────────────

import { kvGet, kvSet } from '../kv.js'

const KEY_PREFIX = 'marquee:details:v1:'

/** How long an extracted record is trusted without re-asking.
 *
 *  A week is well short of how long a poster or a synopsis actually stands, and
 *  long enough that the ordinary case — the same handful of venues checked a
 *  few times a day — reaches the origin once per production per week instead of
 *  once per scan. */
export const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Spread, so a warm cache never goes cold all at once.
 *
 *  Sixty records written in one scan would otherwise all expire in the same
 *  scan a week later, re-creating the exact 61-request burst this file exists
 *  to prevent — the cache would work perfectly six days out of seven and
 *  reproduce the original problem on the seventh. Each URL gets its own stable
 *  offset of up to two further days, derived from the URL itself so it is the
 *  same on every run rather than re-rolled each time. */
const SPREAD_MS = 2 * 24 * 60 * 60 * 1000

/** Bounded, so a long-lived store can't grow without anyone watching. TNB's
 *  whole season is ~61 productions and the calendar slides forward a few titles
 *  at a time; 400 is several seasons of turnover, and the oldest records are the
 *  first to go. */
const MAX_ENTRIES = 400

/** Stable, tiny, non-cryptographic — it only has to scatter, not to hide.
 *  FNV-1a over the URL, taken as a fraction of the spread window. */
function spreadFor(url) {
  let h = 0x811c9dc5
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return (h / 0x100000000) * SPREAD_MS
}

/** Is this record still worth trusting without asking the site again? */
export function isFresh(entry, now = new Date(), ttlMs = DEFAULT_TTL_MS) {
  if (!entry?.fetchedAt) return false
  const age = now.getTime() - Date.parse(entry.fetchedAt)
  if (!Number.isFinite(age) || age < 0) return false
  return age < ttlMs + spreadFor(entry.url ?? '')
}

/** The default store — the real KV. Injectable so tests never need one. */
export const kvStore = { get: kvGet, set: kvSet }

/**
 * Every remembered record for one adapter, keyed by the detail page's URL.
 *
 * Never throws and never returns null: an unreachable or corrupt store is a
 * cold cache, which is a slower scan and not a failed one.
 */
export async function loadDetails(adapterId, { store = kvStore } = {}) {
  if (!adapterId) return {}
  try {
    const raw = await store.get(`${KEY_PREFIX}${adapterId}`)
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  } catch {
    return {}
  }
}

/**
 * Write back the records this scan ended up holding — both the ones it just
 * read and the ones it reused. Entries absent from `entries` are dropped, which
 * is how a production that has left the calendar stops being stored at all.
 *
 * Best-effort by design: a store that refuses the write costs the next scan its
 * shortcut, nothing more, so it must never take down the scan that produced the
 * records.
 */
export async function saveDetails(adapterId, entries, { store = kvStore } = {}) {
  if (!adapterId || !entries) return false
  const urls = Object.keys(entries)
  if (urls.length === 0) return false
  const kept = urls.length <= MAX_ENTRIES
    ? entries
    : Object.fromEntries(
      urls
        .map((url) => [url, entries[url]])
        .sort((a, b) => String(b[1]?.fetchedAt ?? '').localeCompare(String(a[1]?.fetchedAt ?? '')))
        .slice(0, MAX_ENTRIES),
    )
  try {
    return await store.set(`${KEY_PREFIX}${adapterId}`, kept)
  } catch {
    return false
  }
}
