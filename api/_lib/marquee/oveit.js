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
// It does NOT give a sold-out flag, and an absent price means "no price
// published", not "gone" — inventing a sold-out state from silence would be
// exactly the false precision the rest of Marquee refuses. So for a long time
// this adapter never reported `sold-out` at all.
//
// It can now, for a seated event, because it counts (§9.71). The seats live in
// a seats.io chart the buyer's own seat picker reads, and `enrich` reads the
// same three public endpoints (seatsio.js): the hall, what the event withheld
// from sale, and which seats are gone. `sold-out` here means every buyable seat
// in the hall is taken — measured, not inferred from silence — and a count that
// cannot be completed leaves the showing reading exactly as it did before.

import { TICKET, makeEvent, localParts, digest } from './shared.js'
import { decode, countFree, renderingInfoUrl, chartUrl, statusesUrl } from './seatsio.js'

const API = 'https://membership-api.oveit.com/v1/vendor'
// `seatingChart` and `tickets` ride along on the listing rather than costing a
// request each: the first names the seats.io event a concert's seats live in,
// the second which seat categories a buyer can actually choose. Both are
// needed before any seat can be counted, and asking for them here makes the
// whole seat-count chain two hops instead of three (§9.71).
const INCLUDE = 'type,timeInterval,dateTimeFormat,location,cover,currency,minmaxticketsprices,seatingChart,tickets'

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

// How far ahead a seat count is worth a pair of requests. "Last tickets" is a
// fact about a night you could still go to; for a concert next spring it is
// noise that costs the same two requests as the useful one. Filarmonica's own
// season sits almost entirely inside this.
const SEAT_HORIZON_DAYS = 60
// And a hard ceiling on the whole hop, the same reasoning (and the same number)
// as excelsior.js's: a site change must not be able to turn one venue into a
// hundred requests, because this runs inside Wanderlist's evening cron too.
const MAX_SEAT_LOOKUPS = 24

/** The seats.io coordinates of one listing row, when it has any. A
 *  general-admission Oveit event has no seating chart and simply never gets a
 *  count. */
function seating(row) {
  const workspaceKey = row?.seatingChart?.workspaceKey
  const eventKey = row?.seatingChart?.event
  return workspaceKey && eventKey ? { workspaceKey, eventKey } : null
}

/** The seats.io categories this event actually sells. A ticket type that is not
 *  public (an invitation, a protocol allocation) is not something a buyer can
 *  choose, so its seats are not capacity. */
function buyableCategories(row) {
  return new Set(
    (row?.tickets ?? [])
      .filter((t) => (t?.visibility ?? 'public') === 'public')
      .map((t) => t?.seatsCategoryKey)
      .filter(Boolean),
  )
}

/** Listing rows worth counting seats for, soonest first and capped. */
function seatCandidates(pages, now) {
  const horizon = new Date(now.getTime() + SEAT_HORIZON_DAYS * 86400000).toISOString()
  const out = []
  for (const page of pages) {
    for (const row of rowsOf(page)) {
      const starts = row?.timeInterval?.startsAt
      if (!starts || starts > horizon) continue
      if (!seating(row) || buyableCategories(row).size === 0) continue
      out.push(row)
      if (out.length >= MAX_SEAT_LOOKUPS) return out
    }
  }
  return out
}

/** Pages this hop already has, keyed the way `enrich` and `parse` both look
 *  them up. Keeps `enrich` from asking twice across rounds. */
function seatPages(pages) {
  const rendering = new Map()
  const statuses = new Map()
  const charts = new Map()
  for (const page of pages) {
    const tag = page?.tag
    if (tag?.kind === 'seats-rendering' && page.json) rendering.set(tag.eventKey, page.json)
    else if (tag?.kind === 'seats-status') statuses.set(tag.eventKey, decode(page.bytes))
    else if (tag?.kind === 'seats-chart') charts.set(`${tag.chartKey}@${tag.version}`, decode(page.bytes))
  }
  return { rendering, statuses, charts }
}

/** Seats still free for one listing row, or null when the chain didn't
 *  complete — a general-admission event, a lookup past the horizon or the cap,
 *  a request that failed, a chart whose labels didn't line up. Null is not a
 *  small number: every consumer treats it as "not counted". */
