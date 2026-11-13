// What the band saw while you were out — steps, distance, floors, heart — read
// from Google Health when a walk ends (GOOGLE_HEALTH.md). Optional throughout:
// with no key, no data, or no answer within a few seconds, a walk is exactly what
// it always was, timed by how long the tab was closed.
//
// Three uses, all in this file so they can be tested without React:
//   · effectiveMinutes — the tier roll. Steps can only RAISE it, never lower it:
//     a long sit on a bench is still a walk outside, and this is a rite for going
//     out, not a fitness goal. ~100 steps is roughly a minute of walking, so only
//     a brisk or long walk moves the roll at all.
//   · walkPhrase — one sentence for the oracle, so the find carries the walk's shape.
//   · walkLine — the short line under the find and on its relic.
import { fetchWindow, hasHealthKey } from '../shared/googleHealth'

export const STEPS_PER_MINUTE = 100
const READ_TIMEOUT_MS = 3500

/** The band's numbers for a window, or null when there is nothing worth keeping. */
export function usableStats(w) {
  if (!w) return null
  const steps = typeof w.steps === 'number' && w.steps > 0 ? w.steps : null
  const heart = w.heart && typeof w.heart.avg === 'number' ? w.heart : null
  if (!steps && !heart) return null
  return {
    steps,
    distanceKm: typeof w.distanceKm === 'number' && w.distanceKm > 0 ? w.distanceKm : null,
    floors: typeof w.floors === 'number' && w.floors > 0 ? w.floors : null,
    heart,
  }
}

export function effectiveMinutes(durationMinutes, stats) {
  if (!stats || !stats.steps) return durationMinutes
  return Math.max(durationMinutes, stats.steps / STEPS_PER_MINUTE)
}

export function walkPhrase(stats) {
  if (!stats) return ''
  const bits = []
  if (stats.steps) bits.push(`took ${stats.steps.toLocaleString('en-GB')} steps`)
  if (stats.distanceKm) bits.push(`covered ${stats.distanceKm.toFixed(1)} km`)
  if (stats.floors) bits.push(`climbed ${stats.floors} ${stats.floors === 1 ? 'flight' : 'flights'} of stairs or hill`)
  if (stats.heart && stats.heart.max) bits.push(`their heart rose to ${stats.heart.max} beats a minute`)
  if (!bits.length) return ''
  const last = bits.pop()
  return ` On the way they ${bits.length ? `${bits.join(', ')} and ${last}` : last}.`
}

export function walkLine(stats) {
  if (!stats) return ''
  const bits = []
  if (stats.steps) bits.push(`${stats.steps.toLocaleString('en-GB')} steps`)
  if (stats.distanceKm) bits.push(`${stats.distanceKm.toFixed(1)} km`)
  if (stats.floors) bits.push(`${stats.floors} ↑`)
  if (stats.heart) bits.push(`♥ ${stats.heart.avg}${stats.heart.max ? `–${stats.heart.max}` : ''}`)
  return bits.join(' · ')
}

/**
 * Ask the band about [startMs, endMs]. Never throws: no key, no answer in time,
 * or an empty window all come back as null, and the walk goes on without it.
 */
export async function readWalk(startMs, endMs, timeoutMs = READ_TIMEOUT_MS) {
  if (!hasHealthKey() || !(endMs > startMs)) return null
  try {
    return usableStats(await fetchWindow(startMs, Math.min(endMs, startMs + 24 * 3600000), timeoutMs))
  } catch {
    return null
  }
}

// ── Late syncs ───────────────────────────────────────────────────────────────
// The band reaches Google only when the phone syncs, so a walk read the moment
// you return often comes back empty. Relics from the last day and a half that
// were never read (`stats === undefined`) or came back empty (`stats === null`)
// are asked again when the app opens; after BACKFILL_GIVE_UP_MS an empty one is
// left alone for good (`statsFinal`).
export const BACKFILL_WINDOW_MS = 36 * 3600000
export const BACKFILL_GIVE_UP_MS = 6 * 3600000

export function needsBackfill(walk, now = Date.now()) {
  if (!walk || walk.statsFinal || walk.stats) return false
  return now - walk.ts < BACKFILL_WINDOW_MS
}

/** The window a relic covers: it ended at `ts` and lasted `durationMinutes`. */
export function walkWindow(walk) {
  return [walk.ts - Math.round((walk.durationMinutes || 0) * 60000), walk.ts]
}

export function applyBackfill(walk, stats, now = Date.now()) {
  if (stats) return { ...walk, stats, statsFinal: true }
  return { ...walk, stats: null, statsFinal: now - walk.ts > BACKFILL_GIVE_UP_MS }
}
