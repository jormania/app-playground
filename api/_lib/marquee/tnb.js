// Teatrul Național București (TNB) — https://www.tnb.ro/ro/bilete-online
//
// Rung 3 (selector). One page lists every hall's whole forward calendar — 7
// halls (Sala "Ion Caramitru", Sala Mică, Sala Studio, Sala Atelier, Sala
// Pictura, Sala Media, Amfiteatru) sharing this ONE Marquee venue row, the
// same way eventbook's one adapter covers four cinemas: the hall comes off
// each row itself (`hall`), not off which venue was configured. That is what
// keeps TNB from ever being seven chips in the venue filter instead of one.
//
// The listing has no pagination and no "further months" link — this IS TNB's
// whole forward calendar as of whenever it's read (roughly 6-7 weeks, ~108
// rows across 35 days, as inspected 2026-08-26), sliding forward day by day as
// they open new dates and past ones drop off the top. There is nothing to cap
// here: the default 120-day horizon already exceeds what the page itself ever
// shows, so this venue is read in full, same as every non-cinema venue.
//
// Dates are three separate numbers (`26`/`08`/`2026`), not a name to parse —
// the one adapter here that never touches monthNumber/inferYear.
//
// Ticket state is unambiguous in the markup: a `red_button` anchor with a real
// bilet.ro link means tickets are on sale; a `gray-button` reading "Vândut"
// means sold out — both observed directly on the live page, not inferred.
// One row's own bilet.ro link is emitted percent-encoded by TNB's own site
// (`href="https%3A%2F%2Fwww.bilet.ro%2F..."`, a bug on their end — the literal
// href 404s as-is) — decoding it before use fixes their own link rather than
// reproducing the bug in Marquee too.
//
// No poster in the listing itself — but every production's own tnb.ro page
// carries one as `<img class="article-image" src="...">`, so this follows the
// same detail-page-fetch rule Excelsior does (MARQUEE.md §3): one hop per
// DISTINCT production (61 of them as inspected, not per showing), matched by
// the page's own request URL rather than by fetch order, so a handful of
// failed detail fetches just leave those productions posterless.
//
// The same detail page also carries the real synopsis — no second hop for it,
// just another pass over a page already being fetched for its poster. TNB's
// own markup runs a short content-advisory paragraph BEFORE the actual blurb
// (`<p><em>Spectacol nerecomandat minorilor...</em></p>` then the real text) —
// `proseParagraphs`'s length filter happens to keep both, in the order they
// print, so the real paragraph survives in position 2 rather than being lost.

import { TICKET, makeEvent, textOf, pick, parseTime, absoluteUrl, proseParagraphs } from './shared.js'

const BASE = 'https://www.tnb.ro/'
const DAY = /<div class="day">([\s\S]*?)(?=<div class="day">|$)/g
const ROW = /<tr>([\s\S]*?)<\/tr>/g
const TITLE = /class="title[^"]*">\s*<a href="([^"]+)">\s*<h1[^>]*>([\s\S]*?)<\/h1>/
const TITLE_HREF = /class="title[^"]*">\s*<a href="([^"]+)">/g
const TICKET_LINK = /<a href="([^"]+)"\s+class="red_button"/
const POSTER = /<img class="article-image" src="([^"]+)"/
// TNB runs TWO detail-page templates. A one-off event (a concert, a guest
// night) uses `article-image` above; a repertoire production — which is most
// of the calendar — uses a different layout with no such class, and its
// poster is only reachable through the page's own og:image. Checked against
// /ro/secundar, /ro/perplex and /ro/orchestra-titanic, none of which carry
// `article-image` and all of which carry og:image; the two existing fixtures
// are the reverse, so neither pattern alone covers the site. Same page, same
// request — this costs nothing beyond one more regex.
const OG_IMAGE = /<meta property="og:image" content="([^"]+)"/
// The tiered price list, on the same detail page already being fetched for
// the poster: `<div class="price_box"><p>120 lei<br />100 lei<br />…`. The
// listing itself publishes no price at all, which is why every TNB showing
// read as priceless until this was looked for.
const PRICE_BOX = /<div class="price_box">([\s\S]*?)<\/div>/

