import { playbackOf, type NowPlaying } from './client'

/**
 * Has this work just finished playing? Spotify says nothing when a list of
 * tracks runs out, so it's read from what the player shows next:
 *
 * - it stopped on the last movement at (or within a few seconds of) its end;
 * - it stopped on the last movement with the position back at zero, having
 *   been near the end a moment ago (some devices rewind when a list ends);
 * - it moved on to something else, or to nothing, having been near the end
 *   of the last movement (Spotify's autoplay, or the device going idle).
 *
 * A pause mid-movement is never an ending; nor is anything seen without
 * first having watched the last movement near its end. The state is the
 * caller's to keep between readings.
 */
export interface Follow { onLast: boolean; nearEnd: boolean }
export const FOLLOW_START: Follow = { onLast: false, nearEnd: false }

const NEAR_END_MS = 25_000
const AT_END_MS = 4_000

export function follow(prev: Follow, np: NowPlaying | null, trackIds: string[]): { next: Follow; ended: boolean } {
  const last = trackIds.length - 1
  const at = playbackOf(np, trackIds)
  if (at && at.index === last && np) {
    const left = np.durationMs ? np.durationMs - np.progressMs : Infinity
    const stoppedAtEnd = !np.isPlaying && np.durationMs > 0 && left <= AT_END_MS
    const rewound = !np.isPlaying && np.progressMs === 0 && prev.nearEnd
    if (stoppedAtEnd || rewound) return { next: FOLLOW_START, ended: true }
    return { next: { onLast: true, nearEnd: left <= NEAR_END_MS }, ended: false }
  }
  if (at) return { next: FOLLOW_START, ended: false }
  // Something else, or nothing at all: an ending only straight after the last movement's close.
  return { next: FOLLOW_START, ended: prev.onLast && prev.nearEnd }
}
