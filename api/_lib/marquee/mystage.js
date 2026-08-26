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
      const link = e.eventId ? `https://www.mystage.ro/spectacole/${slug(e.title)}-${e.eventId}` : null

      return makeEvent({
        venue: venue.name,
        title: e.title,
        date,
        time: parseTime(e.time),
        hall,
        link,
        image: e.images?.[0] ?? null,
        // mystage computes this itself — nothing here has to infer sold-out
        // from seating counts.
        ticketState: e.isAvailable === false ? TICKET.SOLD_OUT : e.isAvailable === true ? TICKET.OPEN : TICKET.NONE,
        price: Number.isFinite(price) && price > 0 ? price : null,
        // Already plain prose in the JSON — no extraction needed, unlike
        // every HTML-based reader here.
        description: e.description ?? null,
      })
    }).filter(Boolean)
  },
}
