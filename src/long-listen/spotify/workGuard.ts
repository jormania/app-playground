import { playbackOf, type NowPlaying } from './client'

/**
 * Stops a work at its last movement. A work opened in Spotify plays in its
 * album, and an album carries on: Cantus arcticus has three movements, and
 * Spotify went straight on into the Fourth Symphony that follows it on the
 * disc — music the programme never offered. (Play from the app sends only the
 * work's own tracks, but Spotify's autoplay can still carry on after them.)
 *
 * So a work started from the app is "armed": when a reading shows a track
 * that isn't one of its own, begun just when the work should have ended, the
 * app pauses Spotify. When it should have ended is read from the last reading
 * of the work and the lengths of the movements still to come — so it holds
 * even when the phone put the page to sleep for the whole of the work, as
 * Chrome does to a tab behind the Spotify app, and the page wakes only to
 * find the Hymnus from the next work on the disc playing. The armed work and
 * that last reading are kept in localStorage, so a tab the browser discarded
 * and reloaded still knows. A listener who chose other music, or skipped on
 * themselves mid-movement, is left alone, and the week's playlist (whose works
 * follow one another on purpose) is never armed.
 */

/** Without the time between two readings: how near its end the last movement must have been for the next track to be a run-on. */
export const RUN_ON_WINDOW_MS = 75_000
/** An armed work forgets itself after this, played or not. */
const ARMED_FOR_MS = 4 * 60 * 60_000

/** How much later a reading may come than the clock alone would say (polling, a slow network). */
const DRIFT_MS = 10_000
/**
 * How near the work's end the next track must have begun to be its run-on.
 * Earlier is a skip, unless a crossfade (up to 12 s) began it a little early;
 * later is a choice made since, unless a short pause put the end back a little.
 */
const BEGAN_EARLY_MS = 15_000
const BEGAN_LATE_MS = 20_000

/** One reading of the player, and when it came back. */
export interface Reading { np: NowPlaying; at: number }

/**
 * When the work should end, read from one reading of it playing: what is left
 * of this movement and of every movement after it. Unknown when a later
 * movement's length is.
 */
export function endOfWork(last: Reading, trackIds: string[], durationsMs?: number[]): number | undefined {
  const was = playbackOf(last.np, trackIds)
  if (!was || !last.np.isPlaying || !(last.np.durationMs > 0)) return undefined
  let left = last.np.durationMs - last.np.progressMs
  for (let i = was.index + 1; i < trackIds.length; i++) {
    const d = durationsMs?.[i]
    if (!d) return undefined
    left += d
  }
  return last.at + left
}

/**
 * Something that isn't this work is playing, and it began when the work
 * should have ended: Spotify carried on, the listener didn't choose it. Read
 * from the last reading of the work, however long ago — a phone puts a page
 * in the background to sleep, and it may wake only after the work has ended.
 * With 60 s of the finale left and another album 15 s later, the listener
 * chose it: the finale can't have ended in between.
 *
 * Without the time between the two readings, only the reading just before
 * can tell: the last movement near its end, something else now.
 */
export function ranOn(prev: NowPlaying | null, cur: NowPlaying | null, trackIds: string[], elapsedMs?: number, durationsMs?: number[]): boolean {
  if (!prev?.isPlaying || !cur?.isPlaying || !trackIds.length) return false
  const was = playbackOf(prev, trackIds)
  if (!was || playbackOf(cur, trackIds)) return false
  if (elapsedMs === undefined) {
    const left = prev.durationMs - prev.progressMs
    return was.index === trackIds.length - 1 && prev.durationMs > 0 && left <= RUN_ON_WINDOW_MS
  }
  const end = endOfWork({ np: prev, at: 0 }, trackIds, durationsMs)
  if (end === undefined) return false
  const began = elapsedMs - cur.progressMs
  return began >= end - BEGAN_EARLY_MS && began <= end + BEGAN_LATE_MS && elapsedMs + DRIFT_MS >= end
}

/** What the guard keeps across a page the browser discarded and reloaded. */
export interface Armed { trackIds: string[]; durationsMs?: number[]; until: number; started: boolean; last?: Reading }
export interface GuardStore { load(): Armed | null; save(a: Armed | null): void }

export class WorkGuard {
  private armed: Armed | null

  constructor(private readonly store?: GuardStore) {
    this.armed = store?.load() ?? null
  }

  private keep() { this.store?.save(this.armed) }

  /** Watch this work from now: its tracks, in order, and their lengths if known. One work at a time — the latest started. */
  arm(trackIds: string[], now: number, durationsMs?: number[]): void {
    this.armed = trackIds.length ? { trackIds, durationsMs: durationsMs?.length === trackIds.length ? durationsMs : undefined, until: now + ARMED_FOR_MS, started: false } : null
    this.keep()
  }

  /** The tracks of the work being watched, if any: whose place and whose end a run-on concerns. */
  armedTrackIds(): string[] | undefined {
    return this.armed?.trackIds
  }

  /** A work is being watched and may still run on. */
  isArmed(now: number): boolean {
    if (this.armed && now > this.armed.until) { this.armed = null; this.keep() }
    return Boolean(this.armed)
  }

  /**
   * Each reading: true when the armed work has just run on into something
   * else, which should be stopped. Disarms then, and when the listener has
   * moved on to other music of their own. (`prev`, the reading before, is no
   * longer needed: the guard keeps the last reading of the work itself.)
   */
  observe(_prev: NowPlaying | null, cur: NowPlaying | null, now: number): boolean {
    if (!this.isArmed(now) || !this.armed) return false
    const a = this.armed
    // Ended at rest: Spotify finished the list and holds the work at its first movement, paused at the top —
    // a reading of the work's own track, so the check below would keep it armed (and a hidden page polling)
    // for hours. Seen last in its final movement, or seen ending: nothing is left to stop.
    const atRest = Boolean(cur && !cur.isPlaying && playbackOf(cur, a.trackIds)?.index === 0 && cur.progressMs <= 5_000)
    // Only once the player is quiet: music still sounding after the end is a run-on, for the check below to stop.
    if (a.started && a.last && !cur?.isPlaying && (workEnded(a.last.np, cur, a.trackIds) || (atRest && playbackOf(a.last.np, a.trackIds)?.index === a.trackIds.length - 1))) {
      this.armed = null
      this.keep()
      return false
    }
    if (cur && playbackOf(cur, a.trackIds)) {
      a.started = true
      a.last = { np: cur, at: now }
      this.keep()
      return false
    }
    if (a.last && ranOn(a.last.np, cur, a.trackIds, now - a.last.at, a.durationsMs)) { this.armed = null; this.keep(); return true }
    // Something else playing once the work had begun: the listener's own choice. Before it began, the reading is just late.
    // Nothing on Spotify at all once it had begun (closed, or no device): done too — no reason to keep a hidden page polling.
    if (a.started && (cur?.isPlaying || !cur)) { this.armed = null; this.keep() }
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
