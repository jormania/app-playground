// eventbook.ro — one adapter, four venues.
//
// Rung 3 (selector). Server-rendered, one `id="performance"` block per showing.
// The hall slug in the URL is what makes this venue-specific, so the same module
// serves Cinema Union, Elvira Popescu, Cinema Muzeul Țăranului and Club Control.
//
// Two things this markup does that the parser has to survive:
//
//   1. **Not every block is a showing.** A hall's listing opens with ticket-carnet
//      rows (`/other/carnet-5-bilete`) whose "date" is prose — "Valabil 6 luni de
//      la data achizitiei". They have no date, so makeEvent drops them. That is
//      the intended route: no date means no identity, and no identity means it is
//      not an event we can diff.
//   2. **Each block renders twice**, once for mobile and once for desktop, so
//      every field appears two or three times inside one block. First match wins;
//      they agree.
//
// Dates here DO carry a year ("26 Aug 2026"), unlike Excelsior's. Unlike
// Excelsior's listing too, every real showing carries its own poster, already
// hosted on eventbook's own CDN as an absolute URL — Excelsior's agenda rows
// have no image at all; only each show's own detail page does.
//
// Every block also carries its own price ("price: 180 lei", sometimes with a
// trailing tariff name — "27 lei (Bilet Întreg)" — that the number-only capture
// ignores). One price per block, same as every other field here.

import { TICKET, makeEvent, monthNumber, parseTime, pick, absoluteUrl } from './shared.js'

const BASE = 'https://eventbook.ro/'
const BLOCK = /id="performance"([\s\S]*?)(?=id="performance"|<nav|$)/g
const DATE = /calendar_month\s*<\/span>\s*([^<]+)/
// The time sits as bare text after the icon span, indented by ~40 spaces of
// template whitespace — a length-capped [\s\S] window ran out before reaching it
// and every showing silently lost its time. Match to the next tag instead.
const TIME = /schedule\s*<\/span>\s*([^<]{0,80})/
const TITLE = /class="[^"]*event-title[^"]*"[^>]*>\s*<h\d[^>]*>([\s\S]*?)<\/h\d>/
// `/film/` for the cinemas; `/music/` for Club Control's own listings — the
// original pattern only ever matched cinema pages, so every Club Control
// event silently had no link at all until this was noticed.
const LINK = /href="(\/(?:film|music)\/[^"]+)"/
// The poster sits in its own `event-image-hall` wrapper, already served from
// eventbook's own CDN (an absolute URL), same as `LINK` this is read straight off
// the attribute rather than through `pick()`, which would strip it as if it were
// visible text.
const IMAGE = /event-image-hall[\s\S]*?<img[^>]*\ssrc="([^"]+)"/
const PRICE = /text-muted">price:<\/span>\s*(\d+(?:[.,]\d+)?)/i

// A hall with ASSIGNED seating renders a completely different buy control and
// a completely different price. Cinema Muzeul Țăranului's Studio Horia Bernea
// is one: 7 of its 10 listings carry neither `add_in_cart` nor the `price:`
// span, so both signals missed and every one of those showings reported no
// tickets and no price — while Cinema Elvira Popescu, the same adapter, was
// 10-for-10 because it sells free seating. The two shapes are mutually
// exclusive per block, so this is a fallback, never an override.
//
// Attribute order is not assumed: `href` sits BEFORE `class` on this anchor,
// which a `class="…"` -then- `href` pattern would have missed.
const SEATS_ANCHOR = /<a[^>]*class="[^"]*choose-seats[^"]*"[^>]*>/i
const HREF = /href="([^"]+)"/i
const PRICE_HEADING = /<h5[^>]*>\s*(\d+(?:[.,]\d+)?)\s*lei/i

// How many pages to walk. Ten showings per page; the busiest hall had 8 pages, so
// this covers it while capping a runaway loop on a site change.
const MAX_PAGES = 8

