// Editorial signals and the light ranking thumb on top of chronological order.
//
// The brief's constraint is the important part: signals exist to help a decision,
// not to decorate. A card shows at most TWO badges — the rest are deferred to the
// detail view — and a card with no badge at all is the normal case, not a failure.

import { isLongRun, isRunningNow, stalenessDays } from './dates.js'

/** Display order = priority order. The first two a card qualifies for are the two
 *  it shows, so this list is the entire "which badge matters more" policy. */
export const SIGNAL_ORDER = ['recommended', 'free', 'family', 'new-venue', 'outdoor', 'long-run', 'recurring', 'ticketed', 'sold-out']

export const SIGNAL_LABELS = {
  recommended: 'recomandat',
  free: 'gratuit',
  family: 'cu copii',
  outdoor: 'în aer liber',
  'new-venue': 'loc nou',
  recurring: 'recurent',
  'long-run': 'se vede oricând',
  ticketed: 'bilet',
  'sold-out': 'sold out',
}

const CARD_BADGE_LIMIT = 2

/** Signals an event carries, including ones DERIVED rather than stored — a
 *  months-long exhibition is `long-run` whether or not anyone tagged it. Takes no
 *  clock: every signal here is a property of the event itself, not of when you
 *  happen to be looking at it (that's `freshness` and `rank` below). */
export function signalsFor(event) {
  const set = new Set(event.signals ?? [])
  if (isLongRun(event)) set.add('long-run')
  if (event.cost === 0) set.add('free')
  if (event.tickets) set.add('ticketed')
  if (event.saved) set.delete('recommended') // already yours; the Wanderlist chip says more
  return SIGNAL_ORDER.filter((s) => set.has(s))
}

export function cardBadges(event) {
  return signalsFor(event).slice(0, CARD_BADGE_LIMIT)
}

/** Sources whose recommendation is worth naming on the event itself. */
export function recommenders(event) {
  return (event.sources ?? []).filter((s) => s.kind === 'recommendation').map((s) => s.name)
}

/** Freshness verdict — three states, because "unknown" must not render as "fresh".
 *  `stale` is 14 days: long enough that a weekly refresh hasn't touched it twice. */
export function freshness(event, now = new Date()) {
  const days = stalenessDays(event, now)
  if (days === null) return { state: 'unknown', days: null }
  if (days >= 14) return { state: 'stale', days }
  return { state: 'fresh', days }
}

/** Within a day, chronology rules — but with a thumb on the scale. A recommended
 *  event floats to the top of ITS OWN day; it never jumps days. That keeps the
 *  stream legible (you always know what day you're reading) while still letting
 *  editorial judgement be the first thing you see each morning.
 *  Lower sorts first. */
export function rank(event, now = new Date()) {
  const sigs = new Set(signalsFor(event))
  let score = 0
  if (!sigs.has('recommended')) score += 100
  if (event.confidence === 'uncertain') score += 40
  if (freshness(event, now).state === 'stale') score += 20
  if (isRunningNow(event, now)) score += 10 // an always-on exhibition yields to a one-night thing
  // Time of day, so an evening concert reads after an afternoon talk.
  if (event.hasTime && event.start) {
    const d = new Date(event.start)
    if (!Number.isNaN(d.getTime())) score += (d.getHours() * 60 + d.getMinutes()) / 10000
  } else {
    score += 0.2 // untimed events sit after timed ones within the same day
  }
  return score
}

export function sortForStream(events, now = new Date()) {
  return [...events].sort((a, b) => rank(a, now) - rank(b, now) || a.name.localeCompare(b.name, 'ro'))
}
