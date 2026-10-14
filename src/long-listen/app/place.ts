import { readJson, writeJson } from '../../shared/storage'
import { playbackOf, type NowPlaying } from '../spotify/client'
import { workEnded } from '../spotify/workGuard'

/**
 * Where a recording stands on Spotify, if anywhere worth resuming from. A work
 * Spotify has finished is at rest, not paused: it stops on the last movement
 * (at its close, or rewound to its start), or — having played a list to its
 * end — goes back to the first and holds it at 0:00. Resume there would only
 * be Play from the top, so neither counts as a place: Play is offered, and
 * nothing is marked paused.
 */
export function positionOf(np: NowPlaying | null, trackIds: string[]): { index: number; playing: boolean } | null {
  const seen = playbackOf(np, trackIds)
  if (!seen || !np || np.isPlaying) return seen
  const atClose = np.durationMs > 0 && np.durationMs - np.progressMs < 4000
  const atStart = np.progressMs < 2000
  if (seen.index === trackIds.length - 1 && (atStart || atClose)) return null
  if (seen.index === 0 && atStart) return null
  return seen
}

/**
 * Where a listening was left, kept on this device per work: Spotify forgets it
 * once its app is closed, or after hours of something else, and then the work
 * could only be started again from the top. Kept from every reading of a work
 * the app knows (app/playback.ts), on whatever screen is open; let go when the
 * work comes to its end, when it is marked heard, or after a month.
 *
 * Keyed by the first track, and kept with every track id: a place saved for one
 * album's division of the work is no place in another's.
 */
export interface Place { index: number; progressMs: number; at: number; ids?: string }
const PLACE_KEY = (firstTrackId: string) => `long-listen:place:${firstTrackId}`
const PLACE_KEEP_MS = 30 * 86_400_000

export function savedPlace(trackIds: string[] | undefined, now = Date.now()): Place | null {
  if (!trackIds?.length) return null
  const p = readJson<Place | null>(PLACE_KEY(trackIds[0]), null)
  if (!p || typeof p.index !== 'number' || p.index < 0 || p.index >= trackIds.length || now - p.at > PLACE_KEEP_MS) return null
  if (p.ids !== undefined && p.ids !== trackIds.join()) return null
  // The very start is no place to resume from.
  return p.index === 0 && p.progressMs < 5000 ? null : p
}

/** Keep (or, with null, let go) where this work was left. */
export function keepPlace(trackIds: string[], place: Place | null): void {
  writeJson(PLACE_KEY(trackIds[0]), place && { ...place, ids: trackIds.join() })
}

/** Let go of a work's place if it was kept before `at` (ms): heard through since, it is over. */
export function forgetPlaceBefore(trackIds: string[], at: number): void {
  const p = savedPlace(trackIds, at)
  if (p && p.at <= at) keepPlace(trackIds, null)
}

/**
 * From one reading (and the one before it): the place to keep for this work,
 * null to let it go, or undefined when the reading says nothing about it.
 *
 * Let go when the work has just ended — its last movement near its close, then
 * Spotify stopped, rewound to the first movement, or ran on to something else
 * (spotify/workGuard.ts) — and when it is at rest at its very start or at the
 * close of its last movement. Kept as it was when the last movement is merely
 * paused in its first seconds, or when something else is on.
 */
export function placeFrom(prev: NowPlaying | null, np: NowPlaying | null, trackIds: string[], now: number): Place | null | undefined {
  if (workEnded(prev, np, trackIds)) return null
  const seen = playbackOf(np, trackIds)
  if (!seen || !np) return undefined
  if (positionOf(np, trackIds)) return { index: seen.index, progressMs: np.progressMs, at: now }
  if (seen.index === 0) return null
  const atClose = np.durationMs > 0 && np.durationMs - np.progressMs < 4000
  return atClose ? null : undefined
}
