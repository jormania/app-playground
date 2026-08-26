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

import { TICKET, makeEvent, parseTime, textOf } from './shared.js'

const SCRIPT = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

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

export default {
  id: 'jsonld',
  label: 'Generic schema.org',
  rung: 'jsonld',
  minItems: 1,

  requests: (venue) => [{ url: venue.url }],

  parse(pages, { venue } = {}) {
    const events = []
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
        for (const node of flatten(payload)) {
          if (!isEvent(node)) continue
          const start = String(node.startDate ?? '')
          const offer = firstOffer(node)
          const status = String(node.eventStatus ?? '')
          const availability = String(offer?.availability ?? '')
          const price = Number(offer?.price)
          events.push(makeEvent({
            venue: venue.name,
            title: typeof node.name === 'string' ? node.name : textOf(node.name),
            date: /^\d{4}-\d{2}-\d{2}/.exec(start)?.[0] ?? null,
            time: start.includes('T') ? parseTime(start.slice(11, 16)) : null,
            hall: typeof node.location?.name === 'string' ? node.location.name : null,
            link: node.url ?? null,
            ticketState: /SoldOut/i.test(availability) || /Cancelled/i.test(status)
              ? TICKET.SOLD_OUT
              : offer?.url || offer?.price != null ? TICKET.OPEN : TICKET.NONE,
            ticketsUrl: offer?.url ?? null,
            image: typeof node.image === 'string' ? node.image : (Array.isArray(node.image) ? node.image[0] : null),
            price: Number.isFinite(price) ? price : null,
            description: typeof node.description === 'string' ? node.description : null,
          }))
        }
      }
    }
    return events.filter(Boolean)
  },
}
