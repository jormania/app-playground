import type { NowPlaying } from './client'

/**
 * The app as witness: did the listener hear a track end to end?
 *
 * Spotify's recently-played history can't say how much of a track was heard
 * (a track appears after thirty seconds, whatever followed), so a single-track
 * work could only ever be "Started" until the listener said otherwise. But
 * while a programme or the listening view is open, the app reads Spotify's
 * player every few seconds anyway. This turns those readings into what was
 * actually seen sounding, and calls a track heard only when they show both:
 *
 * - **most of it played at the pace of the music** (≥ 90% of its length):
 *   between two readings, progress that moved no further than the clock did
 *   is listening; progress that ran ahead of the clock is a jump, and the
 *   skipped stretch is not credited;
 * - **its end was reached**: a reading at its close, or — when the page was
 *   away for the ending — the track gone from the player no sooner than it
 *   had left to play, and (unless Spotify still holds it at its close or
 *   rewound to the start) no later than ten minutes after that.
 *
 * Starting it partway through, jumping to the end, or stopping early never
 * counts. A track is credited once per session; playing it again from the
 * top, or after a three-hour gap, is a new session.
 *
 * Only real readings come here — never the optimistic state the screen shows
 * the moment Play is pressed. The one exception is deliberate and narrow: a
 * tap on Play or "Open in Spotify" is noted as an *assumed* start (the page
 * may be gone to Spotify before any reading). From an assumed start, the only
 * thing credited is what a real reading later proves — the track itself,
 * further on by no more than the clock allows — so opening it and never
 * playing counts for nothing. Kept in memory: a reload mid-work forgets what
 * was seen so far, and the listener's own "I've heard it" is always there.
 */

/** Two readings may disagree with the clock by this much without it being a jump. */
export const DRIFT_MS = 3_000
/** Close enough to a track's end to call it the end. */
export const END_MS = 5_000
/** The share of a track that must have been heard at the pace of the music. */
export const HEARD_SHARE = 0.9
/** How long after its end the page may have been away and still credit the close, when the player has moved on. */
export const LATE_MS = 10 * 60_000
/** A track not seen for this long starts a new session. */
export const SESSION_GAP_MS = 3 * 3600_000

export interface Reading {
  /** When the reading came back (epoch ms). */
  at: number
  np: NowPlaying | null
  /** Not read from Spotify: a start the listener asked for, taken on trust until a reading bears it out. */
  assumed?: boolean
}

interface Session {
  durationMs: number
  /** Stretches of the track seen sounding, [from, to] in ms. */
  spans: [number, number][]
  lastSeen: number
  credited: boolean
}

/** The id the app asked for: a relinked track plays under another id, and the work's track ids hold the asked one. */
export const trackKey = (np: NowPlaying): string => np.linkedFromId ?? np.trackId

export class Witness {
  private sessions = new Map<string, Session>()
  private last: Reading | null = null

  /** A tap on Play or "Open in Spotify" for this track: assume it starts now, from the top. */
  assumeStart(key: string, durationMs: number, at: number): void {
    if (!(durationMs > 0)) return
    const np: NowPlaying = { trackId: key, trackName: '', isPlaying: true, progressMs: 0, durationMs }
    this.session(key, np, at)
    this.last = { at, np, assumed: true }
  }

  /** Take one reading; returns the keys of tracks it showed heard end to end (each once per session). */
  observe(r: Reading): string[] {
    const heard: string[] = []
    const prev = this.last
    this.last = r
    const cur = r.np
    if (cur && cur.durationMs > 0) this.session(trackKey(cur), cur, r.at)

    const was = prev?.np
    if (!prev || !was || !(was.durationMs > 0)) return heard
    const key = trackKey(was)
    const s = this.sessions.get(key)
    if (!s) return heard
    const dt = r.at - prev.at
    const sameTrack = Boolean(cur && trackKey(cur) === key)

    if (prev.assumed) {
      // Only what a reading proves: the track itself, really under way, no further on than the clock allows.
      const dp = sameTrack && cur ? cur.progressMs : -1
      if (dp > END_MS && dp <= dt + DRIFT_MS) add(s, 0, dp)
    } else if (sameTrack && cur) {
      const dp = cur.progressMs - was.progressMs
      if (dp >= 0 && dp <= dt + DRIFT_MS) {
        add(s, was.progressMs, cur.progressMs)
      } else if (dp < 0 && was.isPlaying && !cur.isPlaying && cur.progressMs <= END_MS) {
        // Spotify stopped at the close and rewound to the start: the rest played out, if the clock allows it.
        this.creditClose(s, was, dt, true)
      }
    } else if (was.isPlaying) {
      // It left the player (another track, or nothing): the rest played out, if the clock allows it.
      this.creditClose(s, was, dt, false)
    }

    if (!s.credited && isHeard(s)) {
      s.credited = true
      heard.push(key)
    }
    return heard
  }

  private creditClose(s: Session, was: NowPlaying, dt: number, heldByPlayer: boolean) {
    const left = s.durationMs - was.progressMs
    if (dt + DRIFT_MS < left) return
    if (!heldByPlayer && dt > left + LATE_MS) return
    add(s, was.progressMs, s.durationMs)
  }

  private session(key: string, np: NowPlaying, at: number) {
    const s = this.sessions.get(key)
    // A new session: never seen, seen long ago, or begun again from the top after it was heard.
    const fresh = !s || at - s.lastSeen > SESSION_GAP_MS || (s.credited && np.progressMs <= END_MS && np.isPlaying)
    if (fresh) {
      this.sessions.set(key, { durationMs: np.durationMs, spans: [], lastSeen: at, credited: false })
      return
    }
    s.lastSeen = at
  }
}

function add(s: Session, from: number, to: number) {
  const a = Math.max(0, Math.min(from, s.durationMs))
  const b = Math.max(0, Math.min(to, s.durationMs))
  if (b > a) s.spans.push([a, b])
}

/** How much of the track the spans cover, overlaps counted once. */
export function covered(spans: [number, number][]): number {
  const sorted = [...spans].sort((x, y) => x[0] - y[0])
  let total = 0
  let end = -Infinity
  for (const [a, b] of sorted) {
    if (b <= end) continue
    total += b - Math.max(a, end)
    end = b
  }
  return total
}

function isHeard(s: Session): boolean {
  const reachedEnd = s.spans.some(([, b]) => s.durationMs - b <= END_MS)
  return reachedEnd && covered(s.spans) >= HEARD_SHARE * s.durationMs
}
