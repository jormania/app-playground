import { useEffect, useRef, useState } from 'react'
import { keepPlace, placeFrom, positionOf, savedPlace, type Place } from './place'
import { useServices } from './services'
import { SpotifyUnavailable, playbackOf, shortDevice, type NowPlaying, type SpotifyClient } from '../spotify/client'
import { PlayerWatch, type PlayerState } from '../spotify/watch'
import { Witness } from '../spotify/witness'
import { WorkGuard, type Armed } from '../spotify/workGuard'
import { readJson, removeJson, writeJson } from '../../shared/storage'
import { messageOf } from '../components/common'

/**
 * The app as witness (spotify/witness.ts): every real reading of the player,
 * from whichever screen is open, goes to one witness; a track it sees played
 * end to end goes to whoever records it (app/HeardWitness.tsx, mounted once).
 */
const witness = new Witness()
const heardListeners = new Set<(trackIds: string[]) => void>()
const readingListeners = new Set<(np: NowPlaying | null) => void>()
/** The work started from the app, watched so it stops at its last movement (spotify/workGuard.ts). */
const GUARD_KEY = 'long-listen:work-guard'
const guard = new WorkGuard({
  load: () => { const a = readJson<Armed | null>(GUARD_KEY, null); return a && Array.isArray(a.trackIds) && typeof a.until === 'number' ? a : null },
  save: (a) => { if (a) writeJson(GUARD_KEY, a); else removeJson(GUARD_KEY) },
})
const ranOnListeners = new Set<(trackIds: string[]) => void>()
let lastReading: NowPlaying | null = null

/**
 * The works whose place is kept (app/place.ts): every work shown with a Play
 * button this visit, and every work started from the app. Kept from each
 * reading here, whatever screen is open — not only while that work's page is.
 */
const placeWorks = new Map<string, string[]>()
function knowPlace(trackIds: string[] | undefined): void {
  if (trackIds?.length) placeWorks.set(trackIds.join(), trackIds)
}

function observe(np: NowPlaying | null, at: number) {
  const heard = witness.observe({ np, at })
  if (heard.length) for (const l of heardListeners) l(heard)
  for (const ids of placeWorks.values()) {
    const place = placeFrom(lastReading, np, ids, at)
    if (place !== undefined) keepPlace(ids, place)
  }
  const armedIds = guard.armedTrackIds()
  const ran = guard.observe(lastReading, np, at)
  // The guard saw the work end — run on past its close, or held at rest at its top once it was over — even
  // with the page asleep through the end, which the readings around the close can't show: its place is let go
  // (no "Resume" offered for a work heard through).
  const endedAtRest = Boolean(armedIds && !ran && !guard.armedTrackIds() && np && !np.isPlaying && playbackOf(np, armedIds)?.index === 0)
  if (armedIds && (ran || endedAtRest)) keepPlace(armedIds, null)
  lastReading = np
  if (ran && armedIds) for (const l of ranOnListeners) l(armedIds)
  for (const l of readingListeners) l(np)
}

/** A work started from the app (Play, or opened in Spotify): watch it, to stop it at its last movement. */
export function armWork(trackIds: string[] | undefined, durationsMs?: number[]): void {
  knowPlace(trackIds)
  if (trackIds?.length) guard.arm(trackIds, Date.now(), durationsMs)
}

/** Told when a work started from the app has just run on past its last movement into something else. */
export function onWorkRanOn(listener: (trackIds: string[]) => void): () => void {
  ranOnListeners.add(listener)
  return () => { ranOnListeners.delete(listener) }
}

/** Told every real reading of the player (never the optimistic state shown the moment a command is sent). */
export function onPlayerReading(listener: (np: NowPlaying | null) => void): () => void {
  readingListeners.add(listener)
  return () => { readingListeners.delete(listener) }
}

export { positionOf } from './place'

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
  if (!w) watches.set(spotify, (w = new PlayerWatch(spotify, undefined, observe, () => guard.isArmed(Date.now()))))
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

export { savedPlace, keepPlace, placeFrom, type Place } from './place'

