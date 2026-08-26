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

import { TICKET, makeEvent, inferYear, parseTime, pick, textOf, absoluteUrl } from './shared.js'

const ITEM = /<a\s+href="([^"]+)"\s+class="el-agenda-item"[^>]*>([\s\S]*?)<\/a>/g
const BASE = 'https://teatrul-excelsior.ro/'

export default {
  id: 'excelsior',
  label: 'Teatrul Excelsior',
  rung: 'selector',
  // 24 rows on a normal day. Four is "the theatre is between seasons", not
  // "the parser broke" — see MARQUEE.md §6.
  minItems: 4,

  /** One page, no pagination: Excelsior renders its whole programme at once. */
  requests: (venue) => [{ url: venue.url }],

  parse(pages, { venue, now = new Date() } = {}) {
    const html = pages.map((p) => p.body).join('\n')
    const events = []
    let m
    ITEM.lastIndex = 0
    while ((m = ITEM.exec(html)) !== null) {
      const [, href, body] = m
      const day = pick(body, /class="month">\s*(\d{1,2})\s/)
      const month = pick(body, /class="month">\s*\d{1,2}\s+([^<]+)</)
      const tickets = textOf((/el-column-tickets"[\s\S]*?(?=<\/div>\s*<\/div>|$)/.exec(body) ?? [''])[0])

      events.push(makeEvent({
        venue: venue.name,
        title: pick(body, /<h3[^>]*>([\s\S]*?)<\/h3>/),
        date: inferYear(day, month, now),
        time: parseTime(pick(body, /class="time">([^<]*)</)),
        hall: pick(body, /class="location">([^<]*)</),
        link: absoluteUrl(href, BASE),
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
