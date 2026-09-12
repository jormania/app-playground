// Oveit — the ticketing platform, read as a venue source.
//
// Rung 2 (feed). An Oveit hub page (oveit.com/hub/org/<vendor>) is a 2.5KB
// JavaScript shell: no events, no JSON-LD, nothing a server fetch can read. The
// events come from the platform's own public API, which this adapter calls
// directly:
//
//   https://membership-api.oveit.com/v1/vendor/<vendor>/events?page=N
//
// It exists because Filarmonica George Enescu's own Strapi feed blocks
// non-browser clients, and Oveit is where the Filarmonica actually sells its
// tickets — so the same concerts are reachable here, from a host that does not
// refuse us. Any venue selling through Oveit can use it.
//
// What the feed gives per event: name, timeInterval (UTC, with the venue's own
// timezone alongside), location, cover image, currency and minmaxticketsprices.
//
// It does NOT give a sold-out flag. That is why this adapter never reports
// `sold-out`: an absent price means "no price published", not "gone", and
// inventing a sold-out state from silence would be exactly the false precision
// the rest of Marquee refuses.

import { TICKET, makeEvent, localParts, digest } from './shared.js'

const API = 'https://membership-api.oveit.com/v1/vendor'
const INCLUDE = 'type,timeInterval,dateTimeFormat,location,cover,currency,minmaxticketsprices'

// Eight events a page; a season runs to a few dozen. The cap bounds a runaway
// loop if `remainingEvents` ever stops counting down.
const MAX_PAGES = 8

/** The vendor id out of a hub URL: oveit.com/hub/org/<id>. */
export function vendorFromUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl))
    const m = /\/hub\/(?:org|vendor)\/([A-Za-z0-9_-]+)/.exec(url.pathname)
    return m ? m[1] : null
  } catch {
    return null
  }
}

function feedUrl(vendor, page) {
  return `${API}/${encodeURIComponent(vendor)}/events?page=${page}&include=${INCLUDE}`
}

function rowsOf(page) {
  const events = page?.json?.events
  if (Array.isArray(events)) return events
  return Array.isArray(events?.data) ? events.data : []
}

/** What this listing IS, when its name only says what KIND of thing it is.
 *
 *  Filarmonica heads four unrelated autumn concerts "Recital cameral" and two
 *  more "Stagiunea de marți seara" — programme categories, not names — so
 *  grouping by venue+title (programme.js's `productionId`) collapsed them into
 *  one card wearing the first one's poster and price (§9.70).
 *
 *  The poster is the discriminator, not the row id. Each Oveit row is one
 *  ticketed night, so keying on its id would split any vendor that sells a
 *  genuine multi-night run as one event per night — grouping those is the whole
 *  point of a production. Artwork tracks the programme instead: across
 *  Filarmonica's whole season no two concerts share a cover (each gets its own
 *  upload, right down to the `-2`/`-3` variants of a series template), while a
 *  run repeated across nights is one poster reused.
 *
 *  A coverless row returns null, which puts it back on title grouping — the
 *  behaviour every Oveit vendor had before this. Silence is not evidence that
 *  two nights are different concerts. */
function posterKey(row) {
  const cover = row?.cover?.original
  return cover ? digest(`${row?.name ?? ''}|${cover}`) : null
}

export default {
  id: 'oveit',
  label: 'Oveit',
  rung: 'feed',
  // A vendor with a live hub page has a season on it; one event back is a feed
  // that has changed shape or a vendor id that no longer resolves.
  minItems: 2,
  throttleStatuses: [403, 429],

  requests: (venue) => {
    const vendor = venue.config || vendorFromUrl(venue.url)
    return vendor ? [{ url: feedUrl(vendor, 1), json: true }] : []
  },

  /** Pagination is counted, not linked: the payload says how many events are
   *  still to come, so pages are requested until it reaches zero. */
  follow(pages, { venue }) {
    const vendor = venue.config || vendorFromUrl(venue.url)
    if (!vendor) return []
    const first = pages[0]?.json
    const perPage = rowsOf(pages[0]).length || 8
    const remaining = Number(first?.remainingEvents ?? 0)
    if (!Number.isFinite(remaining) || remaining <= 0) return []
    const extra = Math.min(Math.ceil(remaining / perPage), MAX_PAGES - 1)
    return Array.from({ length: extra }, (_, i) => ({ url: feedUrl(vendor, i + 2), json: true }))
  },

  parse(pages, { venue } = {}) {
    const out = []
    for (const page of pages) {
      for (const row of rowsOf(page)) {
        const zone = row?.dateTimeFormat?.timezone || 'Europe/Bucharest'
        const when = localParts(row?.timeInterval?.startsAt, zone)
        const price = Number(row?.minmaxticketsprices?.minPrice)
        out.push(makeEvent({
          venue: venue.name,
          title: row?.name,
          date: when.date,
          time: when.time,
          hall: row?.location ?? null,
          link: row?.id ? `https://oveit.com/hub/event/${row.id}` : null,
          // Only two honest states here: there is a price to pay, or the feed
          // said nothing. Never sold-out — see the header.
          ticketState: Number.isFinite(price) && price > 0 ? TICKET.OPEN : TICKET.NONE,
          ticketsUrl: row?.id ? `https://oveit.com/hub/event/${row.id}` : null,
          image: row?.cover?.original ?? null,
          price: Number.isFinite(price) && price > 0 ? price : null,
          productionKey: posterKey(row),
        }))
      }
    }
    return out.filter(Boolean)
  },
}
