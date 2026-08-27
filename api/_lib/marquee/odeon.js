// Teatrul Odeon — https://teatrul-odeon.ro/programul-teatrului-odeon-pe-zile/
//
// Started life as a plain alias of the generic `jsonld` reader, because the
// page does publish one complete schema.org Event per showing. That got the
// title, date, time, poster and link — and nothing else, because Odeon's
// JSON-LD carries no `offers` and no `location` at all. Every Odeon showing
// therefore read as "no tickets, no price, no hall", which is not what the
// page says.
//
// The missing half is in the surrounding HTML, one row per showing:
//
//   data-event_id="1018318"
//   … data-d="{&quot;loc.n&quot;:&quot;Sala Majestic, Preț bilete: 100 lei
//              Cat. I; 80 lei Cat. II; 50 lei Cat. III&quot;,…}"
//
// and the JSON-LD block for that same showing carries `"@id": "event_1018318_0"`.
// So the two halves join on a real id rather than on document order — the same
// rule §9.13 states for Excelsior's posters (key a second source by something
// self-identifying, never by which thing came back in which position). Fifteen
// ids, fifteen Events, checked against the live page.
//
// One request, same as before: both halves are already in the one response.

import { TICKET, decodeEntities, makeEvent, parseIsoDateTime, textOf } from './shared.js'

const SCRIPT = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
const ROWS = /data-event_id="(\d+)"/g
const LOC_PAYLOAD = /data-d="([^"]*)"/
const ID_IN_LD = /^event_(\d+)/

/** How far past a `data-event_id` its own `data-d` payload may sit. Bounded so
 *  a row that genuinely has none can't reach forward and claim the NEXT row's
 *  hall and prices — the same reason iabilet's tariff scan is length-capped. */
const ROW_WINDOW = 9000

/**
 * `"Sala Majestic, Preț bilete: 100 lei Cat. I; 80 lei Cat. II; 50 lei Cat. III"`
 * into a hall and a starting price.
 *
 * The CHEAPEST tier is the one reported, matching what every other reader here
 * does with a tiered price (Oveit's `minPrice`, iabilet's cheapest still-on-sale
 * tariff) — and matching how `toDraft` describes it in Wanderlist, as a floor
 * rather than the price of a seat worth having.
 */
export function parseLocationLine(text) {
  const clean = textOf(text)
  if (!clean) return { hall: null, price: null }
  const prices = [...clean.matchAll(/(\d+(?:[.,]\d+)?)\s*lei/gi)]
    .map((m) => Number(m[1].replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0)
  // The hall is whatever precedes the price list; a line that is only prices
  // yields no hall rather than a fragment of the price text.
  const head = clean.split(',')[0].trim()
  const hall = head && !/lei|pre[țt]/i.test(head) ? head : null
  return { hall, price: prices.length ? Math.min(...prices) : null }
}

/** event id → `{ hall, price }`, read off the listing's own rows. */
export function locationsById(html) {
  const out = new Map()
  const text = String(html ?? '')
  ROWS.lastIndex = 0
  let m
  while ((m = ROWS.exec(text)) !== null) {
    const id = m[1]
    if (out.has(id)) continue
    const payload = LOC_PAYLOAD.exec(text.slice(m.index, m.index + ROW_WINDOW))
    if (!payload) continue
    let parsed
    try {
      parsed = JSON.parse(decodeEntities(payload[1]))
    } catch {
      continue // one unreadable row must not cost the rest
    }
    out.set(id, parseLocationLine(parsed?.['loc.n']))
  }
  return out
}

export default {
  id: 'odeon',
  label: 'Teatrul Odeon',
  rung: 'jsonld',
  // A repertory theatre always has a fortnight or so up; 15 on the day this
  // was written. Six is "between seasons", not a broken reader.
  minItems: 6,

  requests: (venue) => [{ url: venue.url }],

  parse(pages, { venue } = {}) {
    const html = pages[0]?.body ?? ''
    const locations = locationsById(html)
    const events = []

    SCRIPT.lastIndex = 0
    let block
    while ((block = SCRIPT.exec(html)) !== null) {
      let node
      try {
        node = JSON.parse(block[1].trim())
      } catch {
        continue // Yoast's own graph block, and anything malformed
      }
      if (node?.['@type'] !== 'Event') continue

      const id = ID_IN_LD.exec(String(node['@id'] ?? ''))?.[1] ?? null
      const { hall, price } = (id && locations.get(id)) || { hall: null, price: null }
      const { date, time } = parseIsoDateTime(node.startDate)

      events.push(makeEvent({
        venue: venue.name,
        title: node.name,
        date,
        time,
        hall,
        link: node.url ?? null,
        image: typeof node.image === 'string' ? node.image : null,
        price,
        // Odeon publishes no availability flag anywhere — only a price list.
        // A published price IS the ticket information the page offers, so it
        // reads as on sale, exactly the call `oveit.js` makes for a feed with
        // prices and no sold-out flag. Never `sold-out`: nothing here could
        // tell us that, and inventing it would be the false precision the rest
        // of this app refuses.
        ticketState: price != null ? TICKET.OPEN : TICKET.NONE,
        description: typeof node.description === 'string' ? node.description : null,
      }))
    }
    return events.filter(Boolean)
  },
}
