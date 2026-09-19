// Quantic — https://www.iabilet.ro/bilete-quantic-venue-1705/
//
// Rung 1 (jsonld) for everything a listing publishes, plus ONE hop per event
// for the one thing it doesn't: the start time.
//
// This began as a bare alias of the generic reader — `{ ...jsonld, id: 'quantic' }`
// in registry.js — and outgrew it the same way odeon.js did, for a reason worth
// recording precisely, because the surface looks identical to a venue that works.
//
// **iabilet.ro publishes `startDate` as a bare date.** All 24 events on the
// venue page carried `"startDate":"2026-09-20"` with no time component — not
// one exception, checked rather than sampled. jsonld.js already anticipates
// this: its `NEARBY_TIME` reads "ora 22:00" out of the visible card a short way
// after each JSON-LD block, which is what makes Expirat (an iabilet WHITELABEL,
// riding a different template) come out timed. iabilet.ro's own venue-page
// template does not carry it: two `ora HH:MM` strings on the whole page for 24
// events, both inside JSON descriptions rather than in a card. So the fallback
// finds nothing here and every Quantic night read as a date with no hour.
//
// The time exists only on each event's own page, in a single flat `<div
// class="date">` block — and it comes in two flavours that must not be confused:
//
//   "duminică, 20 septembrie, ora 19:00"                    -- start only
//   "marți, 22 septembrie, ora 20:00 acces de la 19:00"     -- start AND doors
//   "sâmbătă, 19 septembrie acces de la 22:00"              -- doors only
//
// **`ora` is the show; `acces de la` is the doors, and it is EARLIER.** Reading
// the last clock on the line would print a 19:00 start for a concert that
// begins at 20:00 — an hour early, every time, on exactly the rows that publish
// both. So `ora` wins wherever it appears, and `acces de la` is read only when
// there is no `ora` at all. Five of the eight rows sampled publish doors alone
// (Quantic is a club as much as a concert hall), so falling back to doors is
// what keeps this from being a fix that times three nights out of eight; the
// door time is also, for those rows, the only hour the venue itself prints.
//
// **Not opted into the detail cache**, per `detailCache.js`'s first condition:
// the hop is per SHOWING, not per production. Worth flagging rather than
// burying — a club night's start time is about as static as data gets, so this
// is the case where that condition's stated rationale ("a page per night
// usually means the thing being read is volatile anyway") does not hold. The
// rule is honoured as written; whether it should be widened is a separate
// decision, and it would apply to salaradio.js too (§9.85).

import jsonld from './jsonld.js'
import { makeEvent } from './shared.js'

const HOST = 'https://www.iabilet.ro/'

// 24 events on the venue page as inspected 2026-09-19. Capped above that so a
// busier season still gets every hour, while a template change that starts
// matching the wrong links cannot turn one venue into a hundred requests —
// MARQUEE.md §9.75's lesson, learned on TNB at 61.
const MAX_DETAIL_PAGES = 30

// Exactly one per detail page, flat, no nested divs — verified against the real
// markup rather than assumed, which is why the non-greedy bound to the first
// `</div>` is safe here.
const DATE_BLOCK = /<div class="date">([\s\S]{0,500}?)<\/div>/
const SHOW_TIME = /\bora\s+(\d{1,2}):(\d{2})/i
const DOOR_TIME = /acces\s+de\s+la\s+(\d{1,2}):(\d{2})/i

function clock(match) {
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/**
 * The hour to show for one event, off its own page.
 *
 * Bounded to the `.date` block on purpose: a description is free text and
 * routinely mentions an hour ("un concert acustic … de la ora 19:00"), which is
 * right often enough to be tempting and wrong often enough to matter. The
 * structured block is the venue speaking; the blurb is prose about it.
 */
export function startTimeOf(body) {
  const block = DATE_BLOCK.exec(String(body ?? ''))?.[1]
  if (!block) return null
  // Doors only as a fallback — never in preference to a published start.
  return clock(SHOW_TIME.exec(block)) ?? clock(DOOR_TIME.exec(block))
}

export default {
  ...jsonld,
  id: 'quantic',
  label: 'Quantic / iabilet.ro venue page',
  minItems: 6,

  /** One hop per event, for its hour.
   *
   *  Driven off the parsed events rather than off the page's anchors, which
   *  buys two things for free: the links are the JSON-LD's own canonical URLs
   *  (no `?ica_source=VenuePage` tracking query to strip), and a festival's
   *  umbrella listing has already been dropped by `dropUmbrellaListings`, so
   *  QFest costs seven requests for its seven nights instead of nine. */
  follow(pages, { venue } = {}) {
    const urls = new Set()
    for (const event of jsonld.parse([pages[0]], { venue })) {
      if (event.link && event.link.startsWith(HOST) && event.link !== venue?.url) urls.add(event.link)
    }
    return [...urls].slice(0, MAX_DETAIL_PAGES).map((url) => ({ url }))
  },

  parse(pages, ctx = {}) {
    // Only the listing carries the programme. Handing the detail pages to the
    // generic reader as well would have it parse each event's own JSON-LD a
    // second time — every night duplicated, left for `dedupe` to clean up after.
    const events = jsonld.parse(pages.slice(0, 1), ctx)

    const times = new Map()
    for (const page of pages.slice(1)) {
      const time = page.url ? startTimeOf(page.body ?? '') : null
      if (time) times.set(page.url, time)
    }
    if (times.size === 0) return events

    return events.map((event) => {
      // A time the listing somehow did carry is left alone: it came from the
      // venue's own card, and a detail page cannot improve on that.
      if (event.time || !event.link) return event
      const time = times.get(event.link)
      if (!time) return event
      // Rebuilt rather than patched. `key` is derived from venue+date+title+TIME
      // (shared.js's `eventKey`), and it is what change detection and the
      // ignore list are keyed on — so setting `.time` on a finished event would
      // leave a key describing an event that no longer exists, and every newly
      // timed night would read as "gone from the programme" exactly once.
      return makeEvent({ ...event, time }) ?? event
    })
  },
}