// Most rows carry a dedicated `schedule` icon span; some of Club Control's
// don't and fold every time into the date line instead — "3 septembrie 2026,
// Open doors: 19:30 | Concert: 20:30 | Club night: 22:00". The last time
// mentioned is the one that matches what a `schedule`-span row for the exact
// same night gives (both read 22:00 for "Two Wrongs", confirmed live
// 2026-08-26) — "club night" being the actual ticketed start, doors and
// support acts earlier being context rather than the thing being sold.
function fallbackTime(dateText) {
  const matches = [...String(dateText ?? '').matchAll(/\b(\d{1,2})[:.](\d{2})\b/g)]
  if (!matches.length) return null
  const [, h, min] = matches[matches.length - 1]
  return parseTime(`${h}:${min}`)
}

function parseDate(text) {
  const m = /(\d{1,2})\s+([^\s]+)\s+(\d{4})/.exec(String(text ?? ''))
  if (!m) return null
  const month = monthNumber(m[2])
  if (!month) return null
  return `${m[3]}-${String(month).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`
}

export default {
  id: 'eventbook',
  label: 'Eventbook',
  rung: 'selector',
  // A quiet cinema really can have one showing listed (Cinema Union had exactly
  // one in late August), so this floor is deliberately at the bottom. The carnet
  // rows mean a hall page is never empty, which is precisely why item count alone
  // is a weak signal here and the date assertion in the health gate matters more.
  minItems: 1,

  requests: (venue) => [{ url: venue.url }],

  /** Pagination is discovered, not assumed: page 1 lists its siblings. */
  follow(pages, { venue }) {
    const first = pages[0]?.body ?? ''
    const hall = venue.config ?? ''
    const found = new Set()
    const re = new RegExp(`/hall/${hall.replace(/[^a-z0-9-]/gi, '')}\\?page=(\\d+)`, 'g')
    let m
    while ((m = re.exec(first)) !== null) {
      const n = Number(m[1])
      if (n > 1 && n <= MAX_PAGES) found.add(n)
    }
    return [...found].sort((a, b) => a - b).map((n) => ({ url: `${BASE}hall/${hall}?page=${n}` }))
  },

  parse(pages, { venue } = {}) {
    const events = []
    for (const page of pages) {
      const html = page.body ?? ''
      let m
      BLOCK.lastIndex = 0
      while ((m = BLOCK.exec(html)) !== null) {
        const body = m[1]
        const href = LINK.exec(body)?.[1] ?? null
        const imageSrc = IMAGE.exec(body)?.[1] ?? null
        const seatsAnchor = SEATS_ANCHOR.exec(body)?.[0] ?? null
        const seatsHref = seatsAnchor ? (HREF.exec(seatsAnchor)?.[1] ?? null) : null
        const priceRaw = PRICE.exec(body)?.[1] ?? PRICE_HEADING.exec(body)?.[1] ?? null
        const dateText = pick(body, DATE)
        events.push(makeEvent({
          venue: venue.name,
          title: pick(body, TITLE),
          date: parseDate(dateText),
          time: parseTime(pick(body, TIME)) ?? fallbackTime(dateText),
          link: absoluteUrl(href, BASE),
          image: absoluteUrl(imageSrc, BASE),
          price: priceRaw ? Number(priceRaw.replace(',', '.')) : null,
          // The seat picker IS the buy path for a numbered hall, so it is worth
          // carrying: a keep from one of these links straight to seat selection
          // rather than back to the listing (`toDraft` prefers ticketsUrl).
          ticketsUrl: absoluteUrl(seatsHref, BASE),
          // The add-to-cart control is the buy path; a sold-out showing loses it.
          // A numbered-seat hall never has one and offers "Choose seats" instead
          // — same meaning, different markup, so either counts.
          // The explicit sold-out wording is checked too, defensively — it was not
          // observed on any of the four halls when this was written, so treat a
          // future match as a bonus rather than as the primary signal.
          ticketState: /sold\s*out|epuizat/i.test(body)
            ? TICKET.SOLD_OUT
            : (/add_in_cart/.test(body) || seatsAnchor) ? TICKET.OPEN : TICKET.NONE,
        }))
      }
    }
    return events.filter(Boolean)
  },
}
