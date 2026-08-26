// Teatrul Excelsior — https://teatrul-excelsior.ro/program/
//
// Rung 3 (selector). Server-rendered WordPress, one anchor per showing, stable
// classes. The page also carries Yoast JSON-LD, but only WebPage/Organization —
// there is no Event object on it, so rung 1 does not apply however inviting the
// `application/ld+json` tag looks.
//
// The tickets column carries exactly two values across the whole listing —
// "Cumpără bilete" and "SOLD OUT" — which IS the ticket signal, already in the
// markup. Nothing has to be inferred.
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

import { TICKET, makeEvent, inferYear, parseTime, pick, textOf, absoluteUrl } from './shared.js'

const ITEM = /<a\s+href="([^"]+)"\s+class="el-agenda-item"[^>]*>([\s\S]*?)<\/a>/g
const BASE = 'https://teatrul-excelsior.ro/'
const CANONICAL = /<link rel="canonical" href="([^"]+)"/
const OG_IMAGE = /<meta property="og:image" content="([^"]+)"/

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
    for (const page of pages) {
      const html = page.body ?? ''
      const canonical = CANONICAL.exec(html)?.[1]
      const image = OG_IMAGE.exec(html)?.[1]
      if (canonical && image) posters.set(canonical, image)
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

      events.push(makeEvent({
        venue: venue.name,
        title: pick(body, /<h3[^>]*>([\s\S]*?)<\/h3>/),
        date: inferYear(day, month, now),
        time: parseTime(pick(body, /class="time">([^<]*)</)),
        hall: pick(body, /class="location">([^<]*)</),
        link,
        image: link ? (posters.get(link) ?? null) : null,
        // "SOLD OUT" wins over a stray buy label: a row can carry both when the
        // theatre leaves the button in place on a sold-out night.
        ticketState: /sold\s*out/i.test(tickets)
          ? TICKET.SOLD_OUT
          : /bilete/i.test(tickets) ? TICKET.OPEN : TICKET.NONE,
      }))
    }
    return events.filter(Boolean)
  },
}
