// ARCUB (Centrul Cultural al Municipiului București) — https://arcub.ro/agenda
//
// Rung 3 (selector). Server-rendered, no framework shell, no login wall — one
// `.pgrid-item` per listing, stable classes throughout. No JSON-LD Event
// objects and no feed; `/agenda?page=2` echoes page 1 byte-for-byte, so this
// IS the whole current agenda in one request, not the first of several.
//
// ARCUB is the one venue in this app that is genuinely interdisciplinary —
// theatre, exhibitions, guided tours, concerts and street festivals, often in
// the same week — and its own markup already says which is which: each card
// carries a `.tags` label (`Teatru`, `Muzică`, `Arte vizuale`, `Festival`).
// That is read into `category` on the event itself (CATEGORY_MAP below),
// rather than forcing the whole venue under one Category Default the way
// every single-discipline venue on this list can afford to — see
// programme.js's `categoryFor` for the client half of this, and MARQUEE.md
// for why a venue-only category would have made ARCUB invisible from half
// its own category filter tabs.
//
// ARCUB also isn't one hall: `.meta`'s second span is sometimes
// "ARCUB - Sala Mare" (an in-house hall — the venue name is stripped, same as
// every other multi-hall reader here), and sometimes a bare public location
// ("Calea Victoriei", "Piața Constituției") for a street event ARCUB
// organises but doesn't own — kept as `hall` verbatim, the exact "touring
// show" case Excelsior's SPECTACOL ITINERANT already established a precedent
// for (venue stays ARCUB either way: that's who published the listing).
//
// Dates carry no year and sometimes are a RANGE ("3 aprilie - 30 august",
// "26 - 29 august"), never a single ISO value — this app's event model has
// no end date, only a per-showing one, so a range is turned into one showing
// per day when it's short enough to plausibly be a repeated daily booking
// (a guided-tour series), and a single showing on its opening day when it's
// long enough to be a genuinely standing run (an exhibition) — see
// `RANGE_ENUMERATE_MAX_DAYS` below. The long-run case is an acknowledged
// simplification: Marquee has no `isLongRun`/`isRunningNow` concept the way
// Radar-B does, so a five-month exhibition is only ever shown on the day it
// opens rather than staying visible throughout. Worth building if ARCUB (or
// a future venue like it) turns out to need it in practice.
//
// No time is ever parsed from the listing: ARCUB sometimes bakes a time into
// the TITLE itself ("Tur ghidat cu Dan Perjovschi | ora 15:00 & 17:00" — two
// showtimes named in one string), which is exactly the kind of thing this
// reader declines to guess at rather than mis-split. The time stays visible
// to a human reading the title; it just isn't structured data. Untimed
// events already sort after timed ones everywhere in this app (Radar-B's
// `rank()`, Marquee's own `byDate`) — the honest "we don't know" this app
// renders everywhere else, not a gap unique to this adapter.
//
// The listing already carries a poster (absolute URL) and a ticket link when
// one exists, so — unlike Excelsior/TNB — no follow() hop is needed for
// either. The one field genuinely missing from the listing is a real
// description, which only a production's own `/eveniment/<slug>` page has,
// in a single `<div class="content">` wrapper (confirmed against the live
// page). It isn't bounded by matching its own closing tag — the wrapper
// nests other divs before it closes — so this reads a generous fixed window
// instead and lets `proseParagraphs` find the real sentences inside it, the
// same tolerant approach that function already takes everywhere else.

import { TICKET, makeEvent, inferYear, monthNumber, pick, textOf, absoluteUrl, proseParagraphs } from './shared.js'

const BASE = 'https://arcub.ro/'
const ITEM_MARKER = '<div class="pgrid-item">'
// Every live sample card ran 850–1100 chars; capped here well above that so
// one item's own fields are never mistaken for the next card's — the same
// bounded-window idea as excelsior.js's SHOWING_WINDOW, sized for this markup.
const ITEM_WINDOW = 1600
const CONTENT_WINDOW = 4000

const H3 = /<h3[^>]*>([\s\S]*?)<\/h3>/
const TAG = /class="tags"><span>([^<]*)<\/span>/
const META = /<div class="meta">([\s\S]*?)<\/div>/
const META_SPAN = /<span>([^<]*)<\/span>/g
const FIRST_HREF = /<a href="([^"]+)"/
const IMG_SRC = /<img src="([^"]+)"/
const TICKET_BLOCK = /<object class="box-cta">([\s\S]*?)<\/object>/
const TICKET_HREF = /<a href="([^"]+)"/

