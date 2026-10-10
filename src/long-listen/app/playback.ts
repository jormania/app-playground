import { useEffect, useState } from 'react'
import { useServices } from './services'
import { SpotifyUnavailable, playbackOf, type NowPlaying, type SpotifyClient } from '../spotify/client'
import { PlayerWatch, type PlayerState } from '../spotify/watch'
import { Witness } from '../spotify/witness'
import { messageOf } from '../components/common'

/**
 * The app as witness (spotify/witness.ts): every real reading of the player,
 * from whichever screen is open, goes to one witness; a track it sees played
 * end to end goes to whoever records it (app/HeardWitness.tsx, mounted once).
 */
const witness = new Witness()
const heardListeners = new Set<(trackIds: string[]) => void>()
const readingListeners = new Set<(np: NowPlaying | null) => void>()

function observe(np: NowPlaying | null, at: number) {
  const heard = witness.observe({ np, at })
  if (heard.length) for (const l of heardListeners) l(heard)
  for (const l of readingListeners) l(np)
}

/** Told every real reading of the player (never the optimistic state shown the moment a command is sent). */
export function onPlayerReading(listener: (np: NowPlaying | null) => void): () => void {
  readingListeners.add(listener)
  return () => { readingListeners.delete(listener) }
}

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

/** Told the track ids the witness saw played end to end. */
export function onHeardThrough(listener: (trackIds: string[]) => void): () => void {
  heardListeners.add(listener)
  return () => { heardListeners.delete(listener) }
}

/**
 * A tap on Play or "Open in Spotify" for a single-track work: an assumed start,
 * so a listening begun in Spotify counts from the top once the page is back
 * and a reading bears it out. (A work in movements is Spotify's history's to tell.)
 */
export function assumeStart(trackIds: string[] | undefined, durationMs: number | undefined): void {
  if (trackIds?.length === 1 && durationMs) witness.assumeStart(trackIds[0], durationMs, Date.now())
}

/** One watch per Spotify client, however many components ask. */
const watches = new WeakMap<SpotifyClient, PlayerWatch>()
function watchFor(spotify: SpotifyClient): PlayerWatch {
  let w = watches.get(spotify)
  if (!w) watches.set(spotify, (w = new PlayerWatch(spotify, undefined, observe)))
  return w
}

/** Spotify's player as last seen; empty when not connected. */
export function usePlayerState(): PlayerState {
  const { spotify } = useServices()
  const watch = watchFor(spotify)
  const [state, setState] = useState(watch.current)
  const connected = spotify.connected
  useEffect(() => (connected ? watch.subscribe(setState) : undefined), [watch, connected])
  return state
}

export interface Playback {
  /** Where this recording stands on Spotify, or null when something else (or nothing) is on. */
  at: { index: number; playing: boolean } | null
  /** The device it's playing on, as Spotify names it. */
  device?: string
  cantFollow: boolean
  noDevice: boolean
  busy: boolean
  /** Start this recording from a movement (the first, unless told). */
  play: (from?: number) => Promise<boolean>
  pause: () => Promise<void>
  resume: () => Promise<void>
}

/**
 * This recording's playback, and the commands for it: Play starts it from a
 * movement, Pause and Resume leave it where it is. Each command shows its
 * outcome at once and checks with Spotify a moment later.
 */
export function usePlayback(trackUris: string[] | undefined, trackIds: string[] | undefined): Playback {
  const { spotify, say } = useServices()
  const watch = watchFor(spotify)
  const state = usePlayerState()

  const [busy, setBusy] = useState(false)
  const [noDevice, setNoDevice] = useState(false)
  // A finished work is at rest, not paused (positionOf): Play starts it again from the top.
  const at = spotify.connected && trackIds?.length ? positionOf(state.np, trackIds) : null

  async function run(command: () => Promise<void>, expect: Parameters<PlayerWatch['expect']>[0]): Promise<boolean> {
    setNoDevice(false)
    setBusy(true)
    try {
      await command()
      watch.expect(expect)
      return true
    } catch (e) {
      if (e instanceof SpotifyUnavailable && e.reason === 'no-device') setNoDevice(true)
      else say(messageOf(e), 'danger')
      return false
    } finally {
      setBusy(false)
    }
  }

  return {
    at,
    device: at ? state.np?.deviceName : undefined,
    cantFollow: state.cantFollow && spotify.connected,
    noDevice,
    busy,
    play: (from = 0) => run(
      () => spotify.play(trackUris ?? [], from),
      (np) => ({ trackId: trackIds?.[from] ?? '', trackName: '', isPlaying: true, progressMs: 0, durationMs: 0, deviceName: np?.deviceName }),
    ),
    pause: async () => { await run(() => spotify.pause(), (np) => np && { ...np, isPlaying: false }) },
    resume: async () => { await run(() => spotify.resume(), (np) => np && { ...np, isPlaying: true }) },
  }
}

/** "Playing on Pixel 8 · movement 2 of 4", or "Paused · …". */
export function playbackLine(p: Playback, movements: number): string {
  if (!p.at) return ''
  return [
    p.at.playing ? (p.device ? `Playing on ${p.device}` : 'Playing now') : (p.device ? `Paused on ${p.device}` : 'Paused'),
    movements > 1 ? `movement ${p.at.index + 1} of ${movements}` : '',
  ].filter(Boolean).join(' · ')
}
