// iabilet.ro venue pages — Cinema Europa, and any venue structured like it.
//
// Rung 3 (selector), but a two-hop one. A venue page
// (iabilet.ro/bilete-<slug>-venue-<id>/) never lists a single showing — it
// carries exactly one schema.org Event block per WEEKLY THEMED BUNDLE ("Asian
// Spotlight Vol. 2", a run of seven films across one weekend), each pointing at
// a child page of its own. The actual showings — one film, one date, one time —
// live only in that child page's HTML, as an accordion of bookable tariff rows.
// This adapter reads the venue page for its bundle links, then reads each
// bundle page for the showings inside it.
//
// Two things about the tariff rows worth knowing:
//
//   - Each showing sells at more than one price (full / discounted), so rows
//     are grouped by (date, time, title) and the CHEAPEST tariff still on sale
//     becomes the event's price — the same convention as Oveit's minPrice.
//   - A subscription to the whole weekend ("Abonament") is sold as its own
//     tariff row, with no date or time of its own. It is not a showing and is
//     dropped before the date/time parser ever sees it.
//
// A showing sells out per PRICE TIER, not per showing — "Stoc epuizat" can mark
// the discounted tariff while the full-price one is still open. The showing
// itself only reads as sold out once every one of its tariffs says so.

import { TICKET, makeEvent, monthNumber, inferYear, parseTime, textOf } from './shared.js'

const EVENT_LD = /<script type="application\/ld\+json">\s*\/\*<!\[CDATA\[\*\/([\s\S]*?)\/\*\]\]>\*\/\s*<\/script>/g
// Bounded past the largest real gap observed between two tariff rows (~6KB,
// mostly an inline "why the fee?" popover baked into each row's own markup) so
// the lazy scan for this row's own sold-out marker can't run past it into the
// next row, or — for the very last row on a page — into the page's own footer.
const TARIFF = /data-is-tariff="1"[^>]*data-tariff-name="([^"]+)"[^>]*data-tariff-sell-price="([^"]*)"[\s\S]{0,8000}?(?=data-is-tariff="1"|$)/g

const MAX_BUNDLES = 12

function parseLdBlocks(html) {
  const out = []
  let m
  EVENT_LD.lastIndex = 0
  while ((m = EVENT_LD.exec(html)) !== null) {
    try { out.push(JSON.parse(m[1].trim())) } catch { /* one bad block, skip it */ }
  }
  return out
}

/** "Vineri, 28 august - 18:15 — Chungking Express - Bilet preț întreg" (and,
 *  since 2026-09, "Vineri, 4 septembrie - 18:00 - Dr. Strangelove - Bilet
 *  pret intreg" — the site dropped the em dash before the title at some
 *  point and now uses a plain hyphen for all three separators) into its
 *  parts. Both separator styles are accepted so a reversion doesn't break
 *  this again. The one before the ticket-tier name is a plain hyphen and
 *  sometimes missing its surrounding space ("Memories of Murder -Bilet"), so
 *  the title is cut at the first "Bilet" rather than at a hyphen position —
 *  which also survives the occasional malformed tier text ("redus)elevi,
 *  studenti, pemsionari)") that comes after it. */
function parseTariffName(name) {
  const m = /^\s*[^,]+,\s*(\d{1,2})\s+(\S+)\s*[-—]\s*(\d{1,2}:\d{2})\s*[-—]\s*(.*)$/.exec(String(name))
  if (!m) return null
  const [, day, month, time, rest] = m
  const titleMatch = /^(.*?)\s*-\s*[Bb]ilet\b/.exec(rest)
  const title = textOf(titleMatch ? titleMatch[1] : rest)
  return { day, month, time: parseTime(time), title }
}

export default {
  id: 'iabilet',
  label: 'iabilet.ro venue page',
  rung: 'selector',
  minItems: 3,

  requests: (venue) => [{ url: venue.url }],

  /** The venue page's own JSON-LD names one bundle per themed weekend, each
   *  with its own child page — that child page is where the showings are. */
  follow(pages) {
    const blocks = parseLdBlocks(pages[0]?.body ?? '')
    const urls = [...new Set(blocks.map((b) => b?.url).filter(Boolean))].slice(0, MAX_BUNDLES)
    return urls.map((url) => ({ url }))
  },

  parse(pages, { venue } = {}) {
    const events = []
    // Page 0 is the venue page and carries no tariffs at all — the loop below
    // simply finds nothing on it. Every later page is one bundle, whose own
    // JSON-LD supplies the year-bearing reference date the day-and-month-only
    // tariff rows need (inferYear alone, anchored on "today", would get this
    // wrong for a bundle that spans a New Year).
    for (const page of pages) {
      const html = page.body ?? ''
      const bundle = parseLdBlocks(html)[0]
      const reference = bundle?.startDate ? new Date(bundle.startDate) : new Date()
      if (Number.isNaN(reference.getTime())) continue

      const groups = new Map()
      let m
      TARIFF.lastIndex = 0
      while ((m = TARIFF.exec(html)) !== null) {
        const [chunk, name, priceRaw] = m
        if (/^\s*abonament/i.test(name)) continue // the weekend pass, not a showing
        const parsed = parseTariffName(name)
        if (!parsed || !parsed.title) continue
        const date = inferYear(parsed.day, monthNumber(parsed.month), reference)
        if (!date) continue

        const key = `${date}T${parsed.time}:${parsed.title.toLowerCase()}`
        const soldOut = /Stoc epuizat/i.test(chunk)
        const price = Number(priceRaw)
        const group = groups.get(key) ?? { date, time: parsed.time, title: parsed.title, prices: [], anyOpen: false }
        if (!soldOut && Number.isFinite(price)) group.prices.push(price)
        if (!soldOut) group.anyOpen = true
        groups.set(key, group)
      }

      for (const g of groups.values()) {
        events.push(makeEvent({
          venue: venue.name,
          title: g.title,
          date: g.date,
          time: g.time,
          link: bundle?.url ?? venue.url,
          ticketState: g.anyOpen ? TICKET.OPEN : TICKET.SOLD_OUT,
          ticketsUrl: bundle?.url ?? null,
          image: bundle?.image ?? null,
          price: g.prices.length ? Math.min(...g.prices) : null,
        }))
      }
    }
    return events.filter(Boolean)
  },
}
