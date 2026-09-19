// Sala Radio — https://salaradio.ro/evenimente/
//
// Rung 3 (selector), two hops. Home of the seven Radio România ensembles
// (Orchestra Națională Radio, Orchestra de Cameră Radio, the Academic and
// Children's choirs, Big Band Radio, the folk orchestra), all sharing one
// stage on Str. General Berthelot — so one Marquee venue row, no `hall`,
// the same way a single-room venue has always been read here.
//
// **Not read from where its tickets are sold**, for a reason worth stating
// precisely because it is the opposite of the usual one. Sala Radio sells
// through bilete.ro — which, unlike the bilet.ro that put CNDB behind a
// Queue-it waiting room, is perfectly readable: server-rendered tiles, a
// "de la 99,00 lei" floor price on every event page, clean markup. It was
// checked properly rather than assumed. The problem is that it has almost
// nothing on it: its `concerte/sala-radio/` category carried ONE event on
// 2026-09-19 (Traffic Strings, 22 November — not one of the nine the venue
// itself was advertising), and bilete.ro's own Orchestra Națională Radio
// page read "0 evenimente in viitorul apropiat" on the same day. The autumn
// season is announced on salaradio.ro weeks before it goes on sale. Reading
// the ticketing would mean showing an empty venue.
//
// WordPress + the Events Manager plugin. Two things follow from that:
//
//   - The plugin's REST API (`/wp-json/events-manager/v1/events`, and the
//     `/tickets` and `/availability` routes beside it, which would be exactly
//     the price and seat feed this app wants) is registered but answers 401.
//     It is not open, and there is no key to have; see MARQUEE.md §9.85.
//   - The listing row is spartan — poster, date, title, link, and a "Cumpără
//     bilete" button — while the production's own page carries the start time
//     and the full programme (conductor, soloists, works). Hence the second
//     hop, the same shape metropolis.js uses for its price.
//
// **Every row's ticket button is the SAME bilete.ro category URL.** Not a
// per-showing link with a per-showing state — one static href repeated nine
// times out of nine, present on concerts that provably were not on sale
// anywhere. So it proves nothing about this showing, it is not emitted as a
// `ticketsUrl`, and every showing reads `ticketState: none` — §9.7's answer
// to a source that says nothing, and the honest one here.

import { TICKET, makeEvent, parseTime, absoluteUrl, textOf, decodeEntities, proseParagraphs } from './shared.js'