/** Every card on the agenda page, as its own bounded slice of HTML — bounded
 *  by the NEXT card's marker when there is one, or `ITEM_WINDOW` for the
 *  last card on the page (which otherwise runs to the end of the document,
 *  through unrelated footer/newsletter markup). */
function items(html) {
  const starts = []
  let idx = html.indexOf(ITEM_MARKER)
  while (idx !== -1) {
    starts.push(idx)
    idx = html.indexOf(ITEM_MARKER, idx + 1)
  }
  return starts.map((start, i) => {
    const next = starts[i + 1]
    const end = next !== undefined ? Math.min(next, start + ITEM_WINDOW) : start + ITEM_WINDOW
    return html.slice(start, end)
  })
}

/** ARCUB's own tags, folded to how `pick()` returns them, so "Arte vizuale"
 *  matches regardless of stray whitespace. Unrecognised tags (or a card with
 *  none at all — the festival items in the wild sample carry one, but
 *  nothing guarantees every future one will) fall through to `null`, which
 *  `programme.js`'s `categoryFor` then covers with the venue's own Category
 *  Default — never a silently wrong guess. */
const CATEGORY_MAP = {
  'teatru': 'play',
  'muzică': 'concert',
  'arte vizuale': 'art',
  'festival': 'event',
}

function categoryFromTag(tag) {
  return tag ? (CATEGORY_MAP[tag.trim().toLowerCase()] ?? null) : null
}

