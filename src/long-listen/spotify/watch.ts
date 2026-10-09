import { SpotifyUnavailable, type NowPlaying } from './client'

/**
 * One reading of Spotify's player, shared by every part of the app that shows
 * what's playing: the listening view, each recording's Play button, the
 * running order. However many are on screen, there is one request at a time.
 *
 * It looks only while something is watching and the page is visible, and
 * again the moment the page comes back (from the Spotify app, say). While a
 * track plays it looks again just after that track should end, so the next
 * movement is marked within a couple of seconds rather than up to a quarter
 * of a minute late; otherwise every 15 seconds.
 */
export interface PlayerState {
  np: NowPlaying | null
  /** This sign-in can't read playback; reconnecting Spotify fixes it. */
  cantFollow: boolean
  /** A first reading has come back. */
  known: boolean
}

export const IDLE_MS = 15_000
const MIN_MS = 3_000
const SETTLE_MS = 1_200
const AFTER_END_MS = 1_500

/** When to look next, given what was seen. */
export function nextLookIn(np: NowPlaying | null): number {
  if (!np?.isPlaying || !np.durationMs) return IDLE_MS
  const left = np.durationMs - np.progressMs + AFTER_END_MS
  return Math.max(MIN_MS, Math.min(IDLE_MS, left))
}

interface Source { connected: boolean; nowPlaying(): Promise<NowPlaying | null> }
interface Page {
  readonly visibilityState: string
  addEventListener(type: 'visibilitychange', handler: () => void): void
  removeEventListener(type: 'visibilitychange', handler: () => void): void
}

export class PlayerWatch {
  private state: PlayerState = { np: null, cantFollow: false, known: false }
  private listeners = new Set<(s: PlayerState) => void>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private inFlight = false
  private readonly onVisible = () => { if (this.visible()) this.look() }

  constructor(
    private readonly source: Source,
    private readonly doc: Page | null = typeof document === 'undefined' ? null : document,
  ) {}

  get current(): PlayerState { return this.state }

  subscribe(listener: (s: PlayerState) => void): () => void {
    this.listeners.add(listener)
    if (this.listeners.size === 1) {
      this.doc?.addEventListener('visibilitychange', this.onVisible)
      this.look()
    }
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) {
        this.doc?.removeEventListener('visibilitychange', this.onVisible)
        this.clear()
      }
    }
  }

  /**
   * After a command: show its likely outcome at once, then look again once
   * Spotify has settled, so the screen never waits a poll to agree with a tap.
   */
  expect(change: (np: NowPlaying | null) => NowPlaying | null): void {
    this.set({ ...this.state, np: change(this.state.np) })
    this.schedule(SETTLE_MS)
  }

  private visible() { return !this.doc || this.doc.visibilityState === 'visible' }

  private clear() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private schedule(ms: number) {
    this.clear()
    if (this.listeners.size) this.timer = setTimeout(() => this.look(), ms)
  }

  private set(s: PlayerState) {
    this.state = s
    for (const l of this.listeners) l(s)
  }

  look(): void {
    if (!this.listeners.size || this.inFlight) return
    if (!this.source.connected || !this.visible()) { this.clear(); return }
    this.inFlight = true
    this.source.nowPlaying().then(
      (np) => { this.set({ np, cantFollow: false, known: true }) },
      (e) => {
        if (e instanceof SpotifyUnavailable && e.reason === 'signed-out') this.set({ ...this.state, cantFollow: true, known: true })
      },
    ).finally(() => {
      this.inFlight = false
      this.schedule(nextLookIn(this.state.np))
    })
  }
}
