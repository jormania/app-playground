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
// Dates here DO carry a year ("26 Aug 2026"), unlike Excelsior's.

import { TICKET, makeEvent, monthNumber, parseTime, pick, absoluteUrl } from './shared.js'

const BASE = 'https://eventbook.ro/'
const BLOCK = /id="performance"([\s\S]*?)(?=id="performance"|<nav|$)/g
const DATE = /calendar_month\s*<\/span>\s*([^<]+)/
// The time sits as bare text after the icon span, indented by ~40 spaces of
// template whitespace — a length-capped [\s\S] window ran out before reaching it
// and every showing silently lost its time. Match to the next tag instead.
const TIME = /schedule\s*<\/span>\s*([^<]{0,80})/
const TITLE = /class="[^"]*event-title[^"]*"[^>]*>\s*<h\d[^>]*>([\s\S]*?)<\/h\d>/
const LINK = /href="(\/film\/[^"]+)"/

// How many pages to walk. Ten showings per page; the busiest hall had 8 pages, so
// this covers it while capping a runaway loop on a site change.
const MAX_PAGES = 8

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
        events.push(makeEvent({
          venue: venue.name,
          title: pick(body, TITLE),
          date: parseDate(pick(body, DATE)),
          time: parseTime(pick(body, TIME)),
          link: absoluteUrl(href, BASE),
          // The add-to-cart control is the buy path; a sold-out showing loses it.
          // The explicit sold-out wording is checked too, defensively — it was not
          // observed on any of the four halls when this was written, so treat a
          // future match as a bonus rather than as the primary signal.
          ticketState: /sold\s*out|epuizat/i.test(body)
            ? TICKET.SOLD_OUT
            : /add_in_cart/.test(body) ? TICKET.OPEN : TICKET.NONE,
        }))
      }
    }
    return events.filter(Boolean)
  },
}
