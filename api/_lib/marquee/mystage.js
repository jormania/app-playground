// mystage.ro venue pages — Teatrul Unteatru today, any future mystage.ro venue
// the same way (one adapter per SITE, same rule as eventbook/iabilet).
//
// A new rung, not in MARQUEE.md's original three: every mystage venue page is
// server-rendered Next.js (`getServerSideProps`, not the client-only bailout
// Filarmonica's Next app hits — see MARQUEE.md §3) that embeds the FULL event
// model as JSON inside `<script id="__NEXT_DATA__">`. Not schema.org, but the
// same idea and, here, richer: title, date, time, hall, ticket availability
// AND a poster all arrive in that one blob — no HTML table-walking, no
// follow() hop for a poster the way Excelsior and TNB need.
//
// The one honest gap: mystage's own event-id list can be longer than what's
// hydrated inline (13 ids vs 10 events, observed on Unteatru's page
// 2026-08-26) — a handful of further-out occurrences load only through
// mystage's own private API once a visitor scrolls, which this adapter does
// not reverse-engineer. Those dates surface on a LATER scan once mystage
// itself renders them inline, the same self-healing way a horizon edge always
// works here — not a permanent blind spot, just a slight lag on the ones
// furthest out.
//
// mystage's real page slugs aren't in this JSON (only the numeric event id
// is) — but the site's own routing only keys on the trailing id, any slug
// text before it is decorative (`/spectacole/x-3385` resolves exactly like
// `/spectacole/masacrul-3385`), so a slug built from the title here is a real,
// working link even though it may not byte-match mystage's own generator.

import { TICKET, makeEvent, parseTime, slug } from './shared.js'

const NEXT_DATA = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/

/** The raw event list embedded in a mystage venue page, or `[]` for anything
 *  that isn't one. Exported because mystage is now read in two different
 *  roles: as a venue's own programme (this adapter), and as a SECONDARY
 *  ticketing source joined onto a venue read elsewhere (metropolis.js, §9.62).
 *  One reader, so the two can never drift apart on what a mystage page says. */
export function mystageEvents(html) {
  const match = NEXT_DATA.exec(html ?? '')
  if (!match) return []
  let data
  try {
    data = JSON.parse(match[1])
  } catch {
    return []
  }
  const events = data?.props?.pageProps?.initialEvents
  return Array.isArray(events) ? events : []
}

/**
 * Tickets and price for one mystage event — the §9.47 rule, in one place.
 *
 * `isAvailable` looked like the obvious signal, but it reads `true` on every
 * event on a venue page checked live (2026-08-27) — including three with zero
 * seats in every category and a placeholder `price.min.value: 0`, one of them
 * "MASS" showing a TICKETS chip in the app with none actually on sale. It is
 * not a per-event flag worth trusting; the seating map is. Summed availability
 * across every category tells the truth mystage's own page acts on (it is what
 * renders "Momentan nu sunt bilete disponibile" there), and a real price
 * alongside zero seats is what actually being sold out looks like, as opposed
 * to not being on sale yet.
 */
export function mystageTicketing(event) {
  const price = Number(event?.price?.min?.value)
  const hasPrice = Number.isFinite(price) && price > 0
  const seatsAvailable = Object.values(event?.seating ?? {})
    .reduce((sum, cat) => sum + (Number(cat?.available) || 0), 0)
  return {
    price: hasPrice ? price : null,
    seatsAvailable,
    ticketState: seatsAvailable > 0 ? TICKET.OPEN : hasPrice ? TICKET.SOLD_OUT : TICKET.NONE,
  }
}

/** mystage's real page slugs aren't in this JSON (only the numeric event id
 *  is) — but the site's own routing keys on the trailing id alone, any slug
 *  text before it being decorative (`/spectacole/x-3385` resolves exactly like
 *  `/spectacole/masacrul-3385`), so a slug built from the title here is a
 *  real, working link even though it may not byte-match mystage's own. */
export function mystageLink(event) {
  return event?.eventId ? `https://www.mystage.ro/spectacole/${slug(event.title)}-${event.eventId}` : null
}

export default {
  id: 'mystage',
  label: 'mystage.ro venue page',
  rung: 'embedded-json',
  // Unteatru itself runs only a handful of productions at once — a quiet
  // stretch is a real answer at a venue this size, not a broken reader.
  minItems: 1,

  requests: (venue) => [{ url: venue.url }],

  parse(pages, { venue } = {}) {
    const html = pages[0]?.body ?? ''
    const match = NEXT_DATA.exec(html)
    if (!match) return []

    let data
    try {
      data = JSON.parse(match[1])
    } catch {
      return []
    }

    const events = data?.props?.pageProps?.initialEvents
    if (!Array.isArray(events)) return []

    return events.map((e) => {
      const date = typeof e.date === 'string' ? e.date.slice(0, 10) : null
      const hall = e.venue?.hall && e.venue.hall !== '-' ? `Sala ${e.venue.hall}` : null
      const price = Number(e.price?.min?.value)
      const hasPrice = Number.isFinite(price) && price > 0
      const link = e.eventId ? `https://www.mystage.ro/spectacole/${slug(e.title)}-${e.eventId}` : null

      // `isAvailable` looked like the obvious signal, but it reads `true` on
      // every event on a venue page checked live (2026-08-27) — including
      // three with zero seats in every category and a placeholder
      // `price.min.value: 0`, one of them "MASS" showing a TICKETS chip in
      // the app with none actually on sale. It is not a per-event flag worth
      // trusting; the seating map is. Summed availability across every
      // category tells the truth mystage's own page acts on (it's what
      // renders "Momentan nu sunt bilete disponibile" there), and a real
      // price alongside zero seats is what actually being sold out looks
      // like, as opposed to not on sale yet.
      const seatsAvailable = Object.values(e.seating ?? {})
        .reduce((sum, cat) => sum + (Number(cat?.available) || 0), 0)

      return makeEvent({
        venue: venue.name,
        title: e.title,
        date,
        time: parseTime(e.time),
        hall,
        link,
        image: e.images?.[0] ?? null,
        ticketState: seatsAvailable > 0 ? TICKET.OPEN : hasPrice ? TICKET.SOLD_OUT : TICKET.NONE,
        price: hasPrice ? price : null,
        // Already plain prose in the JSON — no extraction needed, unlike
        // every HTML-based reader here.
        description: e.description ?? null,
      })
    }).filter(Boolean)
  },
}
