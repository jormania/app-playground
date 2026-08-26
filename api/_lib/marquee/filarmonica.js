// Filarmonica George Enescu — the best source of the seven, reached the least
// obvious way.
//
// Rung 2 (feed). The listing page at /ro/evenimente CANNOT be parsed: it is a
// Next.js App Router page that emits `BAILOUT_TO_CLIENT_SIDE_RENDERING`, so the
// HTML a server fetch receives contains no events at all — only the shell. The
// events arrive in the browser from the site's own Strapi CMS, and that API is
// public. This adapter talks to it directly.
//
// What the feed gives, per event: heading, startDateAndTime / endDateAndTime,
// venue, room, ticketUrl, categories, media — and `buyLabel` ("Cumpără bilete" /
// "Sold Out") plus `disableBuy`, which together are an unusually honest ticket
// signal. Nothing is scraped or guessed.
//
// **403 means throttled, not broken.** A short burst of requests to this host
// starts refusing, from an origin that answered seconds earlier. One request per
// scan is well inside the limit, but the endpoint must never read a 403 here as a
// dead parser (MARQUEE.md §6) or a quiet rate limit would look like a site change.

import { TICKET, makeEvent, parseTime } from './shared.js'

const API = 'https://fgestrapi.filarmonicaenescu.ro/api/events'

/** Events whose END is today or later, soonest first. Params are pre-encoded:
 *  Strapi's bracket syntax has to survive the query string intact. */
function feedUrl(from, pageSize) {
  const since = `${from} 00:00:00`
  return `${API}?filters%5B%24and%5D%5B0%5D%5BendDateAndTime%5D%5B%24gte%5D=${encodeURIComponent(since)}`
    + '&populate%5B0%5D=media'
    + '&sort%5B0%5D=startDateAndTime%3Aasc'
    + '&locale=ro'
    + `&pagination%5Bpage%5D=1&pagination%5BpageSize%5D=${pageSize}`
}

/** The stored datetime is UTC-stamped; the app cares about Bucharest wall time,
 *  which is what the venue printed on the ticket. */
function localParts(value, timeZone = 'Europe/Bucharest') {
  if (!value) return { date: null, time: null }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return { date: null, time: null }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d).reduce((acc, p) => (acc[p.type] = p.value, acc), {})
  const hour = parts.hour === '24' ? '00' : parts.hour
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: parseTime(`${hour}:${parts.minute}`) }
}

export default {
  id: 'filarmonica',
  label: 'Filarmonica George Enescu',
  rung: 'feed',
  // 87 upcoming events when this was written; a season always has plenty. A feed
  // returning fewer than five is a feed that has changed shape.
  minItems: 5,
  // A 403 from this host is its rate limiter, not a broken parser.
  throttleStatuses: [403, 429],

  requests: (venue, { now = new Date(), pageSize = 100 } = {}) => {
    void venue
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(now)
    return [{ url: feedUrl(today, pageSize), json: true }]
  },

  parse(pages, { venue } = {}) {
    const rows = pages.flatMap((p) => (p.json?.data ?? []))
    return rows.map((row) => {
      const a = row?.attributes ?? {}
      const when = localParts(a.startDateAndTime)
      // The feed's own button state leads. `ticketUrl` is NOT a reliable proxy:
      // rows labelled "Cumpără bilete" routinely carry no ticketUrl (the buy flow
      // starts on the event page), so trusting the URL alone reports a concert
      // with tickets on sale as having none.
      const label = String(a.buyLabel ?? '')
      const soldOut = a.disableBuy === true || /sold\s*out|epuizat/i.test(label)
      const onSale = /bilete|cump|buy|tickets/i.test(label) || Boolean(a.ticketUrl)
      return makeEvent({
        // The feed names the actual hall (Ateneul Român, Sala Radio…), which can
        // differ from the institution. The venue row stays the identity — that is
        // what the user added and what a save is attributed to — and the feed's
        // own venue+room become the hall line.
        venue: venue.name,
        title: a.heading,
        date: when.date,
        time: when.time,
        hall: [a.venue, a.room].filter(Boolean).join(' · ') || null,
        link: a.slug ? `https://www.filarmonicaenescu.ro/ro/eveniment/${a.slug}` : null,
        ticketState: soldOut ? TICKET.SOLD_OUT : onSale ? TICKET.OPEN : TICKET.NONE,
        ticketsUrl: a.ticketUrl ?? null,
        image: a.media?.data?.attributes?.url ?? null,
      })
    }).filter(Boolean)
  },
}
