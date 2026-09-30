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
// **Since 2026-09 the venue page also carries one-off SCREENINGS**, not only
// bundles — nine of Cinema Europa's eleven children were single nights on
// 2026-09-30, against five bundles and no singles a month earlier. The premise
// above ("never lists a single showing") has quietly stopped being the whole
// truth, so this reads both shapes: a MULTI-DAY block is a bundle and still
// costs a hop for its tariff rows, while a SINGLE-DAY block is already a
// complete Event on the venue page — name, date, poster, synopsis and price,
// all nine of nine — and is read straight off it. That is also why `follow`
// now fetches two pages where it used to fetch eleven (§9.90).
//
// What a single-day block does NOT carry is the start time: its `startDate` is
// a bare date, the same gap quantic.js found on this host. Those screenings
// therefore read without an hour rather than with a guessed one.
//
// A showing sells out per PRICE TIER, not per showing — "Stoc epuizat" can mark
// the discounted tariff while the full-price one is still open. The showing
// itself only reads as sold out once every one of its tariffs says so.
//
// **iabilet also counts the last few out loud** (§9.73). A tariff running low
// carries its own line — "Mai sunt doar 4 bilete disponibile" — in the same
// markup this reader already has in hand, so a seat count here costs no extra
// request at all. It is a scarcity notice and not an inventory: silence means
// "more than iabilet bothers to warn about", never a number.

import { TICKET, makeEvent, monthNumber, inferYear, parseTime, textOf, parseIsoDateTime } from './shared.js'

