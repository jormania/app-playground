// The keep → Wanderlist handoff.
//
// Marquee has no save store of its own. A showing you decide to keep becomes a
// Wanderlist `Findings` row and lives there from then on — same rule as Radar-B,
// and for the same reason: two backlogs is one backlog too many.
//
// This module does NOT know the Findings schema. It builds Wanderlist's own app-
// model entry, and src/shared/findings.js turns that into Notion properties — so a
// row saved from Marquee and one typed into Wanderlist are identical by
// construction rather than by careful copying.

import { toFindingsProps, FINDINGS_CATEGORIES, FINDINGS_TAGS } from '../shared/findings.js'

export { FINDINGS_CATEGORIES, FINDINGS_TAGS }

function isoDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** `Place` must carry venue AND street AND city or Wanderlist can't drop a map
 *  pin — a documented, previously-paid-for lesson (WANDERLIST.md, "Known quirks").
 *  The venue row's Address exists precisely so Marquee can pay it forward, and the
 *  containment check is Radar-B's: a venue name and its address overlap far more
 *  often than they differ, and naive joining wrote "Parcul Tei, Parcul Tei,
 *  București" into live rows. */
export function placeFor(venue) {
  const name = String(venue?.name ?? '').trim()
  const address = String(venue?.address ?? '').trim()
  if (!address) return name
  const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
  if (!name || fold(address).includes(fold(name))) return address
  return `${name}, ${address}`
}

/** The map pin. Wanderlist's `Map` property is a Google Maps search URL built
 *  from the same Place string — the app has no geocoder of its own, so a row
 *  saved without this one has no pin at all until someone fills it in by hand.
 *  Same construction as Radar-B's, so rows from either app behave identically. */
export function mapUrlFor(venue) {
  const place = placeFor(venue)
  return place ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}` : null
}

/** A dated showing is the case where missing it means missing it permanently, so
 *  the date IS the deadline. Nothing is invented for an event without one. */
export function expiryFor(showing) {
  return showing?.date ?? null
}

/** Tags Marquee can state as fact. Ticket state is knowledge the venue published,
 *  and a concert hall's programme is music by definition; everything else — taste,
 *  company, whether it's worth the trip — is the user's to add in Wanderlist. */
export function tagsFor(showing, venue) {
  const tags = []
  if (showing?.ticketState === 'open' || showing?.ticketState === 'sold-out') tags.push('ticketed')
  if (showing?.price === 0) tags.push('free')
  if (venue?.category === 'concert') tags.push('music')
  return [...new Set(tags)].filter((t) => FINDINGS_TAGS.includes(t))
}

/**
 * The editable draft the save sheet opens with.
 *
 * Deliberately NOT marked `going` — Marquee never claims you've decided to attend
 * something. `plannedDate` is pre-filled from the showing because a dated event
 * you chose to keep is, in practice, a plan; you can clear it.
 */
export function toDraft(showing, { venue, production } = {}) {
  const category = venue?.category && FINDINGS_CATEGORIES.includes(venue.category) ? venue.category : 'event'
  return {
    name: showing.title,
    description: [
      production?.showings?.length > 1
        ? `${production.showings.length} dates listed at ${showing.venue}.`
        : null,
      showing.hall ? `Hall: ${showing.hall}.` : null,
      // Every source that publishes a price publishes the CHEAPEST one, so the
      // number in Cost is a floor, not the price of a seat worth having. Saying so
      // costs one clause and stops the row quietly overstating what it knows.
      showing.price > 0 ? `Cheapest published ticket ${showing.price} lei.` : null,
      showing.ticketState === 'sold-out' ? 'Listed as sold out when saved.' : null,
    ].filter(Boolean).join(' ') || null,
    link: showing.ticketsUrl || showing.link || null,
    category,
    place: placeFor(venue),
    placeUrl: mapUrlFor(venue),
    tags: tagsFor(showing, venue),
    attended: false,
    going: false,
    cost: showing.price ?? null,
    dateAdded: isoDay(),
    dateExpiring: expiryFor(showing),
    plannedDate: showing.date ?? null,
    plannedTime: showing.time ?? null,
  }
}

/** A Findings row, reduced to what the dedupe matcher needs.
 *
 *  `Place` is deliberately kept whole rather than split into venue and address:
 *  it is one string in Wanderlist by design, and the matcher does containment
 *  against it (see findings.js). */
export function fromFindingsRow(page) {
  const p = page?.properties ?? {}
  const plain = (prop) => {
    const parts = prop?.rich_text ?? prop?.title ?? []
    const text = parts.map((x) => x.plain_text ?? x.text?.content ?? '').join('').trim()
    return text || null
  }
  const start = p['Planned Date']?.date?.start ?? null
  return {
    id: page?.id ?? null,
    url: page?.url ?? null,
    name: plain(p.Name) ?? '',
    place: plain(p.Place),
    // A Planned Date can carry a time; the matcher compares days.
    plannedDate: start ? String(start).slice(0, 10) : null,
    dateExpiring: p['Date Expiring']?.date?.start ?? null,
    attended: p.Attended?.checkbox === true,
    going: p.Going?.checkbox === true,
  }
}

/** The Notion create-page payload for a draft. */
export function toFindingsPage(draft, findingsDatabaseId) {
  return {
    parent: { database_id: findingsDatabaseId },
    properties: toFindingsProps(draft),
  }
}
