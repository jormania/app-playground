// What's new since you last looked — Radar-B's diff, modeled directly on
// Marquee's src/marquee/changes.js (same shape: toSnapshot/diff/changeSignature/
// undismissedChanges). Marquee diffs ticket state across venue scans; Radar-B
// diffs the merged Radar+Wanderlist pool (App.jsx's `pool`, post-dedupe, already
// filtered to `radarId`-bearing events — see RADAR_B.md §22) across refreshes.
//
// v1 keeps no server state, same as Marquee: the client holds a snapshot of the
// last-seen pool in localStorage (store.js) and diffs the new one against it.
//
// Pure — no fetch, no storage, no React.

export const CHANGE = {
  NEW: 'new-event',
  RECOMMENDED: 'recommended',
  TICKETS_OPENED: 'tickets-opened',
  SOLD_OUT: 'sold-out',
  GONE: 'gone',
}

/** A snapshot is `{ scannedAt, events: { [id]: {name, venue, start, end, hasTime,
 *  signals, dismissed} } }` — small enough for localStorage on purpose, and
 *  shaped so a change entry can be handed straight to `formatWhen`. */
export function toSnapshot(pool, scannedAt) {
  const map = {}
  for (const e of pool ?? []) {
    map[e.id] = {
      name: e.name, venue: e.venue, start: e.start, end: e.end, hasTime: e.hasTime,
      signals: e.signals ?? [], dismissed: Boolean(e.dismissed),
    }
  }
  return { scannedAt: scannedAt ?? new Date().toISOString(), events: map }
}

/**
 * What changed between two refreshes of the pool.
 *
 * Two rules keep this honest, mirrored from Marquee's:
 *
 * 1. **A first-ever refresh produces no changes.** With no snapshot, every event
 *    in the pool is technically "new", and reporting the whole pool tells you
 *    nothing. The first refresh establishes the baseline silently; the second
 *    one starts being useful. `hadSnapshot: false` says so out loud.
 *
 * 2. **An event leaving the pool is only news if it hadn't already happened.**
 *    Past events drop out of the pool constantly as time moves on — that's
 *    normal, not a cancellation. And anything dismissed on purpose isn't "gone",
 *    it's hidden — the two must not be reported as the same thing.
 */
export function diff(previous, current, { now = new Date() } = {}) {
  const before = previous?.events ?? null
  const after = current?.events ?? {}
  if (!before) return { hadSnapshot: false, changes: [] }

  const changes = []
  const todayKey = now.toISOString().slice(0, 10)

  for (const [id, event] of Object.entries(after)) {
    const was = before[id]
    if (!was) {
      if (event.dismissed) continue // arrived already hidden — not news
      changes.push({ kind: CHANGE.NEW, key: id, ...event })
      continue
    }
    if (!was.signals.includes('recommended') && event.signals.includes('recommended')) {
      changes.push({ kind: CHANGE.RECOMMENDED, key: id, ...event })
    }
    if (!was.signals.includes('ticketed') && event.signals.includes('ticketed')) {
      changes.push({ kind: CHANGE.TICKETS_OPENED, key: id, ...event })
    }
    if (!was.signals.includes('sold-out') && event.signals.includes('sold-out')) {
      changes.push({ kind: CHANGE.SOLD_OUT, key: id, ...event })
    }
  }

  for (const [id, event] of Object.entries(before)) {
    if (after[id]) continue
    if (event.dismissed) continue // hidden on purpose, not gone
    if (event.start && String(event.start).slice(0, 10) < todayKey) continue // it simply happened
    changes.push({ kind: CHANGE.GONE, key: id, ...event })
  }

  return { hadSnapshot: true, changes: sortChanges(changes) }
}

/** Most useful first: a recommendation and a ticket opening are worth acting on
 *  today; a new listing is the background hum; something gone is worth knowing
 *  last, since there's nothing left to do about it. Within a kind, soonest
 *  event first. */
const ORDER = [CHANGE.RECOMMENDED, CHANGE.TICKETS_OPENED, CHANGE.NEW, CHANGE.SOLD_OUT, CHANGE.GONE]

export function sortChanges(changes) {
  return [...changes].sort((a, b) => {
    const byKind = ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)
    if (byKind) return byKind
    return String(a.start).localeCompare(String(b.start))
  })
}

/** The identity a dismissal is recorded and matched against. */
export function changeSignature(change) {
  return `${change.kind}:${change.key}`
}

/** `changes` with anything already dismissed filtered back out — persisted
 *  dismissal means a re-check that finds the exact same nothing new (or only
 *  things already dismissed) doesn't resurface them, while a genuinely new
 *  entry still gets through. */
export function undismissedChanges(changes, dismissedKeys = []) {
  const dismissed = new Set(dismissedKeys)
  return (changes ?? []).filter((c) => !dismissed.has(changeSignature(c)))
}