export interface Playback {
  /** Where this recording stands on Spotify, or null when something else (or nothing) is on. */
  at: { index: number; playing: boolean } | null
  /** The device it's playing on, as Spotify names it. */
  device?: string
  cantFollow: boolean
  noDevice: boolean
  /** With no device active: those Spotify can see (a TV or speaker with Spotify open), to play on by a tap. */
  devices: { id: string; name: string }[]
  /** Play again as last asked, on this device. */
  playOn: (deviceId: string) => Promise<boolean>
  busy: boolean
  /** Start this recording from a movement (the first, unless told), at a place inside it if given. */
  play: (from?: number, positionMs?: number) => Promise<boolean>
  /** Where it was left, when Spotify no longer holds it: resumable from there. */
  left: Place | null
  /** Opened in Spotify from the app: watch it, so it stops at its last movement. */
  arm: () => void
  pause: () => Promise<void>
  resume: () => Promise<void>
}

/**
 * This recording's playback, and the commands for it: Play starts it from a
 * movement, Pause and Resume leave it where it is. Each command shows its
 * outcome at once and checks with Spotify a moment later.
 */
export function usePlayback(trackUris: string[] | undefined, trackIds: string[] | undefined, durationsMs?: number[]): Playback {
  const { spotify, say } = useServices()
  const watch = watchFor(spotify)
  const state = usePlayerState()

  const [busy, setBusy] = useState(false)
  const [noDevice, setNoDevice] = useState(false)
  const [devices, setDevices] = useState<{ id: string; name: string }[]>([])
  // What Play was last asked for, so a device chosen after "no device" plays the same thing there.
  const lastPlay = useRef({ from: 0, positionMs: 0 })
  // A finished work is at rest, not paused (positionOf): Play starts it again from the top.
  const at = spotify.connected && trackIds?.length ? positionOf(state.np, trackIds) : null

  // Where it was left, kept from every reading of it, so Resume outlives Spotify forgetting it.
  const idsKey = trackIds?.join() ?? ''
  const [left, setLeft] = useState(() => savedPlace(trackIds))
  useEffect(() => {
    if (!trackIds?.length) return
    knowPlace(trackIds)
    setLeft(savedPlace(trackIds))
    // Kept by observe(), before readers are told: read back after each reading.
    return onPlayerReading(() => setLeft(savedPlace(trackIds)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  async function run(command: () => Promise<void>, expect: Parameters<PlayerWatch['expect']>[0]): Promise<boolean> {
    setNoDevice(false)
    setBusy(true)
    try {
      await command()
      watch.expect(expect)
      return true
    } catch (e) {
      if (e instanceof SpotifyUnavailable && e.reason === 'no-device') {
        setNoDevice(true)
        // Nothing active: perhaps a TV or speaker with Spotify open but idle — offer those by name.
        spotify.devices()
          .then((list) => setDevices(list.filter((d) => d.id && !d.restricted).map((d) => ({ id: d.id!, name: shortDevice(d.name, d.type) ?? d.name }))))
          .catch(() => setDevices([]))
      } else say(messageOf(e), 'danger')
      return false
    } finally {
      setBusy(false)
    }
  }

  return {
    at,
    device: at ? state.np?.deviceName : undefined,
    cantFollow: state.cantFollow && spotify.connected,
    // A device found since (this work is on now) answers the "no device" said earlier.
    noDevice: noDevice && !at,
    busy,
    left: at ? null : left,
    arm: () => armWork(trackIds, durationsMs),
    devices: noDevice && !at ? devices : [],
    play: (from = 0, positionMs = 0) => {
      lastPlay.current = { from, positionMs }
      return run(
        async () => { await spotify.play(trackUris ?? [], from, positionMs); armWork(trackIds, durationsMs) },
        (np) => ({ trackId: trackIds?.[from] ?? '', trackName: '', isPlaying: true, progressMs: positionMs, durationMs: 0, deviceName: np?.deviceName }),
      )
    },
    playOn: (deviceId: string) => {
      const { from, positionMs } = lastPlay.current
      const name = devices.find((d) => d.id === deviceId)?.name
      return run(
        async () => { await spotify.play(trackUris ?? [], from, positionMs, deviceId); armWork(trackIds, durationsMs); setDevices([]) },
        () => ({ trackId: trackIds?.[from] ?? '', trackName: '', isPlaying: true, progressMs: positionMs, durationMs: 0, deviceName: name }),
      )
    },
    pause: async () => { await run(() => spotify.pause(), (np) => np && { ...np, isPlaying: false }) },
    resume: async () => {
      // Where it is paused, so a device chosen after "no device" carries on from there rather than from the top.
      if (at) lastPlay.current = { from: at.index, positionMs: state.np?.progressMs ?? 0 }
      await run(() => spotify.resume(), (np) => np && { ...np, isPlaying: true })
    },
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
