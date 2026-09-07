// Teatrul Excelsior — https://teatrul-excelsior.ro/program/
//
// Rung 3 (selector). Server-rendered WordPress, one anchor per showing, stable
// classes. The page also carries Yoast JSON-LD, but only WebPage/Organization —
// there is no Event object on it, so rung 1 does not apply however inviting the
// `application/ld+json` tag looks.
//
// The listing's own tickets column reads "Cumpără bilete" for every row —
// including a genuinely sold-out one (§9.51: "Metamorfoza" reported as still
// buyable on the app while the real site showed every date as "Sold out").
// It is a static call-to-action, not a live signal; the real per-date state
// only exists on each production's own detail page (already fetched here for
// posters — see below), where every showing gets its own real button:
// `<button class="btn" style="cursor: not-allowed;">Sold out</button>` versus
// `<button class="btn select-method-button" ...>Alege locurile</button>`. Read
// off that instead, keyed by date+time so a partly sold-out run — the common
// case, one showing gone while the rest of the week is fine — still reads
// correctly date by date rather than as one flag for the whole production.
// The listing's own column stays the fallback for a production whose detail
// fetch failed, or a genuinely NEW row the listing carries that the detail
// page (fetched from a set collected during THIS SAME scan's own listing
// read) hasn't rendered a showing block for yet.
//
// Dates carry no year (`27 Aug`), so every row goes through inferYear.
//
// The listing itself carries no poster at all — only a show's own detail page
// does, and only when one was actually set (Yoast emits `og:image` only when a
// featured image exists on the post; some shows genuinely don't have one, and a
// page with a canonical but no cover is a real answer, not a parsing failure).
// So this is a two-hop adapter, same shape as eventbook's pagination and
// iabilet's bundles: `follow()` reads the listing for each DISTINCT production's
// own URL (one request per production, not per showing — a run's dates all
// share one link), and `parse()` cross-references whatever came back by each
// detail page's own `<link rel="canonical">` rather than by request order, so a
// handful of failed detail fetches just leave those shows posterless instead of
// misattributing an image to the wrong one.
//
// The same detail page also carries the real synopsis, in an `<article
// class="the-content">` wrapper the WordPress theme prints on every show's
// own page — read alongside the poster, no extra hop for it.
//
// There IS a third hop, and only for showings already known to be on sale
// (§9.68). "Alege locurile" is a boolean: it renders identically for one free
// seat and for a full house, so a night with a single returned ticket reads as
// "tickets on sale" and sends you to a page with nothing on it. The number
// behind that button is public — the ticketsys plugin the theatre runs answers
// `/spring/web/section/eventInstance/new` for any event-instance id with the
// whole seat map, statuses included — and each showing's id sits in the
// detail page as `<input type="hidden" id="eiId">`, a few hundred bytes above
// its own date header. So `enrich()` asks, per OPEN showing, and `parse()`
// counts the seats whose status is FREE. One request per buyable showing, on
// one venue; sold-out showings are never asked about, since their state
// already says everything.

import { TICKET, makeEvent, inferYear, monthNumber, parseTime, pick, textOf, absoluteUrl, proseParagraphs } from './shared.js'

const ITEM = /<a\s+href="([^"]+)"\s+class="el-agenda-item"[^>]*>([\s\S]*?)<\/a>/g
const BASE = 'https://teatrul-excelsior.ro/'
const CANONICAL = /<link rel="canonical" href="([^"]+)"/
const OG_IMAGE = /<meta property="og:image" content="([^"]+)"/
const CONTENT = /<article class="the-content">([\s\S]*?)<\/article>/

// One showing header per date, on a detail page: "24 septembrie 2026 Ora: 19:00".
const DETAIL_SHOWING = /class="tkthour"[^>]*>[\s\S]*?(\d{1,2})\s+([^\s<]+)\s+(\d{4})\s+Ora:\s*(\d{1,2}):(\d{2})/gi
// How far past its own date header a showing's buy button sits — bounded so a
// showing with a broken button can't reach forward and borrow the NEXT
// showing's state, the same reason Odeon's row scan is bounded.
const SHOWING_WINDOW = 2000
const SOLD_OUT_BTN = /class="btn"[^>]*>\s*Sold out/i
const OPEN_BTN = /select-method-button/i

// The ticketing id for a showing, printed just ABOVE its date header — the
// theme opens a fresh `.ticketsys` block per showing and the hidden input is
// its first field. Looking backwards is what makes it safe: forwards, a
// showing whose own block lacked one would silently borrow the next
// showing's id and report someone else's seats.
const EIID = /id="eiId"\s+value="(\d+)"/g
// Real gap on the live page is ~550 bytes. Bounded for the same reason
// SHOWING_WINDOW is, in the other direction.
const EIID_WINDOW = 4000

