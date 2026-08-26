// Scanning one venue: fetch what its adapter asks for, parse it, and decide
// whether the result can be believed.
//
// The believing is the important half. A parser that silently returns zero is
// worse than one that throws — that is how scrapers rot without anyone noticing —
// so every result goes through `assess()` before it is allowed to look like "this
// venue has nothing on". See MARQUEE.md §6.

import { dedupe } from './shared.js'
import { getAdapter } from './registry.js'

export const STATUS = {
  OK: 'ok',
  EMPTY: 'empty',              // parsed fine, genuinely nothing listed
  PARSER_BROKEN: 'parser-broken',
  THROTTLED: 'throttled',
  UNREACHABLE: 'unreachable',
  UNSUPPORTED: 'unsupported',
}

const USER_AGENT = 'MarqueeBot/1.0 (+https://app-playground.vercel.app; personal venue watcher; 1 request/day)'

/**
 * How far ahead a venue's events are kept, in days from the day of the check.
 *
 * A cinema publishes dozens of showings a week for weeks running — far more
 * advance notice than anyone actually plans a trip to the pictures around — so
 * `movie` gets a short leash. Everything else (a theatre's run, a concert
 * season) genuinely benefits from seeing further out and keeps the long one.
 *
 * This is a blanket rule keyed on the venue's Category Default, not a per-venue
 * setting: add a fifth cinema next year and it is limited automatically,
 * without anyone having to remember a checkbox.
 */
export const HORIZON_DAYS = 120
export const MOVIE_HORIZON_DAYS = 10

export function horizonFor(venue) {
  return venue?.category === 'movie' ? MOVIE_HORIZON_DAYS : HORIZON_DAYS
}

/**
 * Is this result trustworthy enough to diff against?
 *
 * Three assertions, all cheap, all aimed at the same failure: a site redesign that
 * leaves the fetch succeeding and the parser matching nothing.
 *
 *   1. The page had a real body (a 200 with 400 bytes is a placeholder).
 *   2. The parser found at least the adapter's declared floor.
 *   3. At least one event has a parseable date.
 *
 * (3) is the one that catches a date-format change, which is otherwise invisible:
 * every row would parse, every row would be dropped for want of an identity, and
 * the venue would quietly report zero forever.
 */
export function assess(adapter, pages, events) {
  const bytes = pages.reduce((n, p) => n + (p.body?.length ?? (p.json ? JSON.stringify(p.json).length : 0)), 0)
  if (bytes < 500) {
    return { status: STATUS.PARSER_BROKEN, detail: 'The page came back essentially empty.' }
  }
  if (events.length === 0) {
    return {
      status: STATUS.PARSER_BROKEN,
      detail: 'The page loaded but no events could be read from it — its markup has probably changed.',
    }
  }
  if (events.length < (adapter.minItems ?? 1)) {
    return {
      status: STATUS.PARSER_BROKEN,
      detail: `Only ${events.length} event${events.length === 1 ? '' : 's'} could be read, fewer than the ${adapter.minItems} this venue normally lists.`,
    }
  }
  if (!events.some((e) => e.date)) {
    return { status: STATUS.PARSER_BROKEN, detail: 'No event had a readable date — the date format has probably changed.' }
  }
  return { status: STATUS.OK, detail: null }
}

/** Fetch one request an adapter asked for. Never throws: a failure is a value, so
 *  one dead venue can't take the whole scan down with it. */
async function fetchOne(request, fetchImpl) {
  try {
    const res = await fetchImpl(request.url, {
      headers: { 'user-agent': USER_AGENT, accept: request.json ? 'application/json' : 'text/html,*/*' },
      redirect: 'follow',
    })
    if (!res.ok) return { url: request.url, ok: false, status: res.status }
    if (request.json) return { url: request.url, ok: true, status: res.status, json: await res.json() }
    return { url: request.url, ok: true, status: res.status, body: await res.text() }
  } catch (err) {
    return { url: request.url, ok: false, status: 0, error: err?.message || 'fetch failed' }
  }
}

/**
 * Scan one venue end to end.
 *
 * Returns `{ venueId, venue, status, detail, events, checkedAt }` — always, for
 * every outcome. The caller renders the status; nothing here decides what the user
 * sees beyond naming what happened.
 */
export async function scanVenue(venue, { now = new Date(), fetchImpl = fetch, horizonDays = HORIZON_DAYS } = {}) {
  const adapter = getAdapter(venue.adapter)
  const checkedAt = now.toISOString().slice(0, 10)
  const base = { venueId: venue.id ?? null, venue: venue.name, adapter: venue.adapter, checkedAt }

  if (!adapter) {
    return { ...base, status: STATUS.UNSUPPORTED, detail: 'No reader is registered for this venue.', events: [] }
  }

  const pages = []
  for (const request of adapter.requests(venue, { now })) {
    pages.push(await fetchOne(request, fetchImpl))
  }

  const failed = pages.find((p) => !p.ok)
  if (failed) {
    // A rate limiter is not a broken site. Filarmonica's feed refuses bursts with
    // a 403 seconds after answering happily; calling that "parser broken" would
    // send someone hunting a markup change that never happened.
    const throttled = (adapter.throttleStatuses ?? [429]).includes(failed.status)
    return {
      ...base,
      status: throttled ? STATUS.THROTTLED : STATUS.UNREACHABLE,
      detail: throttled
        ? `The venue’s server is rate-limiting us (${failed.status}). Try again in a few minutes.`
        : failed.status
          ? `The page answered ${failed.status}.`
          : `Could not reach the page: ${failed.error}.`,
      events: [],
    }
  }

  // Extra pages (eventbook's pagination) are discovered from the first response.
  if (typeof adapter.follow === 'function') {
    for (const request of adapter.follow(pages, { venue, now })) {
      const page = await fetchOne(request, fetchImpl)
      if (page.ok) pages.push(page)
      // A failed page 4 is not worth failing the venue over — the pages that did
      // arrive are still real events, and the health gate still has to pass.
    }
  }

  let events
  try {
    events = dedupe(adapter.parse(pages, { venue, now }))
  } catch (err) {
    return { ...base, status: STATUS.PARSER_BROKEN, detail: `The reader threw: ${err.message}`, events: [] }
  }

  const verdict = assess(adapter, pages, events)
  if (verdict.status !== STATUS.OK) return { ...base, ...verdict, events: [] }

  // Past showings and anything absurdly far out are dropped AFTER the health gate,
  // so a programme full of last month's dates still reads as "parser fine, nothing
  // upcoming" rather than as a broken reader.
  const todayKey = now.toISOString().slice(0, 10)
  const horizon = new Date(now.getTime() + horizonDays * 86400000).toISOString().slice(0, 10)
  const upcoming = events
    .filter((e) => e.date >= todayKey && e.date <= horizon)
    .sort((a, b) => (a.date === b.date ? String(a.time).localeCompare(String(b.time)) : a.date.localeCompare(b.date)))

  return {
    ...base,
    status: upcoming.length ? STATUS.OK : STATUS.EMPTY,
    detail: upcoming.length ? null : 'Nothing upcoming is listed right now.',
    events: upcoming,
  }
}
