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
/**
 * Did the site hand us an interlude instead of a page?
 *
 * teatrulmetropolis.ro sits behind bot protection that, from some networks,
 * answers with a JS challenge — "One moment, please…", 11KB, and an HTTP
 * **200** — while a browser (and this app's own egress, as of §9.61) gets the
 * real programme. Parsed, that challenge yields nothing, and the health gate's
 * ordinary verdict for nothing is "its markup has probably changed" — which
 * would send someone to rewrite a reader that is perfectly fine.
 *
 * It is the same category of thing as a rate limiter, so it reports as one:
 * the site is not broken and neither are we, we are simply being held at the
 * door. Deliberately generic wording rather than one vendor's, and only ever
 * consulted when the parse already came back empty — a show actually called
 * "Just a moment" must not take its venue down.
 */
const BOT_CHECK = /One moment, please|Checking your browser|Just a moment\b|Enable JavaScript and cookies to continue|DDoS-?Guard|cf-browser-verification/i

export function looksLikeBotCheck(pages) {
  return (pages ?? []).some((p) => typeof p.body === 'string' && BOT_CHECK.test(p.body))
}

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

/**
 * How long one request is given before it is abandoned.
 *
 * Every fetch in a scan is sequential and a scan can run to ~80 of them (TNB's
 * per-production poster hop is the big one), so a single site that accepts a
 * connection and then never answers doesn't just delay that venue — it holds the
 * whole function until the platform kills it, taking every venue after it in the
 * loop with it. Worse, the scheduled check runs INSIDE Wanderlist's reminder
 * cron, so an unbounded hang there costs the evening email too.
 *
 * Generous enough that a slow-but-working site still succeeds; a value is still
 * a value, so a timeout reads as "unreachable" for that one venue and the scan
 * carries on.
 */
export const REQUEST_TIMEOUT_MS = 15000

/** How many times `enrich` may be asked for more requests. Two is what the
 *  deepest chain here needs (oveit.js); the third round is where an adapter
 *  that keeps asking gets stopped. */
const MAX_ENRICH_ROUNDS = 3

/** Fetch one request an adapter asked for. Never throws: a failure is a value, so
 *  one dead venue can't take the whole scan down with it. */
