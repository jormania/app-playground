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
// own page — read alongside the poster, no third hop.

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

/** date+time → real ticket state, read off one production's own detail page. */
function detailTicketStates(html) {
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
    if (SOLD_OUT_BTN.test(windowText)) out.set(`${date}T${time}`, TICKET.SOLD_OUT)
    else if (OPEN_BTN.test(windowText)) out.set(`${date}T${time}`, TICKET.OPEN)
  }
  return out
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
    for (const page of pages) {
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
      ticketStates.set(canonical, detailTicketStates(html))
    }

    const html = pages.map((p) => p.body).join('\n')
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
      const detailState = link && date && time ? ticketStates.get(link)?.get(`${date}T${time}`) : undefined

      events.push(makeEvent({
        venue: venue.name,
        title: pick(body, /<h3[^>]*>([\s\S]*?)<\/h3>/),
        date,
        time,
        hall: pick(body, /class="location">([^<]*)</),
        link,
        image: link ? (posters.get(link) ?? null) : null,
        description: link ? (descriptions.get(link) ?? null) : null,
        ticketState: detailState ?? (/sold\s*out/i.test(tickets)
          ? TICKET.SOLD_OUT
          : /bilete/i.test(tickets) ? TICKET.OPEN : TICKET.NONE),
      }))
    }
    return events.filter(Boolean)
  },
}
