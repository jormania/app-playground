// Marquee's one serverless function: read the venues the client sends, fetch and
// parse each one's programme page, hand back normalized events.
//
// **This is the only endpoint Marquee will ever add.** Vercel Hobby caps the whole
// repo at 12 serverless functions and this takes it back to 12 — a per-venue
// fetcher literally cannot deploy. New venues cost an adapter module under
// api/_lib/marquee/, which is free. See MARQUEE.md §2.
//
// Stateless, exactly like api/clickdeck-studio-search.js: the client owns the
// venue list (it lives in Notion, read by the browser) and owns the diff against
// its own last snapshot. This endpoint holds nothing between calls.
//
// It does not touch Notion, and it holds no secret — there is nothing here worth
// stealing, so the gate is the ordinary origin + rate-limit pair every
// browser-facing endpoint in this repo uses.
import { originAllowed, rateLimited, clientIp } from './_shared.js'
import { scanVenue, STATUS } from './_lib/marquee/scan.js'

// Seven venues, a handful of pages each, one at a time — comfortably past the
// default budget when a site is slow. Same reasoning as clickdeck-pricing.
export const maxDuration = 300

// A scan is a fan-out of outbound fetches; this is what stops a hand-rolled
// request asking for two hundred venues at once.
const MAX_VENUES = 25

function safeParse(str) {
  try { return JSON.parse(str) } catch { return {} }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Use POST to /api/marquee-scan.' })
    return
  }
  if (!originAllowed(req.headers.origin)) {
    res.status(403).json({ message: 'Origin not allowed.' })
    return
  }
  if (rateLimited(clientIp(req))) {
    res.status(429).json({ message: 'Too many requests — try again shortly.' })
    return
  }

  const payload = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {})
  const venues = Array.isArray(payload.venues) ? payload.venues.slice(0, MAX_VENUES) : []
  if (venues.length === 0) {
    res.status(400).json({ message: 'Send { venues: [...] } — at least one venue to check.' })
    return
  }

  const now = new Date()
  const results = []
  // Sequential on purpose: seven venues is not worth a concurrency story, and one
  // request at a time is the polite way to read someone else's site.
  for (const venue of venues) {
    if (!venue?.url || !venue?.adapter) {
      results.push({
        venueId: venue?.id ?? null,
        venue: venue?.name ?? 'Unknown venue',
        status: STATUS.UNSUPPORTED,
        detail: 'That venue has no programme URL or no reader.',
        events: [],
        checkedAt: now.toISOString().slice(0, 10),
      })
      continue
    }
    results.push(await scanVenue(venue, { now }))
  }

  res.status(200).json({
    scannedAt: now.toISOString(),
    venues: results,
    events: results.flatMap((r) => r.events),
  })
}
