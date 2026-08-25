// The Discover → evaluate → save → do handoff.
//
// Radar-B has NO save store of its own — no favourites, no stars, no local
// bookmarks. An event you decide to keep becomes a Wanderlist `Findings` row and
// lives there from then on.
//
// Crucially, this module does NOT know the Findings schema. It converts a Radar-B
// event into WANDERLIST'S OWN app-model entry shape, and the shared schema module
// (src/shared/findings.js, promoted out of src/wanderlist/notion.js) turns that
// into Notion properties. So there is exactly one definition of what a Findings
// row looks like, used by both apps — a saved-from-Radar-B row and a saved-in-
// Wanderlist row are byte-identical by construction, not by careful copying.

import { toFindingsProps, FINDINGS_CATEGORIES, FINDINGS_TAGS } from '../shared/findings.js'
import { signalsFor } from './signals.js'
import { fold, titleSimilarity } from './dedupe.js'
import { spanOf, formatTime } from './dates.js'

export { FINDINGS_CATEGORIES, FINDINGS_TAGS }

/** Radar-B signals that map onto a Findings tag. Anything else is Radar-B-internal
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
 *  lesson (WANDERLIST.md, "Known quirks"), so Radar-B pays the address forward.
 *
 *  Venue and address OVERLAP far more often than they differ: a Radar row for a
 *  park carries `Parcul Tei` and `Parcul Tei, București`, and naively joining the
 *  two wrote `Parcul Tei, Parcul Tei, București` into Findings — which is what two
 *  live rows still said before this was fixed. A set of exact strings never caught
 *  it, because the two are not exactly equal; containment is the real test, and it
 *  is the same `sameplace` question the detail view asks before printing both. */
export function placeFor(event) {
  const bits = []
  for (const bit of [event.venue, event.address]) {
    if (!bit) continue
    const f = fold(bit)
    if (!f) continue
    // Keep the longer of any two that contain one another: the address usually
    // subsumes the venue, but a venue line carrying its own street subsumes a
    // bare address, and neither direction may be assumed.
    const clash = bits.findIndex((b) => {
      const fb = fold(b)
      if (fb === f || fb.includes(f) || f.includes(fb)) return true
      // Containment alone misses the abbreviation case — `Strada Aviator Radu
      // Beller (pietonală)` and `Str. Aviator Radu Beller, București` name one
      // street and share no substring, because `strada` and `str` differ. Token
      // overlap catches it; the floor is high enough that a venue and its
      // genuinely unrelated street (`Cinema Europa` / `Calea Moșilor 127`) score
      // zero and are both kept.
      return titleSimilarity(b, bit) >= 0.6
    })
    if (clash === -1) bits.push(bit)
    else if (fold(bits[clash]).length < f.length) bits[clash] = bit
  }
  if (!bits.length) return null
  const joined = bits.join(', ')
  return /bucure/i.test(joined) ? joined : `${joined}, București`
}

export function mapUrlFor(event) {
  const place = placeFor(event)
  return place ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}` : null
}

/** A saved event's home in the Wanderlist APP, as opposed to its Notion page.
 *
 *  The provenance list already links the raw Notion page (that's what the
 *  `saved` source is), so a second link to the same place earns nothing. This
 *  one opens the entry inside Wanderlist itself, where the photos, tickets and
 *  the edit affordances actually are. Wanderlist resolves the id against its own
 *  loaded list and falls back to Notion by itself if it can't find it, so this
 *  needs nothing but the id.
 *
 *  Dashes are stripped: Notion hands back a dashed uuid in `page.id` and a bare
 *  32-char id inside `page.url`, and the two must not produce different links to
 *  one entry. Wanderlist folds the same way when matching. */
export function appUrlFor(event) {
  const id = String(event.findingsId ?? '').replace(/-/g, '').trim()
  return /^[0-9a-f]{32}$/i.test(id) ? `/wanderlist-react.html#/entry/${id}` : null
}

/**
 * The editable draft shown before anything is written — Wanderlist's app-model
 * entry shape, field for field. Radar-B never writes silently: "never write on the
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
    description: withProvenance(event.summary || descriptionFallback(event), event),
    // The event's OWN page, or nothing. A roundup article is NOT a fallback:
    // `b365.ro/timp-liber/` is a page listing forty other things, and six months
    // later a Findings row pointing there answers no question you'd ask of it.
    // This used to fall through to `sources.find(s => s.url)`, which is how the
    // live Balkanik row got a B365 section page as its Link.
    //
    // The same judgement the detail view already makes — `goUrlFor` declines to
    // offer a source URL as an "event page" button — now applies to what gets
    // WRITTEN, so the two can't disagree. Finding the real URL is the
    // /recommend in Bucharest skill's enrichment step (it searches per event);
    // the app has no fetcher and does not scrape (RADAR_B.md §2), so a blank
    // here is the honest answer rather than a wrong one. Still editable in the
    // draft before anything is written.
    link: event.tickets || event.link || '',
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
    // Local wall clock, not a string slice — see `splitStart` in notion.js for
    // why the two differ whenever Notion hands the value back in UTC.
    plannedTime: event.hasTime && event.start ? formatTime(event.start) : null,
  }
}

/**
 * Append a one-line provenance footer to the description.
 *
 * The other half of the two-way street: Radar-B knows *which sources* vouched for
 * an event, and that context is exactly what's missing six months later when a
 * Findings row reads "some exhibition". Wanderlist has no `Sources` field of its
 * own, so it rides along in the description as one short line rather than being
 * dropped at the boundary.
 *
 * Recommendations are named separately from passing mentions, because "Curatorial
 * recommended this" and "B365 listed it" are different strengths of signal.
 */
export function withProvenance(description, event) {
  const recs = (event.sources ?? []).filter((s) => s.kind === 'recommendation').map((s) => s.name)
  const mentions = (event.sources ?? []).filter((s) => s.kind === 'editorial').map((s) => s.name)
  const bits = []
  if (recs.length) bits.push(`recomandat de ${[...new Set(recs)].join(', ')}`)
  if (mentions.length) bits.push(`menționat de ${[...new Set(mentions)].join(', ')}`)
  if (!bits.length) return description
  return `${description}\n\n📡 Via Radar-B — ${bits.join('; ')}.`
}

/** `Description` is treated as required, exactly as the wanderlist skill insists —
 *  a bare name with no context is far less useful at triage time. When the source
 *  genuinely gave nothing, write the shortest honest sentence and SAY it's thin,
 *  rather than leaving a blank that looks like an oversight.
 *
 *  Two things it must NOT do, both of which it used to and both of which reached
 *  the draft a human then approved into Notion:
 *    • repeat the venue when the name already carries it — `Lansare de carte la
 *      Cărturești Verona la Cărturești Verona.`
 *    • name the source, which `withProvenance` appends a line later anyway, so
 *      the sentence read `Semnalat via HotNews` above `menționat de HotNews`. */
function descriptionFallback(event) {
  const named = event.venue && fold(event.name).includes(fold(event.venue))
  const where = event.venue && !named ? ` la ${event.venue}` : ''
  return `${event.name}${where}. Sursă subțire — de verificat.`
}

/** The Notion create body. The properties come from the SHARED schema module —
 *  see this file's header for why that matters. */
export function toFindingsPage(draft, databaseId) {
  return { parent: { database_id: databaseId }, properties: toFindingsProps(draft) }
}
