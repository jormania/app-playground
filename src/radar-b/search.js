// Filtering, searching and grouping the event pool into the stream the home
// screen renders. Pure — App.jsx passes state in and renders what comes back.

import { fold } from './dedupe.js'
import { lensesFor, isRunningNow, isPast, dayKey, spanOf, startOfDay } from './dates.js'
import { signalsFor, sortForStream } from './signals.js'
import { isIdea, isNonEvent } from './model.js'

export const VIEWS = ['tonight', 'tomorrow', 'weekend', 'week', 'later', 'running', 'new']

// Short on purpose. Seven lenses at their full Romanian names overflowed a phone
// width badly enough that the last one ("Noi pentru tine") was clipped mid-word
// even with the scroll affordance. These fit; the long form lives in the guide.
export const VIEW_LABELS = {
  tonight: 'Azi',
  tomorrow: 'Mâine',
  weekend: 'Weekend',
  week: 'Săptămâna',
  later: 'Mai încolo',
  running: 'În curs',
  new: 'Noi',
}

export function emptyFilters() {
  return { query: '', categories: [], areas: [], signals: [], maxCost: null }
}

/**
 * Intake rules — what is allowed into the pool at all, as opposed to `filters`,
 * which narrow what's already in it. Every one defaults ON, and each is a
 * Settings toggle rather than a hard exclusion, so nothing is silently
 * unreachable: turn one off and the events come back.
 *
 * These exist because Radar-B reads Wanderlist's Findings wholesale, and
 * Findings is a broader thing than "what's on in Bucharest this week" — it also
 * holds places, loose tips, and everything already done.
 */
export const DEFAULT_INTAKE = {
  hideAttended: true,   // already been — never a thing to go to
  hideIdeas: true,      // someday/maybe with no date at either end
  hideNonEvents: true,  // venue / idea / discovery: places and notions, not events
  hideDismissed: true,  // your own "not this one", synced via the Radar row
}

/** Does this event survive the intake rules? Returns the FIRST reason it didn't,
 *  so Settings can honestly report what a toggle is currently hiding. */
export function intakeRejection(event, intake = DEFAULT_INTAKE) {
  if (intake.hideAttended && event.attended) return 'attended'
  if (intake.hideDismissed && event.dismissed) return 'dismissed'
  if (intake.hideIdeas && isIdea(event)) return 'idea'
  if (intake.hideNonEvents && isNonEvent(event)) return 'nonEvent'
  return null
}

export function passesIntake(event, intake = DEFAULT_INTAKE) {
  return intakeRejection(event, intake) === null
}

export function hasActiveFilters(filters) {
  return Boolean(filters.categories.length || filters.areas.length || filters.signals.length || filters.maxCost !== null)
}

/** Everything a query can match. Source names are in here deliberately — "what did
 *  Curatorial say" is a real question, and it's the kind of thing only this app
 *  can answer, since the provenance never leaves it. */
export function haystack(event) {
  return fold([
    event.name,
    event.venue,
    event.area,
    event.address,
    event.organizer,
    event.summary,
    event.category,
    ...(event.signals ?? []),
    ...(event.sources ?? []).map((s) => s.name),
  ].filter(Boolean).join(' '))
}

export function matchesQuery(event, query) {
  const q = fold(query)
  if (!q) return true
  const hay = haystack(event)
  // Every term must appear — "jazz control" should mean both, not either.
  return q.split(' ').filter(Boolean).every((term) => hay.includes(term))
}

export function matchesFilters(event, filters) {
  if (!matchesQuery(event, filters.query)) return false
  if (filters.categories.length && !filters.categories.includes(event.category)) return false
  if (filters.areas.length && !filters.areas.includes(event.area)) return false
  if (filters.signals.length) {
    const sigs = new Set(signalsFor(event))
    if (!filters.signals.every((s) => sigs.has(s))) return false
  }
  if (filters.maxCost !== null) {
    const free = signalsFor(event).includes('free')
    if (!free && (event.cost === null || event.cost > filters.maxCost)) return false
  }
  return true
}

/** `new` = arrived in the most recent refresh and never opened. This is the only
 *  personalization in v1, and it is deliberately non-inferential: it reports a
 *  fact about what you have and haven't looked at, it does not model your taste. */
export function isNewToYou(event, seenIds, firstSeen, now = new Date()) {
  if (isPast(event, now)) return false
  if (seenIds.has(event.id)) return false
  const added = firstSeen?.[event.id]
  if (!added) return true
  return (Date.now() - added) / 86400000 <= 10
}

export function inView(event, view, now, ctx = {}) {
  if (view === 'running') return isRunningNow(event, now)
  if (view === 'new') return isNewToYou(event, ctx.seenIds ?? new Set(), ctx.firstSeen, now)
  return lensesFor(event, now).has(view)
}

/** The full home pipeline: dismissed out, view + filters applied, ranked, grouped
 *  by day. Long runs are pulled out of the day groups into their own section —
 *  an exhibition open for four months does not belong under "Saturday". */
export function buildStream(events, { view, filters, now = new Date(), intake = DEFAULT_INTAKE, dismissed = new Set(), seenIds = new Set(), firstSeen = {} } = {}) {
  const pool = events.filter((e) => passesIntake(e, intake) && !dismissed.has(e.id) && !isPast(e, now))
  const visible = pool.filter((e) => inView(e, view, now, { seenIds, firstSeen }) && matchesFilters(e, filters))

  const dated = []
  const standing = [] // running long-runs and undated things
  for (const event of visible) {
    if (view !== 'running' && (isRunningNow(event, now) || !spanOf(event))) standing.push(event)
    else dated.push(event)
  }

  const byDay = new Map()
  for (const event of dated) {
    const span = spanOf(event)
    // Group a multi-day event on the first of its days that is still ahead —
    // a festival that started yesterday belongs under today, not under its
    // opening night in the past.
    const anchor = span ? new Date(Math.max(span.from.getTime(), startOfDay(now).getTime())) : now
    const key = dayKey(anchor)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key).push(event)
  }

  const days = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, list]) => ({ key, events: sortForStream(list, now) }))

  return { days, standing: sortForStream(standing, now), total: visible.length }
}

/** Facets for the filter sheet, counted over what's actually in the pool — an
 *  option that would return nothing is never offered. */
export function facets(events, now = new Date(), intake = DEFAULT_INTAKE) {
  const count = (values) => {
    const map = new Map()
    for (const v of values) if (v) map.set(v, (map.get(v) ?? 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ro'))
  }
  const live = events.filter((e) => passesIntake(e, intake) && !isPast(e, now))
  return {
    categories: count(live.map((e) => e.category)),
    areas: count(live.map((e) => e.area)),
    signals: count(live.flatMap((e) => signalsFor(e))),
  }
}

/** A compact, paste-ready brief of what's on screen, for handing to
 *  /recommend in Bucharest. This is the app→skill direction of the loop: the
 *  question starts from the real current pool instead of a fresh round of search. */
export function toBrief(stream, view) {
  const lines = [`Evenimente în Radar-B — ${VIEW_LABELS[view] ?? view}:`, '']
  const all = [...stream.days.flatMap((d) => d.events), ...stream.standing]
  all.forEach((e, i) => {
    const bits = [e.venue, e.area].filter(Boolean).join(', ')
    lines.push(`${i + 1}. ${e.name}${bits ? ` — ${bits}` : ''}${e.link ? ` (${e.link})` : ''}`)
  })
  lines.push('', 'Care dintre ele mi s-ar potrivi?')
  return lines.join('\n')
}