// A guided-tour series named across a handful of consecutive days reads as
// one showing per day (the existing multi-showing production model handles
// that with no schema change). Past this many days, enumerating every day
// would turn a five-month exhibition into ~150 rows — the range instead
// becomes one showing, dated on its opening day. Same order of magnitude as
// Radar-B's own `isLongRun` floor (dates.js), chosen for the same reason: a
// short run is still something you'd pick a day for; a long one already isn't.
const RANGE_ENUMERATE_MAX_DAYS = 7

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + n)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function daysBetween(startIso, endIso) {
  const [y1, m1, d1] = startIso.split('-').map(Number)
  const [y2, m2, d2] = endIso.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

function enumerate(start, end) {
  const n = daysBetween(start, end)
  if (n <= 0) return [start]
  return Array.from({ length: n + 1 }, (_, i) => addDays(start, i))
}

// "9 septembrie" · "26 - 29 august" · "3 aprilie - 30 august" — a day, a
// day-day range within one month, or a day-month-to-day-month range across
// two. Never a single ISO value.
const SINGLE_DAY = /^(\d{1,2})\s+([a-zăâîșțĂÂÎȘȚ]+)$/
const SAME_MONTH_RANGE = /^(\d{1,2})\s*-\s*(\d{1,2})\s+([a-zăâîșțĂÂÎȘȚ]+)$/
const CROSS_MONTH_RANGE = /^(\d{1,2})\s+([a-zăâîșțĂÂÎȘȚ]+)\s*-\s*(\d{1,2})\s+([a-zăâîșțĂÂÎȘȚ]+)$/

/** One `.meta` date span → the ISO dates this listing should become, per the
 *  enumerate-or-open-day rule above. Returns `[]` for anything that doesn't
 *  match one of the three observed shapes, rather than guessing. */
export function datesFromMeta(text, now = new Date()) {
  const t = String(text ?? '').trim()

  let m = CROSS_MONTH_RANGE.exec(t)
  if (m) {
    const [, d1, mon1, d2, mon2] = m
    const month1 = monthNumber(mon1)
    const month2 = monthNumber(mon2)
    // The END date is the one to run `inferYear` on: a listing page shows
    // upcoming/current things, so the END of a range is what's actually
    // close to `now` (an exhibition already well underway, like the live
    // "3 aprilie - 30 august" sample this was built against, has a START
    // month several months BEHIND today's — inferring ITS year independently
    // would roll it a full year forward, into next April, which is wrong;
    // it started back in the spring of the CURRENT year). The start shares
    // the end's year, one earlier only for a New Year wrap (month1 > month2).
    const end = inferYear(d2, month2, now)
    if (!end || !month1) return []
    const endYear = Number(end.slice(0, 4))
    const startYear = month1 > month2 ? endYear - 1 : endYear
    const start = `${startYear}-${String(month1).padStart(2, '0')}-${String(d1).padStart(2, '0')}`
    return daysBetween(start, end) <= RANGE_ENUMERATE_MAX_DAYS ? enumerate(start, end) : [start]
  }

  m = SAME_MONTH_RANGE.exec(t)
  if (m) {
    const [, d1, d2, mon] = m
    const month = monthNumber(mon)
    const start = inferYear(d1, month, now)
    const end = inferYear(d2, month, now)
    if (!start || !end) return []
    return daysBetween(start, end) <= RANGE_ENUMERATE_MAX_DAYS ? enumerate(start, end) : [start]
  }

  m = SINGLE_DAY.exec(t)
  if (m) {
    const date = inferYear(m[1], monthNumber(m[2]), now)
    return date ? [date] : []
  }

  return []
}

/** "ARCUB - Sala Mare" → "Sala Mare" (an in-house hall); "Calea Victoriei"
 *  stays as-is (a public location for a street event) — `makeEvent` already
 *  drops a hall that merely repeats the venue name, so either shape is safe
 *  to pass through once the "ARCUB - " prefix itself is gone. */
function hallFromLocation(text) {
  const t = textOf(text).replace(/^ARCUB\s*-\s*/i, '').trim()
  return t || null
}

export default {
  id: 'arcub',
  label: 'ARCUB',
  rung: 'selector',
  // A single live sample carried 7 upcoming listings; set well below that
  // rather than at it, since a quiet week between programmes is a real
  // answer, not a broken parser (MARQUEE.md §6).
  minItems: 3,

  requests: (venue) => [{ url: venue.url }],

  /** One extra request per distinct production, for its own description —
   *  the one field the listing genuinely doesn't carry (poster and ticket
   *  link both already are, straight off the listing). */
  follow(pages) {
    const html = pages[0]?.body ?? ''
    const hrefs = new Set()
    for (const item of items(html)) {
      const href = FIRST_HREF.exec(item)?.[1]
      const url = href ? absoluteUrl(href, BASE) : null
      if (url) hrefs.add(url)
    }
    return [...hrefs].map((url) => ({ url }))
  },

  parse(pages, { venue, now = new Date() } = {}) {
    // Detail pages `follow()` fetched, keyed by their own request URL — which
    // is exactly the same absoluteUrl(href, BASE) each listing's own `link`
    // is built from below, so the two line up as plain string equality with
    // no canonical-tag cross-referencing needed (unlike excelsior.js, whose
    // follow() hrefs and listing hrefs can genuinely differ).
    const descriptions = new Map()
    for (const page of pages.slice(1)) {
      const html = page.body ?? ''
      const idx = html.indexOf('class="content"')
      if (idx === -1) continue
      descriptions.set(page.url, proseParagraphs(html.slice(idx, idx + CONTENT_WINDOW)))
    }

    const events = []
    for (const item of items(pages[0]?.body ?? '')) {
      const href = FIRST_HREF.exec(item)?.[1]
      const link = href ? absoluteUrl(href, BASE) : null
      const title = pick(item, H3)
      const tag = pick(item, TAG)
      const metaHtml = META.exec(item)?.[1] ?? ''
      const [dateText, locationText] = [...metaHtml.matchAll(META_SPAN)].map((s) => s[1])
      const image = IMG_SRC.exec(item)?.[1] ?? null
      const ticketBlock = TICKET_BLOCK.exec(item)?.[1] ?? null
      const ticketHref = ticketBlock ? TICKET_HREF.exec(ticketBlock)?.[1] : null
      const ticketLabel = ticketBlock ? textOf(ticketBlock) : ''

      const dates = datesFromMeta(dateText, now)
      const category = categoryFromTag(tag)
      const hall = locationText ? hallFromLocation(locationText) : null
      const ticketsUrl = ticketHref ? absoluteUrl(ticketHref, BASE) : null
      const ticketState = !ticketHref
        ? TICKET.NONE
        : /sold\s*out|epuizat/i.test(ticketLabel) ? TICKET.SOLD_OUT : TICKET.OPEN
      const description = link ? (descriptions.get(link) ?? null) : null

      for (const date of dates) {
        events.push(makeEvent({
          venue: venue.name,
          title,
          date,
          hall,
          link,
          image,
          ticketState,
          ticketsUrl,
          category,
          description,
        }))
      }
    }
    return events.filter(Boolean)
  },
}
