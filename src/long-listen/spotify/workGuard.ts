import { playbackOf, type NowPlaying } from './client'

/**
 * Stops a work at its last movement. A work opened in Spotify plays in its
 * album, and an album carries on: Cantus arcticus has three movements, and
 * Spotify went straight on into the Fourth Symphony that follows it on the
 * disc — music the programme never offered. (Play from the app sends only the
 * work's own tracks, but Spotify's autoplay can still carry on after them.)
 *
 * So a work started from the app is "armed": when a reading shows its last
 * movement has just run into a track that isn't one of its own, the app pauses
 * Spotify. Only that run-on stops it — the last movement near its end in one
 * reading, something else playing in the next. A listener who chose other
 * music, or skipped on themselves mid-movement, is left alone, and the week's
 * playlist (whose works follow one another on purpose) is never armed.
 */

/** How near its end the last movement must have been for the next track to be a run-on, not a choice. */
export const RUN_ON_WINDOW_MS = 75_000
/** An armed work forgets itself after this, played or not. */
const ARMED_FOR_MS = 4 * 60 * 60_000

/** The last movement was near its end, and now something that isn't this work is playing. */
export function ranOn(prev: NowPlaying | null, cur: NowPlaying | null, trackIds: string[]): boolean {
  if (!prev?.isPlaying || !cur?.isPlaying || !trackIds.length) return false
  const was = playbackOf(prev, trackIds)
  if (!was || was.index !== trackIds.length - 1) return false
  if (playbackOf(cur, trackIds)) return false
  return prev.durationMs > 0 && prev.durationMs - prev.progressMs <= RUN_ON_WINDOW_MS
}

export class WorkGuard {
  private armed: { trackIds: string[]; until: number; started: boolean } | null = null

  /** Watch this work from now: its tracks, in order. One work at a time — the latest started. */
  arm(trackIds: string[], now: number): void {
    this.armed = trackIds.length ? { trackIds, until: now + ARMED_FOR_MS, started: false } : null
  }

  /** A work is being watched and may still run on. */
  isArmed(now: number): boolean {
    if (this.armed && now > this.armed.until) this.armed = null
    return Boolean(this.armed)
  }

  /**
   * One reading after another: true when the armed work has just run on into
   * something else, which should be stopped. Disarms then, and when the
   * listener has moved on to other music of their own.
   */
  observe(prev: NowPlaying | null, cur: NowPlaying | null, now: number): boolean {
    if (!this.isArmed(now) || !this.armed) return false
    const { trackIds } = this.armed
    if (playbackOf(cur, trackIds)) { this.armed.started = true; return false }
    if (ranOn(prev, cur, trackIds)) { this.armed = null; return true }
    // Something else playing once the work had begun: the listener's own choice. Before it began, the reading is just late.
    if (this.armed.started && cur?.isPlaying) this.armed = null
    return false
  }
}

/**
 * The work has just ended: the last movement was playing near its close, and
 * now Spotify has stopped at its end, gone back to the first movement at rest,
 * or moved on to something else. A pause partway through the last movement is
 * not an end.
 */
export function workEnded(prev: NowPlaying | null, cur: NowPlaying | null, trackIds: string[]): boolean {
  if (!prev?.isPlaying || trackIds.length < 1) return false
  const was = playbackOf(prev, trackIds)
  if (!was || was.index !== trackIds.length - 1) return false
  if (!(prev.durationMs > 0 && prev.durationMs - prev.progressMs <= RUN_ON_WINDOW_MS)) return false
  if (!cur) return true
  const now = playbackOf(cur, trackIds)
  if (!now) return true
  if (cur.isPlaying) return false
  const atClose = now.index === trackIds.length - 1 && cur.durationMs > 0 && cur.durationMs - cur.progressMs < 4000
  const backAtStart = now.index === 0 && cur.progressMs < 2000
  return atClose || backAtStart
}
