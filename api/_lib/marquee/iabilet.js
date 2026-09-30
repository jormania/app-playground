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
// a bare date, the same gap quantic.js found on this host. So a screening IS
// followed after all — for its hour alone, off the same `.date` block
// quantic.js reads ("miercuri, 30 septembrie, ora 19:00") — and that hop is
// **cached**, which is what keeps it nearly free (§9.91).
//
// **This adapter follows two kinds of page, and only one of them may be
// remembered.** A bundle page IS the programme: its tariff rows are the
// showings, and caching it would cache the answer rather than the lookup —
// detailCache.js's third condition, and the reason iabilet was on the
// never-cache roster. A screening page is not the programme; the venue page
// already described the screening in full, and the page adds one static hour.
// So `extractDetail` returns a record for a screening and **null for a bundle**,
// which the scan already reads as "store nothing, ask again next time". The
// condition was always a property of a PAGE rather than of an adapter; this is
// the first reader that had to say so per page.
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
// One hop per one-off screening, for its hour. Eleven children on the day this
// was written; capped so a programme that grows cannot outrun the per-scan
// detail budget and start starving the bundles (see `follow`).
const MAX_SCREENINGS = 20

// One screening's own page, in a single flat block:
//   <div class="date"> miercuri, 30 septembrie, ora 19:00 <meta …></div>
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
 * The hour to show for one event, off its own iabilet page.
 *
 * Lives here rather than in quantic.js — where it was written (§9.87) — because
 * it reads an iabilet.ro event page, and two venues on this host now need it.
 * quantic.js re-exports it, so its own tests still prove the move.
 *
 * `ora` is the show and `acces de la` is the doors, and the doors are EARLIER;
 * taking the last clock on the line would print a 19:00 start for a 20:00
 * concert. Bounded to the `.date` block because a description routinely names
 * an hour that is right often enough to tempt.
 */
export function startTimeOf(body) {
  const block = DATE_BLOCK.exec(String(body ?? ''))?.[1]
  if (!block) return null
  return clock(SHOW_TIME.exec(block)) ?? clock(DOOR_TIME.exec(block))
}

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
    const blocks = parseLdBlocks(pages[0]?.body ?? '')
    const bundles = [...new Set(blocks.filter(isBundle).map((b) => b?.url).filter(Boolean))]
      .slice(0, MAX_BUNDLES)
    const screenings = [...new Set(blocks.filter((b) => !isBundle(b)).map((b) => b?.url).filter(Boolean))]
      .slice(0, MAX_SCREENINGS)
      .filter((url) => !bundles.includes(url))
    // **Bundles first, and the order is load-bearing.** A scan refreshes a
    // BUDGET of detail pages per check (§9.78), oldest record first, and a
    // never-fetched page sorts equal to every other never-fetched page — so on
    // a cold cache the budget is handed out in this order. A starved screening
    // costs an hour; a starved bundle costs its showings. The cheap loss goes
    // last.
    return [...bundles, ...screenings].map((url) => ({ url }))
  },

  /**
   * What may be remembered about a followed page — and what may not.
   *
   * A SCREENING page is worth one static hour, so it is cached for three days
   * (the §9.88 rule, and the same span quantic.js and salaradio.js take: an
   * hour is what you act on, so it is trusted for less time than a poster).
   *
   * A BUNDLE page returns **null**, which the scan reads as "store nothing,
   * fetch it again next time". That page IS the programme — its tariff rows are
   * the showings — and detailCache.js's third condition forbids remembering it.
   * The page classifies itself: its own JSON-LD spans several days if it is a
   * bundle, so this needs nothing from the venue page to decide.
   */
  extractDetail(page) {
    const own = parseLdBlocks(page.body ?? '')[0]
    if (!own || isBundle(own)) return null
    return { time: startTimeOf(page.body ?? '') }
  },

  detailTtlMs: 3 * 24 * 60 * 60 * 1000,

  parse(pages, { venue, details } = {}) {
    const events = []

    // An hour per screening, by the URL its venue-page block already links to.
    // Remembered records first, pages read in THIS scan second, so a fetched
    // page always beats a cached account of it. Gathered BEFORE the events are
    // built, never patched on afterwards: `key` is venue+date+title+time
    // (§9.87), so a time attached to a finished event would leave a key
    // describing an event that no longer exists.
    const times = new Map()
    for (const [url, record] of Object.entries(details ?? {})) {
      if (record?.time) times.set(url, record.time)
    }
    for (const page of pages.slice(1)) {
      if (!page.url) continue
      const own = parseLdBlocks(page.body ?? '')[0]
      if (own && isBundle(own)) continue // its showings come from the tariff rows
      const t = startTimeOf(page.body ?? '')
      if (t) times.set(page.url, t)
    }

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
        // The block itself carries a bare date, so the hour comes from the
        // screening's own page (cached). Still null when that hop was skipped
        // or failed — never guessed.
        time: time ?? times.get(block.url) ?? null,
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
