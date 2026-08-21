// The Discover → evaluate → save → do handoff.
//
// Semnal has NO save store of its own — no favourites, no stars, no local
// bookmarks. An event you decide to keep becomes a Wanderlist `Findings` row and
// lives there from then on.
//
// Crucially, this module does NOT know the Findings schema. It converts a Semnal
// event into WANDERLIST'S OWN app-model entry shape, and the shared schema module
// (src/shared/findings.js, promoted out of src/wanderlist/notion.js) turns that
// into Notion properties. So there is exactly one definition of what a Findings
// row looks like, used by both apps — a saved-from-Semnal row and a saved-in-
// Wanderlist row are byte-identical by construction, not by careful copying.

import { toFindingsProps, FINDINGS_CATEGORIES, FINDINGS_TAGS } from '../shared/findings.js'
import { signalsFor } from './signals.js'
import { spanOf } from './dates.js'

export { FINDINGS_CATEGORIES, FINDINGS_TAGS }

/** Semnal signals that map onto a Findings tag. Anything else is Semnal-internal
 *  and is not smuggled into Wanderlist's small, deliberate tag vocabulary. */
const TAG_FROM_SIGNAL = {
  free: 'free',
  ticketed: 'ticketed',
  outdoor: 'outdoor',
  family: 'with-friends',
  'long-run': 'expo',
}

/** A one-off, date-fixed event is the case where missing it means missing it
 *  permanently — the wanderlist skill's own rule for `Date Expiring`. A long run
 *  expires on its closing date. A recurring or undated thing gets no deadline
 *  invented for it. */
export function expiryFor(event) {
  const span = spanOf(event)
  if (!span) return null
  if ((event.signals ?? []).includes('recurring')) return null // 🔁 — no single deadline applies
  return isoDay(span.to)
}

export function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** `Place` must carry venue AND street AND city — a bare venue name doesn't
 *  geocode to a map pin in Wanderlist. That's a documented, previously-paid-for
 *  lesson (WANDERLIST.md, "Known quirks"), so Semnal pays the address forward. */
export function placeFor(event) {
  const bits = [...new Set([event.venue, event.address].filter(Boolean))]
  if (!bits.length) return null
  const joined = bits.join(', ')
  return /bucure/i.test(joined) ? joined : `${joined}, București`
}

export function mapUrlFor(event) {
  const place = placeFor(event)
  return place ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}` : null
}

/**
 * The editable draft shown before anything is written — Wanderlist's app-model
 * entry shape, field for field. Semnal never writes silently: "never write on the
 * first pass, always show a draft" is the wanderlist skill's intake rule, kept
 * here because it is a good rule and not merely a skill convention.
 *
 * `attended` and `going` are always false on a new row, even when a date is known
 * — a known date is not a commitment (the skill's rule, verbatim).
 */
export function toDraft(event, now = new Date()) {
  const sigs = signalsFor(event)
  const span = spanOf(event)
  return {
    name: event.name,
    description: event.summary || descriptionFallback(event),
    // Prefer the event's OWN page over the article that mentioned it — same
    // preference order the skill applies at intake.
    link: event.tickets || event.link || event.sources.find((s) => s.url)?.url || '',
    category: FINDINGS_CATEGORIES.includes(event.category) ? event.category : 'event',
    place: placeFor(event) ?? '',
    placeUrl: mapUrlFor(event) ?? '',
    tags: [...new Set(sigs.map((s) => TAG_FROM_SIGNAL[s]).filter(Boolean))],
    attended: false,
    going: false,
    cost: sigs.includes('free') ? null : event.cost,
    dateAdded: isoDay(now),
    dateExpiring: expiryFor(event),
    plannedDate: span ? isoDay(span.from) : null,
    plannedTime: event.hasTime && event.start ? String(event.start).slice(11, 16) : null,
  }
}

/** `Description` is treated as required, exactly as the wanderlist skill insists —
 *  a bare name with no context is far less useful at triage time. When the source
 *  genuinely gave nothing, write the shortest honest sentence and SAY it's thin,
 *  rather than leaving a blank that looks like an oversight. */
function descriptionFallback(event) {
  const where = event.venue ? ` la ${event.venue}` : ''
  const via = event.sources[0]?.name
  return [`${event.name}${where}.`, via ? `Semnalat via ${via}.` : null, 'Sursă subțire — de verificat.']
    .filter(Boolean).join(' ')
}

/** The Notion create body. The properties come from the SHARED schema module —
 *  see this file's header for why that matters. */
export function toFindingsPage(draft, databaseId) {
  return { parent: { database_id: databaseId }, properties: toFindingsProps(draft) }
}
