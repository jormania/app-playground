// Teatrul Metropolis — https://teatrulmetropolis.ro/program/
//
// Rung 3 (selector), single-hop. The venue's OWN ticketing app
// (bilete.teatrulmetropolis.ro, a create-react-app SPA) is what someone
// naturally lands on first, but its server response is a bare `<div
// id="root">` with no data at all — the same client-side-only shape as
// Filarmonica's Next.js page (MARQUEE.md §3's survey), and its `/api/`
// backend 401s a plain request without whatever session/auth the SPA itself
// establishes. **This is not the page to read.** The theatre's main site
// (teatrulmetropolis.ro, a separate WordPress install) publishes its own
// `/program/` listing, fully server-rendered, with every field this app
// wants already on it — no follow() hop needed, unlike Excelsior or TNB.
//
// One row per showing, in a stable structure:
//
//   <span class="cal-date">8.09</span>                          -- no year
//   <div class="cboxtitle"><a href="...">Club 27</a></div>
//   <div class="mboxdesc"><span class="shrt">...</span></div>   -- description
//   <div class="cboxdet">
//     <span class="show-sala">Sala Mare</span>                 -- hall
//     <span class="show-ora">19:00</span>
//     <span class="show-reval"><a href="...">Cumpără bilete</a></span>
//   </div>
//   ...poster <img class="img-fluid">...
//
// Two things the real markup showed that matter:
//
//   - **Metropolis co-produces with other companies**, and a co-produced
//     night's own link/ticket anchor can point OFF-domain entirely (Teatrul
//     Stela Popescu's own site, for "Hedwig and the Angry Inch"). The venue
//     stays "Teatrul Metropolis" regardless — that's who published the
//     listing — the same precedent Excelsior's SPECTACOL ITINERANT and
//     ARCUB's touring events already established.
//   - **Two halls share one listing** (Sala Mare, Sala Mică), read straight
//     off each row's own `.show-sala` — no per-hall URL to configure, same
//     shape as TNB's `hall` field.
//
// No price is published anywhere on this page — confirmed by reading the
// real markup, not assumed; every showing's `price` stays null.

import { TICKET, makeEvent, inferYear, absoluteUrl, textOf, decodeEntities, slug } from './shared.js'
import { mystageEvents, mystageTicketing } from './mystage.js'

const BASE = 'https://teatrulmetropolis.ro/'
const ROW_MARKER = '<span class="cal-date">'
// The longest real row in the initial sample ran well under 1500 chars
// (title, description, hall/time, ticket anchor, poster); bounded well
// above that so one row's own fields are never mistaken for the next row's.
const ROW_WINDOW = 2000

const DATE = /^<span class="cal-date">([^<]*)<\/span>/
const TITLE = /<div class="cboxtitle">\s*<a href="([^"]*)">([^<]*)<\/a>/
const DESC = /<span class="shrt">([^<]*)<\/span>/
const HALL = /<span class="show-sala">([^<]*)<\/span>/
const TIME = /<span class="show-ora">([^<]*)<\/span>/
const REVAL = /<span class="show-reval">\s*(?:<a href="([^"]*)"[^>]*>([^<]*)<\/a>)?\s*<\/span>/
const IMG = /<img class="img-fluid" src="([^"]*)">/
// On a production's OWN page, in the same `show-*` class family as the
// programme rows: `<span class="show-pret">Preț bilet: 59,40 lei</span>`.
const DETAIL_PRICE = /<span class="show-pret">([^<]*)<\/span>/

// One detail page per distinct production, and the programme lists ~16 of
// them; capped so a future programme (or a markup change that starts
// matching the wrong links) can't turn one venue into a hundred requests.
const MAX_DETAILS = 24

/** A price out of the theatre's own wording, which is not consistent with
 *  itself: "84,24 lei", "69,12" with no unit at all, and "49.68 lei" with a
 *  DOT all appear across the fourteen pages live today. Comma and dot both
 *  read as the decimal separator, the unit is optional, and a zero or an
 *  unparseable string is null rather than a free show. */