function seatCount(row, { rendering, statuses, charts }) {
  const coords = seating(row)
  if (!coords) return null
  const info = rendering.get(coords.eventKey)
  const taken = statuses.get(coords.eventKey)
  if (!info || !taken) return null
  const drawing = charts.get(`${info.chartKey}@${info.drawingVersion}`)
  if (!drawing) return null
  const forSale = info.forSaleConfigsPerEvent?.[coords.eventKey] ?? {}
  return countFree(drawing, taken, {
    categoryKeys: buyableCategories(row),
    forSale: forSale.forSale ?? null,
    forSaleObjects: forSale.objects ?? [],
  })
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

  /** Two rounds, because the second question can only be asked once the first
   *  has answered (§9.71). Round one asks, per concert, which chart it uses and
   *  which seats are gone; round two asks for the halls those answers named —
   *  one drawing per chart and version, so Ateneul Român's big hall is fetched
   *  once for a dozen concerts rather than a dozen times. A round returning
   *  nothing ends the hop.
   *
   *  Everything here is an enrichment in the strict sense: each request is
   *  fetched as optional, a page that fails is simply absent, and an event
   *  whose count cannot be worked out keeps the ticket state the feed gave it. */
  enrich(pages, { now = new Date() } = {}) {
    const have = seatPages(pages)
    const rows = seatCandidates(pages, now)
    const out = []

    for (const row of rows) {
      const { workspaceKey, eventKey } = seating(row)
      if (!have.rendering.has(eventKey)) {
        out.push({ url: renderingInfoUrl(workspaceKey, eventKey), json: true, tag: { kind: 'seats-rendering', eventKey } })
      }
      if (!have.statuses.has(eventKey)) {
        out.push({ url: statusesUrl(workspaceKey, eventKey), binary: true, tag: { kind: 'seats-status', eventKey } })
      }
    }
    if (out.length > 0) return out

    const wanted = new Map()
    for (const row of rows) {
      const { workspaceKey, eventKey } = seating(row)
      const info = have.rendering.get(eventKey)
      const chartKey = info?.chartKey
      const version = info?.drawingVersion
      if (!chartKey || version == null) continue
      const id = `${chartKey}@${version}`
      if (have.charts.has(id) || wanted.has(id)) continue
      wanted.set(id, { url: chartUrl(workspaceKey, chartKey, version), binary: true, tag: { kind: 'seats-chart', chartKey, version } })
    }
    return [...wanted.values()]
  },

  parse(pages, { venue } = {}) {
    const seats = seatPages(pages)
    const out = []
    for (const page of pages) {
      for (const row of rowsOf(page)) {
        const zone = row?.dateTimeFormat?.timezone || 'Europe/Bucharest'
        const when = localParts(row?.timeInterval?.startsAt, zone)
        const price = Number(row?.minmaxticketsprices?.minPrice)
        const counted = seatCount(row, seats)
        // With a real seat count, "sold out" is finally something this reader
        // can say honestly — every buyable seat in the hall is gone. Without
        // one it stays exactly as careful as it always was: a missing price
        // means no price published, never a sold-out house (see the header).
        const soldOut = counted != null && counted.free === 0
        out.push(makeEvent({
          venue: venue.name,
          title: row?.name,
          date: when.date,
          time: when.time,
          hall: row?.location ?? null,
          link: row?.id ? `https://oveit.com/hub/event/${row.id}` : null,
          // Only two honest states here: there is a price to pay, or the feed
          // said nothing. Never sold-out — see the header.
          ticketState: soldOut
            ? TICKET.SOLD_OUT
            : Number.isFinite(price) && price > 0 ? TICKET.OPEN : TICKET.NONE,
          ticketsUrl: row?.id ? `https://oveit.com/hub/event/${row.id}` : null,
          image: row?.cover?.original ?? null,
          price: Number.isFinite(price) && price > 0 ? price : null,
          productionKey: posterKey(row),
          // Only for a showing that is actually open — a sold-out one is already
          // fully described by its state, and `makeEvent` would drop a zero here
          // anyway. `null` when the chain didn't complete: unknown, not plenty.
          seatsLeft: soldOut ? null : counted?.free ?? null,
        }))
      }
    }
    return out.filter(Boolean)
  },
}