// A season runs 40-60+ distinct titles across 7 halls at once (61 observed
// 2026-08-26); capped well above that so a genuinely busy programme still gets
// every poster while a site change can't turn this into an unbounded request
// loop.
const MAX_DETAIL_PAGES = 80

function decodeMisencodedHref(href) {
  return /^https?%3A/i.test(href) ? decodeURIComponent(href) : href
}

export default {
  id: 'tnb',
  label: 'Teatrul Național București',
  rung: 'selector',
  // 108 rows across 7 halls on a normal day. A venue this size is never
  // genuinely down to a handful of showings — a low count here is far more
  // likely a markup change than a quiet calendar.
  minItems: 15,

  requests: (venue) => [{ url: venue.url }],

  /** One extra request per distinct production, for its poster. */
  follow(pages) {
    const html = pages[0]?.body ?? ''
    const hrefs = new Set()
    let m
    TITLE_HREF.lastIndex = 0
    while ((m = TITLE_HREF.exec(html)) !== null) {
      const url = absoluteUrl(m[1], BASE)
      if (url) hrefs.add(url)
    }
    return [...hrefs].slice(0, MAX_DETAIL_PAGES).map((url) => ({ url }))
  },

  parse(pages, { venue } = {}) {
    // Every page after the listing is one production's own detail page,
    // keyed by the exact URL it was fetched at — which is the same URL each
    // listing row already links to, so no canonical-tag cross-referencing is
    // needed here the way Excelsior's does.
    const posters = new Map()
    const descriptions = new Map()
    const prices = new Map()
    for (const page of pages.slice(1)) {
      const body = page.body ?? ''
      const src = POSTER.exec(body)?.[1] ?? OG_IMAGE.exec(body)?.[1]
      if (page.url && src) posters.set(page.url, absoluteUrl(src, BASE))
      if (page.url) descriptions.set(page.url, proseParagraphs(body))
      // Cheapest tier, the same convention every other reader here uses for a
      // tiered price (Oveit's minPrice, iabilet's cheapest live tariff) and the
      // one `toDraft` describes in Wanderlist as a floor rather than a seat
      // worth having.
      const box = PRICE_BOX.exec(body)?.[1]
      if (page.url && box) {
        const tiers = [...box.matchAll(/(\d+(?:[.,]\d+)?)\s*lei/gi)]
          .map((m) => Number(m[1].replace(',', '.')))
          .filter((n) => Number.isFinite(n) && n > 0)
        if (tiers.length) prices.set(page.url, Math.min(...tiers))
      }
    }

    const html = pages[0]?.body ?? ''
    const events = []
    let dayMatch
    DAY.lastIndex = 0
    while ((dayMatch = DAY.exec(html)) !== null) {
      const block = dayMatch[1]
      const day = pick(block, /class="number">(\d{1,2})</)
      const month = pick(block, /class="month">(\d{2})</)
      const year = pick(block, /class="year">(\d{4})</)
      const date = day && month && year
        ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
        : null

      let rowMatch
      ROW.lastIndex = 0
      while ((rowMatch = ROW.exec(block)) !== null) {
        const row = rowMatch[1]
        const titleMatch = TITLE.exec(row)
        if (!titleMatch) continue

        const link = absoluteUrl(titleMatch[1], BASE)
        const soldOut = /class="gray-button"/.test(row)
        let ticketHref = TICKET_LINK.exec(row)?.[1] ?? null
        if (ticketHref) ticketHref = decodeMisencodedHref(ticketHref)

        events.push(makeEvent({
          venue: venue.name,
          title: textOf(titleMatch[2]),
          date,
          time: parseTime(pick(row, /class="c3">([^<]*)</)),
          hall: pick(row, /class="c2">([^<]*)</),
          link,
          image: link ? (posters.get(link) ?? null) : null,
          price: link ? (prices.get(link) ?? null) : null,
          ticketState: soldOut ? TICKET.SOLD_OUT : ticketHref ? TICKET.OPEN : TICKET.NONE,
          ticketsUrl: ticketHref ? absoluteUrl(ticketHref, BASE) : null,
          description: link ? (descriptions.get(link) ?? null) : null,
        }))
      }
    }
    return events.filter(Boolean)
  },
}