const BASE = 'https://salaradio.ro/'
const ROW = /<div class="item border">([\s\S]*?)(?=<div class="item border">|<div class="pagination">|$)/g
// "14/10/2026" — day, month and a real four-digit year, so this reader never
// touches `inferYear` and cannot be caught by the December/January rollover.
const DATE = /<div class="data ?[^"]*">\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*<\/div>/
const TITLE = /<h3 class="ex-h1">\s*<a href="([^"]*)">([\s\S]*?)<\/a>/
const IMAGE = /<div class="foto[^"]*">[\s\S]*?<img[^>]+src="([^"]+)"/
// On the production's own page, in the Events Manager meta block.
const DETAIL_TIME = /class="[^"]*em-event-time[^"]*"[^>]*>([\s\S]*?)<\/div>/
const DETAIL_CONTENT = /<section class="em-event-content">([\s\S]*?)<\/section>/

// Nine concerts filled the forward window when this was written, and a busy
// month is a dozen. Capped an order above that: a markup change that starts
// matching the wrong anchors must not be able to turn one venue into a
// hundred requests — MARQUEE.md §9.75's lesson, learned on TNB.
const MAX_DETAIL_PAGES = 30

/**
 * A start time out of Events Manager's "7:00 pm - 8:45 pm".
 *
 * Twelve-hour and English, because the plugin's locale is en_US while every
 * other word on the page is Romanian — which is why `parseTime` alone is wrong
 * here rather than merely unhelpful: it would read "7:00 pm" as 07:00 and print
 * a morning concert. The am/pm form is tried first and only a string with no
 * marker at all falls through to `parseTime`, so a future theme that switches
 * the plugin to 24-hour output keeps working instead of silently halving every
 * evening.
 */
export function parseMeridiemTime(text) {
  const m = /\b(\d{1,2}):(\d{2})\s*([ap])\.?m\.?\b/i.exec(String(text ?? ''))
  if (!m) return parseTime(text)
  const minute = Number(m[2])
  let hour = Number(m[1])
  if (hour > 12 || minute > 59) return null
  if (m[3].toLowerCase() === 'p') hour = hour === 12 ? 12 : hour + 12
  else if (hour === 12) hour = 0
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** The two things a concert's own page is read for. One definition, so a
 *  freshly fetched page and any later account of it cannot disagree. */
function detailOf(body) {
  return {
    time: parseMeridiemTime(textOf(DETAIL_TIME.exec(body)?.[1])),
    description: proseParagraphs(DETAIL_CONTENT.exec(body)?.[1] ?? ''),
  }
}

export default {
  id: 'salaradio',
  label: 'Sala Radio',
  rung: 'selector',
  // Nine upcoming on a normal day, and the hall runs weekly through the
  // season. Three is "between stagiuni", not "the parser broke".
  minItems: 3,

  requests: (venue) => [{ url: venue.url }],

  /** One hop per concert, for its start time and programme.
   *
   *  Deliberately NOT cached: `detailCache.js`'s first condition is that the
   *  hop be per PRODUCTION rather than per showing, and a symphony concert is
   *  a one-night production — nine pages for nine showings, nothing shared, so
   *  a cache would store as many records as it saves requests. Nine is also
   *  not sixty; this is the load the rule was written to permit. */
  follow(pages, { venue } = {}) {
    const html = pages[0]?.body ?? ''
    const urls = new Set()
    let m
    ROW.lastIndex = 0
    while ((m = ROW.exec(html)) !== null) {
      const href = TITLE.exec(m[1])?.[1]
      const url = href ? absoluteUrl(href, BASE) : null
      if (url && url.startsWith(BASE) && url !== venue?.url) urls.add(url)
    }
    return [...urls].slice(0, MAX_DETAIL_PAGES).map((url) => ({ url }))
  },

  parse(pages, { venue } = {}) {
    // Keyed by the exact URL each page was fetched at, which is the same URL
    // the listing row links to — so the join is plain string equality, no
    // canonical-tag cross-referencing (excelsior.js) and no fetch-order
    // assumption (a failed detail fetch costs that concert its time and
    // programme, and nothing else).
    const detail = new Map()
    for (const page of pages.slice(1)) {
      if (page.url) detail.set(page.url, detailOf(page.body ?? ''))
    }

    const html = pages[0]?.body ?? ''
    const events = []
    let m
    ROW.lastIndex = 0
    while ((m = ROW.exec(html)) !== null) {
      const row = m[1]
      const d = DATE.exec(row)
      if (!d) continue
      const date = `${d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}`

      const titleMatch = TITLE.exec(row)
      if (!titleMatch) continue
      const link = absoluteUrl(titleMatch[1], BASE)
      const image = IMAGE.exec(row)?.[1]
      const found = link ? detail.get(link) : null

      events.push(makeEvent({
        venue: venue.name,
        title: titleMatch[2],
        date,
        time: found?.time ?? null,
        // One stage, named after the venue. `makeEvent` would drop a "Sala
        // Radio" hall as a repeat of the venue anyway; not setting it says
        // the same thing without relying on that.
        hall: null,
        link,
        image: image ? absoluteUrl(decodeEntities(image), BASE) : null,
        description: found?.description ?? null,
        // See the header: the row's ticket button is one static category link
        // repeated on every concert, so there is nothing per-showing to say.
        ticketState: TICKET.NONE,
        ticketsUrl: null,
        price: null,
      }))
    }
    return events.filter(Boolean)
  },
}
