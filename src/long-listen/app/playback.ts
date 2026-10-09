import { useEffect, useState } from 'react'
import { useServices } from './services'
import { SpotifyUnavailable, playbackOf, type SpotifyClient } from '../spotify/client'
import { PlayerWatch, type PlayerState } from '../spotify/watch'
import { messageOf } from '../components/common'

/** One watch per Spotify client, however many components ask. */
const watches = new WeakMap<SpotifyClient, PlayerWatch>()
function watchFor(spotify: SpotifyClient): PlayerWatch {
  let w = watches.get(spotify)
  if (!w) watches.set(spotify, (w = new PlayerWatch(spotify)))
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
  const seen = spotify.connected && trackIds?.length ? playbackOf(state.np, trackIds) : null
  // A work that has played to its end: Spotify stops on the last movement, at
  // its close or rewound to the start. That is finished, not paused — Play
  // starts it again from the top, rather than Resume replaying one movement.
  const np = state.np
  const finished = Boolean(seen && trackIds && np && !np.isPlaying && seen.index === trackIds.length - 1 &&
    (np.progressMs === 0 || (np.durationMs > 0 && np.durationMs - np.progressMs < 4000)))
  const at = finished ? null : seen

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
