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

import { TICKET, makeEvent, inferYear, absoluteUrl, textOf, decodeEntities } from './shared.js'

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

  requests: (venue) => [{ url: venue.url }],

  parse(pages, { venue, now = new Date() } = {}) {
    const html = pages[0]?.body ?? ''
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

      events.push(makeEvent({
        venue: venue.name,
        title,
        date,
        time: time ? textOf(time) : null,
        hall,
        link,
        image: image ? decodeEntities(image) : null,
        ticketState,
        ticketsUrl,
        description,
      }))
    }
    return events.filter(Boolean)
  },
}