export function parseDetailPrice(text) {
  const m = /(\d+(?:[.,]\d{1,2})?)/.exec(String(text ?? ''))
  if (!m) return null
  const value = Number(m[1].replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? value : null
}

/** Every showing row on the programme page, as its own bounded slice —
 *  bounded by the NEXT row's marker when there is one, or `ROW_WINDOW` for
 *  the last row on the page. */
function rows(html) {
  const starts = []
  let idx = html.indexOf(ROW_MARKER)
  while (idx !== -1) {
    starts.push(idx)
    idx = html.indexOf(ROW_MARKER, idx + 1)
  }
  return starts.map((start, i) => {
    const next = starts[i + 1]
    const end = next !== undefined ? Math.min(next, start + ROW_WINDOW) : start + ROW_WINDOW
    return html.slice(start, end)
  })
}

// "8.09" / "30.09" — day.month, both numeric, never a year.
const DAY_MONTH = /^(\d{1,2})\.(\d{1,2})$/

export default {
  id: 'metropolis',
  label: 'Teatrul Metropolis',
  rung: 'selector',
  // A live sample carried 18 upcoming showings; set well below that.
  minItems: 4,

  /** The programme, plus the mystage venue page when one is configured.
   *  `optional` because an enrichment source must never be able to take its
   *  venue down: mystage having a bad afternoon would otherwise report
   *  Metropolis as unreachable while its own programme sat there, readable. */
  requests: (venue) => {
    const pages = [{ url: venue.url }]
    if (venue.config) pages.push({ url: venue.config, optional: true })
    return pages
  },

  /** One hop per distinct production hosted on the theatre's own site, for
   *  the price its programme row doesn't carry. Co-productions whose link
   *  points off-domain (Teatrul Stela Popescu's two) are deliberately not
   *  followed — another theatre's site is not this reader's to parse, and
   *  those are exactly the ones the mystage secondary covers instead. */
  follow(pages, { venue } = {}) {
    const html = pages[0]?.body ?? ''
    const urls = new Set()
    for (const row of rows(html)) {
      const href = TITLE.exec(row)?.[1]
      const url = href ? absoluteUrl(href, BASE) : null
      if (url && url.startsWith(BASE) && url !== venue?.url) urls.add(url)
    }
    return [...urls].slice(0, MAX_DETAILS).map((url) => ({ url }))
  },

  parse(pages, { venue, now = new Date() } = {}) {
    const html = pages[0]?.body ?? ''

    // Identified by URL, not position: the mystage page is always requested
    // second, but WHERE it lands depends on how many detail pages follow()
    // also fetched.
    const secondary = venue?.config ? pages.find((p) => p.url === venue.config) : null
    // Every showing mystage actually sells, by `title:date` — the same
    // identity the programme rows are keyed on, so a match is a match on the
    // thing itself rather than on a URL either side happens to use.
    const sold = new Map()
    for (const event of mystageEvents(secondary?.body ?? '')) {
      const date = typeof event.date === 'string' ? event.date.slice(0, 10) : null
      if (!date || !event.title) continue
      sold.set(`${slug(event.title)}:${date}`, mystageTicketing(event))
    }

    // Price per production, keyed by the same absolute URL the rows' own
    // links are built from, so the two line up as plain string equality.
    const detailPrices = new Map()
    for (const page of pages) {
      if (page === pages[0] || page === secondary) continue
      const price = parseDetailPrice(DETAIL_PRICE.exec(page.body ?? '')?.[1])
      if (price != null && page.url) detailPrices.set(page.url, price)
    }

    const events = []
    for (const row of rows(html)) {
      const dateText = DATE.exec(row)?.[1]
      const dm = dateText ? DAY_MONTH.exec(dateText.trim()) : null
      if (!dm) continue
      const date = inferYear(dm[1], Number(dm[2]), now)
      if (!date) continue

      const titleMatch = TITLE.exec(row)
      const link = titleMatch ? absoluteUrl(titleMatch[1], BASE) : null
      const title = titleMatch ? titleMatch[2] : null
      const description = DESC.exec(row)?.[1]
      const hall = HALL.exec(row)?.[1]
      const time = TIME.exec(row)?.[1]
      const image = IMG.exec(row)?.[1]

      const revalMatch = REVAL.exec(row)
      const ticketHref = revalMatch?.[1]
      const ticketLabel = revalMatch?.[2] ?? ''
      const ticketsUrl = ticketHref ? absoluteUrl(ticketHref, BASE) : null
      const ticketState = !ticketHref
        ? TICKET.NONE
        : /sold\s*out|epuizat/i.test(ticketLabel) ? TICKET.SOLD_OUT : TICKET.OPEN

      // The two enrichment sources are complementary rather than competing,
      // and that is not a coincidence: the theatre's own detail page prices
      // the fourteen productions it hosts, and mystage sells exactly the two
      // co-productions whose links point off-domain, which is why those have
      // no detail page here to read. Between them, every showing gets a price.
      const fromMystage = title ? sold.get(`${slug(title)}:${date}`) : null
      const price = (link ? detailPrices.get(link) : null) ?? fromMystage?.price ?? null

      events.push(makeEvent({
        venue: venue.name,
        title,
        date,
        time: time ? textOf(time) : null,
        hall,
        link,
        image: image ? decodeEntities(image) : null,
        // The programme's own ticket state stays authoritative, and mystage
        // only ever speaks where the row said nothing at all.
        //
        // Letting it OVERRIDE was the tempting reading of "get availability
        // from mystage", and is deliberately not done: mystage sells these
        // two nights, but nothing here establishes that its allocation is
        // the whole house, so zero seats there does not prove a sell-out.
        // The two errors are not symmetrical — a wrong "sold out" greys the
        // card's Keep button and quietly removes a show you could still have
        // seen, while a wrong "tickets" costs one click to discover. Given a
        // choice of which way to be wrong, be wrong in the recoverable
        // direction.
        ticketState: ticketState === TICKET.NONE && fromMystage ? fromMystage.ticketState : ticketState,
        ticketsUrl,
        description,
        price,
      }))
    }
    return events.filter(Boolean)
  },
}
