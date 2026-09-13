// seats.io, read the way the buyer's own seat picker reads it.
//
// Oveit sells Filarmonica's concerts through a seats.io seating chart, and its
// own event feed carries no availability at all (oveit.js's header: that is why
// this app never claimed "sold out" for the venue). The seat picker on
// oveit.com does know — it draws every seat and greys the taken ones — and it
// learns that from three public, unauthenticated seats.io endpoints, the same
// three this module models:
//
//   rendering-info?event_key=E652        which chart, which drawing version,
//                                        the category list, what is on sale
//   charts/<chartKey>/published/<ver>    the hall itself: every seat, its
//                                        label and its category
//   events/object-statuses?event_key=…   the seats that are NOT free
//
// Free seats are the arithmetic: the hall, minus what the event withheld from
// sale, minus what has been taken. Nothing here is a guess.
//
// **The responses are byte-shifted, not encrypted.** seats.io serves them as
// `application/vnd.seatsio`: every byte of the JSON raised by one constant
// 0-63. The renderer subtracts it back (`deobfuscate`, chartRendererIframe.js).
// There is no key to hold and nothing is authenticated — the shift is recovered
// from the first byte, since the payload is always a JSON array or object. That
// is also why this reads the shift rather than hardcoding one: a change of
// constant costs nothing, where a hardcoded 29 would silently stop decoding.

/** The region host Oveit's own workspace lives in. The workspace belongs to
 *  Oveit, not to the venue, so every Oveit vendor resolves here — a EU-region
 *  host answers "no workspace with public key" for it, which is why this is a
 *  constant rather than something derived per venue. */
export const SEATSIO = 'https://cdn-na.seatsio.net/system/public'

export const renderingInfoUrl = (workspaceKey, eventKey) =>
  `${SEATSIO}/${workspaceKey}/rendering-info?event_key=${encodeURIComponent(eventKey)}`

export const chartUrl = (workspaceKey, chartKey, version) =>
  `${SEATSIO}/${workspaceKey}/charts/${chartKey}/published/${version}`

export const statusesUrl = (workspaceKey, eventKey) =>
  `${SEATSIO}/${workspaceKey}/events/object-statuses`
  + `?event_key=${encodeURIComponent(eventKey)}&validateEventsLinkedToSameChart=false`

/** Undo the byte shift and parse. The shift is whatever turns the first byte
 *  into `[` or `{`; anything that doesn't decode to JSON returns null rather
 *  than throwing, because every caller here treats a missing count as "we don't
 *  know", never as an error worth failing a venue over. */
export function decode(bytes) {
  if (!bytes || bytes.length === 0) return null
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  for (const open of [0x5b, 0x7b]) {
    const shift = (view[0] - open + 256) % 256
    if (shift > 63) continue
    const out = new Uint8Array(view.length)
    for (let i = 0; i < view.length; i++) out[i] = (view[i] - shift + 256) % 256
    try {
      return JSON.parse(new TextDecoder('utf-8').decode(out))
    } catch {
      // Wrong guess for this opening brace; try the other.
    }
  }
  return null
}

/** How seats.io names one seat: section, row and seat label joined by hyphens,
 *  with the blanks dropped. Ateneul Român's big hall labels no rows (they come
 *  through as `?`), so its seats are `Centru-43`; the small hall does, so its
 *  are `Sala mică-4-26`. The statuses feed gives only these labels, so getting
 *  this join wrong would silently match nothing — and a chart where nothing
 *  matches reads as a hall where nothing is taken, which is the one direction
 *  this must never be wrong in. `countFree` checks the join instead of trusting
 *  it. */
export function seatLabel(section, row, seat) {
  return [section, row, seat].filter((part) => part && part !== '?').join('-')
}

/** Every seat in a published drawing, as label → category key. */
export function seatsOf(drawing) {
  const seats = new Map()
  for (const row of drawing?.subChart?.rows ?? []) {
    for (const seat of row?.seats ?? []) {
      const label = seatLabel(row?.sectionLabel, row?.label, seat?.label)
      if (label) seats.set(label, seat?.categoryKey ?? null)
    }
  }
  return seats
}

/**
 * Seats on sale and seats still free, counted over the categories a buyer can
 * actually pick.
 *
 * `categoryKeys` is the set the event's own ticket types map to — the 29
 * September recital put only Categoria 2 and 3 on sale out of a 794-seat hall,
 * and counting the other 602 would have reported a sold-out concert as
 * two-thirds empty. Protocol seats (the house's own) never carry a ticket type
 * and drop out here for the same reason.
 *
 * Returns null unless the answer is trustworthy: the drawing has seats, at
 * least one category is buyable, and **every** label the statuses feed named
 * was found in the drawing. That last check is the important one — a chart
 * whose labels don't join the way `seatLabel` builds them would match no taken
 * seats and report a full house, so an unrecognised label voids the count
 * rather than inflating it.
 */
export function countFree(drawing, statuses, { categoryKeys, forSale = null, forSaleObjects = [] } = {}) {
  const seats = seatsOf(drawing)
  const wanted = categoryKeys instanceof Set ? categoryKeys : new Set(categoryKeys ?? [])
  if (seats.size === 0 || wanted.size === 0) return null

  const rows = Array.isArray(statuses) ? statuses : []
  const named = new Set(rows.map((row) => row?.objectLabelOrUuid).filter(Boolean))
  for (const label of named) if (!seats.has(label)) return null

  // The feed reports only what has moved, and reports it both ways: a seat that
  // was taken and released comes back with `status: 'free'`. Only the ones that
  // are actually gone count as taken — held-for-checkout included, since a held
  // seat is not one you can buy right now.
  const taken = new Set(rows.filter((row) => row?.status !== 'free').map((row) => row?.objectLabelOrUuid))

  // `forSale: false` with a list of objects is a blacklist (the 24 seats this
  // concert withheld); `forSale: true` with one is a whitelist. Either way an
  // empty list means the whole hall.
  const listed = new Set(forSaleObjects ?? [])
  const onSale = (label) => {
    if (listed.size === 0) return true
    if (forSale === false) return !listed.has(label)
    if (forSale === true) return listed.has(label)
    return true
  }

  let total = 0
  let free = 0
  for (const [label, category] of seats) {
    if (!wanted.has(category) || !onSale(label)) continue
    total++
    if (!taken.has(label)) free++
  }
  return total === 0 ? null : { total, free }
}