async function fetchOne(request, fetchImpl, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
  try {
    const res = await fetchImpl(request.url, {
      // GET unless an adapter says otherwise. Only one hop anywhere in Marquee
      // needs a POST — Excelsior's seat-count lookup (§9.68), whose ticketing
      // back-end takes a form-encoded body — and it stays opt-in per request so
      // no adapter has to think about a method it never uses.
      ...(request.method ? { method: request.method } : {}),
      ...(request.body != null ? { body: request.body } : {}),
      headers: {
        'user-agent': USER_AGENT,
        accept: request.json ? 'application/json' : 'text/html,*/*',
        ...(request.body != null ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      },
      redirect: 'follow',
      ...(controller ? { signal: controller.signal } : {}),
    })
    if (!res.ok) {
      // A non-2xx can still carry the entire page. teatrulmetropolis.ro serves
      // its complete programme — 18 showings, posters, ticket links — under an
      // HTTP 500 (§9.61): a WordPress error somewhere flips the status line
      // while the template renders happily to the end. A browser shows it and
      // nobody there notices; a reader that trusts the status line loses a
      // venue that is, in every way that matters here, publishing.
      //
      // So keep the body and let `scanVenue` put it to the health gate, which
      // judges the CONTENT and is a far better arbiter of "did we really read
      // this venue" than the status line ever was. HTML only: a feed that
      // errors returns an error document, not a feed, and `res.json()` would
      // throw on it anyway.
      const body = request.json ? undefined : await res.text().catch(() => undefined)
      return { url: request.url, tag: request.tag ?? null, ok: false, status: res.status, body, optional: request.optional === true }
    }
    if (request.json) return { url: request.url, tag: request.tag ?? null, ok: true, status: res.status, json: await res.json() }
    // A response that is not text and not JSON. seats.io serves its seat maps
    // as bytes (`application/vnd.seatsio` — every byte of the JSON shifted by a
    // constant, see seatsio.js), and `res.text()` would decode those through
    // UTF-8 and lose them. The adapter does the decoding; this layer only
    // declines to mangle it on the way in.
    if (request.binary) {
      return { url: request.url, tag: request.tag ?? null, ok: true, status: res.status, bytes: new Uint8Array(await res.arrayBuffer()) }
    }
    return { url: request.url, tag: request.tag ?? null, ok: true, status: res.status, body: await res.text() }
  } catch (err) {
    const timedOut = err?.name === 'AbortError' || err?.name === 'TimeoutError'
    return {
      url: request.url,
      tag: request.tag ?? null,
      ok: false,
      status: 0,
      error: timedOut ? `no answer within ${Math.round(timeoutMs / 1000)}s` : (err?.message || 'fetch failed'),
      optional: request.optional === true,
    }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Scan one venue end to end.
 *
 * Returns `{ venueId, venue, status, detail, events, checkedAt }` — always, for
 * every outcome. The caller renders the status; nothing here decides what the user
 * sees beyond naming what happened.
 */
export async function scanVenue(venue, { now = new Date(), fetchImpl = fetch, horizonDays = HORIZON_DAYS, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const adapter = getAdapter(venue.adapter)
  const checkedAt = now.toISOString().slice(0, 10)
  const base = { venueId: venue.id ?? null, venue: venue.name, adapter: venue.adapter, checkedAt }

  if (!adapter) {
    return { ...base, status: STATUS.UNSUPPORTED, detail: 'No reader is registered for this venue.', events: [] }
  }

  const pages = []
  for (const request of adapter.requests(venue, { now })) {
    pages.push(await fetchOne(request, fetchImpl, timeoutMs))
  }

  // An `optional` request is an enrichment source (metropolis.js's mystage
  // secondary, §9.62) — it can add a price to a showing but must never be
  // able to take its venue down. mystage having a bad afternoon would
  // otherwise report Metropolis as unreachable while the theatre's own
  // programme sat there, perfectly readable. Its failure leaves a page with
  // no body, and the adapter simply finds nothing in it.
  const failed = pages.find((p) => !p.ok && !p.optional)
  // A rate limiter is not a broken site. Filarmonica's feed refuses bursts with
  // a 403 seconds after answering happily; calling that "parser broken" would
  // send someone hunting a markup change that never happened. It is also the one
  // failure never worth parsing through: a rate-limit page is not a programme.
  const throttled = failed ? (adapter.throttleStatuses ?? [429]).includes(failed.status) : false
  // Everything else that came back with a body still gets read, and stands or
  // falls on the health gate (§9.61 — see fetchOne). A status line is a claim
  // about the request; the gate is a measurement of what arrived.
  // An optional page sits out this decision as well as the one above: it has
  // no say in whether the VENUE is readable, so a mystage secondary that came
  // back empty must not veto the salvage of a main page that arrived whole.
  const readableAnyway = Boolean(failed) && !throttled
    && pages.every((p) => p.ok || p.optional || Boolean(p.body))

  if (failed && !readableAnyway) {
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
      const page = await fetchOne(request, fetchImpl, timeoutMs)
      // Same rule as the first hop: a page that arrived is a page that can be
      // read, whatever its status line said. A site erroring on its listing
      // errors on its detail pages too, and dropping those would cost the
      // posters and descriptions they were fetched for.
      if (page.ok || page.body) pages.push(page)
      // A failed page 4 is not worth failing the venue over — the pages that did
      // arrive are still real events, and the health gate still has to pass.
    }
  }

  // A THIRD hop, for adapters that can only ask their real question once the
  // second one has answered. Excelsior's seat counts (§9.68) are the only user:
  // which showings are on sale is a fact of the detail pages `follow` just
  // fetched, and each one's remaining seats live behind its own ticketing call.
  //
  // Strictly an enrichment, and defended as one, because "how many seats" is a
  // nicety and "is this venue readable at all" is the product: it runs after
  // the health decisions above, a page that fails is simply dropped, and an
  // adapter that throws in here loses its counts rather than its venue.
  if (typeof adapter.enrich === 'function') {
    // Called until it stops asking, because one round is not always enough to
    // reach the answer. Excelsior needs a single round (a ticketing call per
    // showing). Oveit needs two: the first learns which seating chart each
    // concert uses, and only the chart named in ITS answer can be fetched in
    // the second (§9.71). The adapter sees every page fetched so far and is
    // expected not to ask twice for the same URL; the round cap is the backstop
    // if it ever does, since this hop runs inside Wanderlist's evening cron too.
    const asked = new Set()
    for (let round = 0; round < MAX_ENRICH_ROUNDS; round++) {
      let extra = []
      try { extra = adapter.enrich(pages, { venue, now, round }) ?? [] } catch { extra = [] }
      // An adapter that answers the same way every round (excelsior's enrich
      // reads the detail pages it was given and has no idea a second round
      // happened) is asking for what it already has. Filtering those out is
      // what ends the loop for it, rather than making every adapter learn to
      // recognise its own answers. The signature is what identifies a request:
      // Excelsior's seat lookups are one URL POSTed with a different body each
      // time.
      const fresh = extra.filter((r) => !asked.has(`${r.method ?? 'GET'} ${r.url} ${r.body ?? ''}`))
      if (fresh.length === 0) break
      for (const request of fresh) {
        asked.add(`${request.method ?? 'GET'} ${request.url} ${request.body ?? ''}`)
        const page = await fetchOne({ ...request, optional: true }, fetchImpl, timeoutMs)
        if (page.ok) pages.push(page)
      }
    }
  }

  let events
  try {
    events = dedupe(adapter.parse(pages, { venue, now }))
  } catch (err) {
    return { ...base, status: STATUS.PARSER_BROKEN, detail: `The reader threw: ${err.message}`, events: [] }
  }

  const verdict = assess(adapter, pages, events)
  if (verdict.status !== STATUS.OK) {
    // Both of these say the same thing in different words: what came back was
    // not this venue's programme, so do not blame this venue's markup for it.
    // Checked most-specific first — a bot check is a better answer than the
    // status line it happened to arrive under.
    if (looksLikeBotCheck(pages)) {
      return {
        ...base,
        status: STATUS.THROTTLED,
        detail: 'The site served a bot check instead of the page. Nothing is broken here; try again later.',
        events: [],
      }
    }
    // A page we only read because we ignored its status line, that then failed
    // the gate, is a site that is down — not markup that changed. Reporting
    // "its markup has probably changed" here would send someone to rewrite a
    // reader that is fine, which is the exact false alarm the gate exists to
    // avoid making.
    if (failed) {
      return { ...base, status: STATUS.UNREACHABLE, detail: `The page answered ${failed.status}.`, events: [] }
    }
    return { ...base, ...verdict, events: [] }
  }

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
    // Read fine, but the site said otherwise — carried through to the venue's
    // Last Result (`summarize`) so a misconfigured site is on the record
    // rather than silently papered over. It is the venue's bug to fix, not
    // ours to hide: a 500 today is a site one PHP error away from serving a
    // blank page tomorrow.
    ...(failed ? { servedStatus: failed.status } : {}),
    events: upcoming,
  }
}