/** The nearest `eiId` printed before `at`, or null if none is close enough. */
function eiIdBefore(ids, at) {
  let found = null
  for (const { index, id } of ids) {
    if (index >= at) break
    if (at - index <= EIID_WINDOW) found = id
  }
  return found
}

/** date+time → `{ state, eiId }`, read off one production's own detail page. */
function detailShowings(html) {
  const ids = []
  EIID.lastIndex = 0
  let e
  while ((e = EIID.exec(html)) !== null) ids.push({ index: e.index, id: e[1] })

  const out = new Map()
  DETAIL_SHOWING.lastIndex = 0
  let m
  while ((m = DETAIL_SHOWING.exec(html)) !== null) {
    const [, day, monthName, year, hour, min] = m
    const month = monthNumber(monthName)
    if (!month) continue
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const time = `${hour.padStart(2, '0')}:${min}`
    const windowText = html.slice(m.index, m.index + SHOWING_WINDOW)
    const state = SOLD_OUT_BTN.test(windowText)
      ? TICKET.SOLD_OUT
      : OPEN_BTN.test(windowText) ? TICKET.OPEN : null
    if (state) out.set(`${date}T${time}`, { state, eiId: eiIdBefore(ids, m.index) })
  }
  return out
}

// --- The seat count behind an "Alege locurile" button (§9.68) --------------

const TICKETING_API = 'https://teatrul-excelsior.ro/wp-content/plugins/ticketsys-events/ticketsys/api/ticketingAjax.php'
const SECTION_ENDPOINT = '/spring/web/section/eventInstance/new'
// ticketsys' own seat statuses, from its `ticketingAPI.js`: 0 FREE, 20 RESERVE,
// 30 SOLD, 40 IN_CART, 50 PENDING, 60 SOLD_NOT_PRINTED. Only 0 is buyable —
// a seat sitting in someone else's basket is not one you can have, and
// counting it would recreate the exact overcount this whole hop exists to fix.
const SEAT_FREE = 0
// Excelsior's whole 120-day programme ran to 10 buyable showings on the day
// this was built — 10 extra requests, ~4s, roughly doubling this one venue's
// share of a scan. The cap is set where a genuinely busier season still gets
// every count while a site change cannot turn one venue into a hundred
// requests, because this hop also runs inside Wanderlist's evening cron and
// an unbounded loop there costs the email. Past the cap the remaining
// showings simply keep `seatsLeft: null` and read as they did before any of
// this existed.
const MAX_SEAT_LOOKUPS = 24

/** The form body ticketsys' WordPress shim expects (see its own ticketingAPI.js). */
function seatRequestBody(eiId) {
  return new URLSearchParams({
    action: 'ticketsys_action',
    data: JSON.stringify({ sectionId: -1, eventInstanceId: Number(eiId) }),
    address: SECTION_ENDPOINT,
  }).toString()
}

/** Every seat in a section tree. Sections nest (`ss`), seats hang off `s`. */
function collectSeats(section, into) {
  for (const seat of section?.s ?? []) into.push(seat)
  for (const child of section?.ss ?? []) collectSeats(child, into)
  return into
}

/**
 * Free seats in one seat-map response, or null if it isn't one.
 *
 * The endpoint answers with JSON whose payload is itself a JSON *string*, so
 * it is parsed twice. A seat with no `t` has no ticket record at all — not on
 * sale, never counted; the rest carry their status in `s`.
 *
 * Null and 0 mean different things and both are real: null is "we couldn't
 * read this", 0 is "the button is up but the house is gone". Neither may be
 * quietly rounded into the other.
 */
export function freeSeats(json) {
  let payload = json
  try {
    if (typeof payload === 'string') payload = JSON.parse(payload)
    if (typeof payload === 'string') payload = JSON.parse(payload)
  } catch { return null }
  const sections = payload?.data?.venue?.ss
  if (!Array.isArray(sections)) return null
  const seats = []
  for (const section of sections) collectSeats(section, seats)
  if (seats.length === 0) return null
  return seats.filter((seat) => seat?.t != null && seat?.s === SEAT_FREE).length
}

// A season runs maybe 15-20 distinct titles; capped well above that so a
// genuinely busy programme still gets every poster while a runaway loop can't
// happen on a site change.
const MAX_DETAIL_PAGES = 30