const EVENT_LD = /<script type="application\/ld\+json">\s*\/\*<!\[CDATA\[\*\/([\s\S]*?)\/\*\]\]>\*\/\s*<\/script>/g
// Bounded past the largest real gap observed between two tariff rows (~6KB,
// mostly an inline "why the fee?" popover baked into each row's own markup) so
// the lazy scan for this row's own sold-out marker can't run past it into the
// next row, or — for the very last row on a page — into the page's own footer.
const TARIFF = /data-is-tariff="1"[^>]*data-tariff-name="([^"]+)"[^>]*data-tariff-sell-price="([^"]*)"[\s\S]{0,8000}?(?=data-is-tariff="1"|$)/g

const MAX_BUNDLES = 12

/** "Mai sunt doar 4 bilete disponibile" / "Mai este doar 1 bilet disponibil" —
 *  iabilet's own low-stock line on a tariff row, singular and plural. */
const SEATS_NOTE = /Mai\s+(?:este|sunt)\s+doar\s+(\d+)\s+bilet/i

/** The number iabilet is warning about on one tariff row, or null when it is
 *  not warning at all. Exported for its own test: this is the whole of the
 *  reader's seat knowledge, and it is one regex against someone else's
 *  wording. */
export function seatsNote(chunk) {
  const m = SEATS_NOTE.exec(String(chunk ?? ''))
  if (!m) return null
  const n = Number(m[1])
  return Number.isInteger(n) && n >= 0 ? n : null
}

/**
 * One showing's remaining tickets, from the notices on its own tariff rows.
 *
 * Two rules, both about refusing to answer:
 *
 * 1. **Every tariff still on sale must carry a notice.** One silent tariff
 *    means iabilet has more of that tier than it warns about, which says
 *    nothing about how many — so the showing's count is unknown, not the sum of
 *    the loud ones.
 * 2. **The largest notice wins, never the sum.** Where two tariffs of one
 *    showing both run low they print the SAME number (the weekend pass at
 *    Cinema Europa said "4" on its full-price and reduced rows alike), which is
 *    one pool counted twice. Adding them would invent tickets. Taking the
 *    largest is the reading that holds either way: if the tiers really did have
 *    separate allocations it under-counts, and this label exists to warn rather
 *    than to reassure.
 */
function seatsForShowing(notes, openTariffs) {
  if (openTariffs === 0 || notes.length !== openTariffs) return null
  return Math.max(...notes)
}

/** A themed weekend, as opposed to a single screening.
 *
 *  The distinction is structural rather than by name: a block whose run ends
 *  after it starts is a bundle whose showings live on its own page, and one
 *  that begins and ends on the same day is a screening the venue page has
 *  already fully described. A block with no endDate at all reads as a single —
 *  there is no evidence of a run, and treating it as a bundle would cost a
 *  request to discover nothing. */
function isBundle(block) {
  const start = String(block?.startDate ?? '').slice(0, 10)
  const end = String(block?.endDate ?? '').slice(0, 10)
  return Boolean(start && end && end > start)
}

function parseLdBlocks(html) {
  const out = []
  let m
  EVENT_LD.lastIndex = 0
  while ((m = EVENT_LD.exec(html)) !== null) {
    try { out.push(JSON.parse(m[1].trim())) } catch { /* one bad block, skip it */ }
  }
  return out
}

/** "Vineri, 28 august - 18:15 — Chungking Express - Bilet preț întreg" into its
 *  parts. **The separator before the title has now been spelled three different
 *  ways**, which is why this accepts all of them rather than tracking the
 *  current one:
 *
 *    2026-08  em dash    "18:15 — Chungking Express - Bilet preț întreg"
 *    2026-09  hyphen     "18:00 - Dr. Strangelove - Bilet pret intreg"
 *    2026-09  pipe       "18:00 | Speed - Bilet pret intreg"     <- §9.90
 *
 *  The pipe broke every row on the page at once and took Cinema Europa to zero
 *  events, which the health gate reported honestly as "its markup has probably
 *  changed" — it had. Accepting all three costs one character in a character
 *  class and makes a reversion a non-event.
 *
 *  The one before the ticket-tier name is a plain hyphen and
 *  sometimes missing its surrounding space ("Memories of Murder -Bilet"), so
 *  the title is cut at the first "Bilet" rather than at a hyphen position —
 *  which also survives the occasional malformed tier text ("redus)elevi,
 *  studenti, pemsionari)") that comes after it. */
function parseTariffName(name) {
  const m = /^\s*[^,]+,\s*(\d{1,2})\s+(\S+)\s*[-—]\s*(\d{1,2}:\d{2})\s*[-—|]\s*(.*)$/.exec(String(name))
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
   *  with its own child page — that child page is where the showings are.
   *
   *  **Only the bundles.** A single-day block is a complete Event already, so
   *  fetching its page would buy nothing but a start time and cost a request
   *  per screening — eleven hops instead of two, on the day this was measured. */
  follow(pages) {
    const blocks = parseLdBlocks(pages[0]?.body ?? '').filter(isBundle)
    const urls = [...new Set(blocks.map((b) => b?.url).filter(Boolean))].slice(0, MAX_BUNDLES)
    return urls.map((url) => ({ url }))
  },

  parse(pages, { venue } = {}) {
    const events = []

    // The one-off screenings, straight off the venue page. Read before the
    // tariff loop only so the programme comes out in a stable order; the two
    // passes are over disjoint blocks and cannot produce the same showing
    // twice — a bundle's own dates live on its child page's tariff rows, and a
    // single-day block is never followed.
    for (const block of parseLdBlocks(pages[0]?.body ?? '')) {
      if (isBundle(block)) continue
      const { date, time } = parseIsoDateTime(String(block?.startDate ?? ''))
      if (!date) continue
      const offer = block.offers && typeof block.offers === 'object'
        ? (Array.isArray(block.offers) ? block.offers[0] : block.offers)
        : null
      const raw = offer?.price
      const price = typeof raw === 'number' || (typeof raw === 'string' && String(raw).trim() !== '')
        ? Number(raw)
        : NaN
      events.push(makeEvent({
        venue: venue.name,
        title: typeof block.name === 'string' ? block.name : textOf(block.name),
        date,
        // Null, not guessed: the block carries a bare date (see the header).
        time,
        link: block.url ?? null,
        ticketState: /SoldOut/i.test(String(offer?.availability ?? '')) ? TICKET.SOLD_OUT
          : (offer?.url || Number.isFinite(price)) ? TICKET.OPEN
          : TICKET.NONE,
        ticketsUrl: offer?.url ?? null,
        image: typeof block.image === 'string' ? block.image : null,
        price: Number.isFinite(price) ? price : null,
        description: typeof block.description === 'string' ? block.description : null,
      }))
    }
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
        const group = groups.get(key) ?? { date, time: parsed.time, title: parsed.title, prices: [], anyOpen: false, openTariffs: 0, notes: [] }
        if (!soldOut && Number.isFinite(price)) group.prices.push(price)
        if (!soldOut) {
          group.anyOpen = true
          group.openTariffs++
          const left = seatsNote(chunk)
          if (left != null) group.notes.push(left)
        }
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
          // No `seatsTotal`: iabilet says how few are left, never how big the
          // room was, so the card's scarcity test falls back to the absolute
          // one — which is the right reading for a notice the site only prints
          // when the number is already small.
          seatsLeft: g.anyOpen ? seatsForShowing(g.notes, g.openTariffs) : null,
        }))
      }
    }
    return events.filter(Boolean)
  },
}
