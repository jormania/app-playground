// The generic schema.org reader — rung 1, and the only adapter that is not tied
// to one site.
//
// Any page that publishes `@type: Event` JSON-LD can be read with no site-specific
// code at all. Expirat Halele Carol (an iabilet.ro whitelabel) is the venue this
// was written against: it emits one complete Event block per listing, with name,
// startDate, image and an `offers` price in RON.
//
// It doubles as the fallback Settings offers for a venue with no built-in reader —
// which is why it has to be honest about finding nothing rather than inventing
// structure. A page with no Event objects parses to an empty list and the health
// gate in the endpoint turns that into a visible "needs an adapter", not silence.

import { TICKET, makeEvent, parseIsoDateTime, textOf } from './shared.js'

const SCRIPT = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
// iabilet whitelabel pages (Expirat, and any other venue riding the same
// template) publish `startDate` as a bare date, no time — the real start,
// "joi, 10 septembrie, ora 22:00", lives only in the visible card markup a
// short way after that event's own JSON-LD block, never in the JSON-LD
// itself. Every card observed on Expirat's listing keeps well under 2500
// characters between its own script tag and this text; bounded well past
// that so a slow week doesn't lose the fallback, capped short of the NEXT
// event's own block so a card with no time of its own can't borrow one.
const NEARBY_TIME = /ora\s+(\d{1,2}):(\d{2})/i
const TIME_WINDOW = 3000

/** Strip the CDATA wrapper iabilet emits around its JSON-LD. */
function unwrap(raw) {
  return String(raw)
    .replace(/^\s*\/\*\s*<!\[CDATA\[\s*\*\/\s*/, '')
    .replace(/\s*\/\*\s*\]\]>\s*\*\/\s*$/, '')
    .replace(/^\s*<!\[CDATA\[/, '')
    .replace(/\]\]>\s*$/, '')
    .trim()
}

/** Every object in a payload, flattened: a page may use one block per event, one
 *  array, or an @graph — all three appear in the wild. */
function flatten(node, out = []) {
  if (Array.isArray(node)) {
    for (const item of node) flatten(item, out)
  } else if (node && typeof node === 'object') {
    out.push(node)
    if (node['@graph']) flatten(node['@graph'], out)
    if (node.itemListElement) flatten(node.itemListElement, out)
    if (node.item) flatten(node.item, out)
  }
  return out
}

function isEvent(node) {
  const type = node?.['@type']
  const types = Array.isArray(type) ? type : [type]
  return types.some((t) => typeof t === 'string' && /event$/i.test(t))
}

function firstOffer(node) {
  const offers = Array.isArray(node?.offers) ? node.offers[0] : node?.offers
  return offers && typeof offers === 'object' ? offers : null
}


/**
 * Drop a festival's own umbrella listing when its individual days are already
 * listed beside it.
 *
 * Quantic's QFest publishes NINE schema.org Events for one festival: seven
 * "Ziua I..VII" days, a whole-festival "QFest" summary, and a season pass
 * ("Abonamente") — the last two both spanning 28 Sep to 4 Oct. The summary is
 * not a night you can go to, and it sorts to the top of the first day, ahead
 * of the day it duplicates.
 *
 * The rule is structural rather than by name: a MULTI-DAY event whose span
 * contains a single-day event at the same venue is an umbrella over listings
 * you already have. That keeps a multi-day event whose parts are NOT listed
 * separately — Quantic's own "iubim 2ROTI" runs 4-6 Sep with no per-day
 * entries, and dropping it would lose the only representation of it there is.
 * Only single-day rows count as evidence, so two umbrellas over the same span
 * can't cancel each other out and take the festival with them.
 *
 * The honest limit: a festival that publishes ONLY a summary and no days
 * still reads as one event, because from the page alone it is one.
 */
export function dropUmbrellaListings(rows) {
  const singleDays = rows.filter((r) => !r.endDate || r.endDate <= r.date)
  return rows.filter((r) => {
    const multiDay = r.endDate && r.endDate > r.date
    if (!multiDay) return true
    return !singleDays.some((d) => d.date >= r.date && d.date <= r.endDate)
  })
}

export default {
  id: 'jsonld',
  label: 'Generic schema.org',
  rung: 'jsonld',
  minItems: 1,

  requests: (venue) => [{ url: venue.url }],

  parse(pages, { venue } = {}) {
    // Collected with each event's own span alongside it — `makeEvent` keeps no
    // endDate, and dropUmbrellaListings needs one to spot a festival summary.
    const rows = []
    for (const page of pages) {
      const html = page.body ?? ''
      let m
      SCRIPT.lastIndex = 0
      while ((m = SCRIPT.exec(html)) !== null) {
        let payload
        try {
          payload = JSON.parse(unwrap(m[1]))
        } catch {
          continue // one malformed block must not cost the whole page
        }
        const nodes = flatten(payload).filter(isEvent)
        for (const node of nodes) {
          const start = String(node.startDate ?? '')
          const offer = firstOffer(node)
          const status = String(node.eventStatus ?? '')
          const availability = String(offer?.availability ?? '')
          // `Number(null)` and `Number('')` are both 0, and an offer carrying
          // either — a placeholder for "no price published", which is common —
          // would have rendered as a "Free" chip and tagged the Wanderlist row
          // `free`. Only an actual number, or a string that is one, counts.
          const rawPrice = offer?.price
          const price = typeof rawPrice === 'number' || (typeof rawPrice === 'string' && rawPrice.trim() !== '')
            ? Number(rawPrice)
            : NaN
          let { date, time } = parseIsoDateTime(start)
          // Only for a block with exactly one event — the nearby-text window
          // belongs to whichever card follows the block, and a block that
          // bundled several events (an @graph, an itemList) has no single
          // "the card right after this" to read a time off.
          if (!time && nodes.length === 1) {
            const windowStart = m.index + m[0].length
            const nextScript = html.indexOf('<script', windowStart)
            const windowEnd = Math.min(
              windowStart + TIME_WINDOW,
              nextScript === -1 ? html.length : nextScript,
            )
            const found = NEARBY_TIME.exec(html.slice(windowStart, windowEnd))
            if (found) time = `${found[1].padStart(2, '0')}:${found[2]}`
          }
          const event = makeEvent({
            venue: venue.name,
            title: typeof node.name === 'string' ? node.name : textOf(node.name),
            date,
            time,
            hall: typeof node.location?.name === 'string' ? node.location.name : null,
            link: node.url ?? null,
            ticketState: /SoldOut/i.test(availability) || /Cancelled/i.test(status)
              ? TICKET.SOLD_OUT
              : offer?.url || Number.isFinite(price) ? TICKET.OPEN : TICKET.NONE,
            ticketsUrl: offer?.url ?? null,
            image: typeof node.image === 'string' ? node.image : (Array.isArray(node.image) ? node.image[0] : null),
            price: Number.isFinite(price) ? price : null,
            description: typeof node.description === 'string' ? node.description : null,
          })
          if (event) rows.push({ event, date, endDate: parseIsoDateTime(node.endDate).date })
        }
      }
    }
    return dropUmbrellaListings(rows).map((r) => r.event)
  },
}