export default {
  id: 'excelsior',
  label: 'Teatrul Excelsior',
  rung: 'selector',
  // 24 rows on a normal day. Four is "the theatre is between seasons", not
  // "the parser broke" — see MARQUEE.md §6.
  minItems: 4,

  /** One page, no pagination: Excelsior renders its whole programme at once. */
  requests: (venue) => [{ url: venue.url }],

  /** One extra request per distinct production, for its poster. */
  follow(pages) {
    const html = pages[0]?.body ?? ''
    const hrefs = new Set()
    let m
    ITEM.lastIndex = 0
    while ((m = ITEM.exec(html)) !== null) {
      const url = absoluteUrl(m[1], BASE)
      if (url) hrefs.add(url)
    }
    return [...hrefs].slice(0, MAX_DETAIL_PAGES).map((url) => ({ url }))
  },

  /**
   * One seat-count request per showing that is actually on sale.
   *
   * Runs after `follow`, over the detail pages it brought back, and tags each
   * request with the showing it is about — the endpoint's answer carries no
   * id of its own, and every request goes to the same URL, so the tag is the
   * only thing keeping one showing's seats off another's card.
   */
  enrich(pages) {
    const out = []
    for (const page of pages) {
      const canonical = CANONICAL.exec(page.body ?? '')?.[1]
      if (!canonical) continue
      for (const [when, showing] of detailShowings(page.body)) {
        if (showing.state !== TICKET.OPEN || !showing.eiId) continue
        if (out.length >= MAX_SEAT_LOOKUPS) return out
        out.push({
          url: TICKETING_API,
          method: 'POST',
          body: seatRequestBody(showing.eiId),
          json: true,
          tag: { kind: 'seats', canonical, when },
        })
      }
    }
    return out
  },

  parse(pages, { venue, now = new Date() } = {}) {
    // Every page is scanned for both halves. The listing has agenda rows and no
    // canonical/og:image pair; a detail page has the reverse — so nothing here
    // needs to know which page is which, or whether a detail fetch failed. A
    // missing one just means that production keeps no poster, same as the
    // handling for every other field this reader can't find.
    const posters = new Map()
    const descriptions = new Map()
    // canonical URL → its own date+time → real ticket state.
    const ticketStates = new Map()
    // `${canonical}|${date}THH:MM` → free seats, from the enrichment hop.
    const seatCounts = new Map()
    for (const page of pages) {
      if (page.tag?.kind === 'seats') {
        const left = freeSeats(page.json)
        if (left != null) seatCounts.set(`${page.tag.canonical}|${page.tag.when}`, left)
        continue
      }
      const html = page.body ?? ''
      const canonical = CANONICAL.exec(html)?.[1]
      if (!canonical) continue
      const image = OG_IMAGE.exec(html)?.[1]
      if (image) posters.set(canonical, image)
      // `the-content` is Excelsior's WordPress theme's own synopsis wrapper —
      // present only on a detail page, never on the listing, so this is safe
      // to run over every page without first checking which kind it is.
      const content = CONTENT.exec(html)?.[1]
      if (content) descriptions.set(canonical, proseParagraphs(content))
      ticketStates.set(canonical, detailShowings(html))
    }

    const html = pages.map((p) => p.body ?? '').join('\n')
    const events = []
    let m
    ITEM.lastIndex = 0
    while ((m = ITEM.exec(html)) !== null) {
      const [, href, body] = m
      const day = pick(body, /class="month">\s*(\d{1,2})\s/)
      const month = pick(body, /class="month">\s*\d{1,2}\s+([^<]+)</)
      const tickets = textOf((/el-column-tickets"[\s\S]*?(?=<\/div>\s*<\/div>|$)/.exec(body) ?? [''])[0])
      const link = absoluteUrl(href, BASE)
      const date = inferYear(day, month, now)
      const time = parseTime(pick(body, /class="time">([^<]*)</))
      // The listing's own "Cumpără bilete"/"SOLD OUT" column is the fallback,
      // not the primary read (§9.51) — only reached when the detail page's
      // own per-date state, keyed by this exact showing, isn't available.
      const when = date && time ? `${date}T${time}` : null
      const detailState = link && when ? ticketStates.get(link)?.get(when)?.state : undefined
      // Only ever attached to a showing the detail page itself called open: a
      // count read against a state read from the LISTING's fallback column
      // would be pairing a live number with a signal §9.51 established is not
      // one, and the pair reads more confident than either half deserves.
      const seatsLeft = detailState === TICKET.OPEN && link && when
        ? seatCounts.get(`${link}|${when}`) ?? null
        : null

      events.push(makeEvent({
        venue: venue.name,
        title: pick(body, /<h3[^>]*>([\s\S]*?)<\/h3>/),
        date,
        time,
        hall: pick(body, /class="location">([^<]*)</),
        link,
        image: link ? (posters.get(link) ?? null) : null,
        description: link ? (descriptions.get(link) ?? null) : null,
        seatsLeft,
        ticketState: detailState ?? (/sold\s*out/i.test(tickets)
          ? TICKET.SOLD_OUT
          : /bilete/i.test(tickets) ? TICKET.OPEN : TICKET.NONE),
      }))
    }
    return events.filter(Boolean)
  },
}
