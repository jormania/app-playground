import { useEffect } from 'react'
import { useServices } from './services'
import { onHeardThrough, onPlayerReading, usePlayerState } from './playback'
import { isConfirmed } from '../spotify/verify'
import { trackKey } from '../spotify/witness'
import { listeningState } from '../domain/listening'
import type { NowPlaying } from '../spotify/client'
import type { Recording } from '../domain/types'
import type { Repo } from '../store/repo'
import type { Journey } from '../curation/journey'

/** Mark heard (source `app`) every confirmed single-track recording of these tracks; returns their ids. */
export async function recordHeardThrough(repo: Repo, journey: Pick<Journey, 'markListening'>, trackIds: string[]): Promise<string[]> {
  const heard = (await repo.recordings.all()).filter((r) => isConfirmed(r) && r.spotify.trackIds.length === 1 && trackIds.includes(r.spotify.trackIds[0]))
  for (const r of heard) await journey.markListening({ recordingId: r.id, workId: r.workId }, 'heard', undefined, 'app')
  return heard.map((r) => r.id)
}

/**
 * The confirmed works in movements that just stopped sounding: the last
 * reading was playing one of their tracks, and this one plays none of them
 * (paused, stopped, rewound to the start at the end of the list, or on to
 * something else).
 */
export function stoppedWorks(prev: NowPlaying | null, cur: NowPlaying | null, recordings: Recording[]): Recording[] {
  if (!prev?.isPlaying) return []
  const was = trackKey(prev)
  const now = cur?.isPlaying ? trackKey(cur) : undefined
  return recordings.filter((r) => isConfirmed(r) && r.spotify.trackIds.length > 1
    && r.spotify.trackIds.includes(was) && !(now && r.spotify.trackIds.includes(now)))
}

/** After a work in movements stops: read Spotify's history soon, and once more when the last movement has surely reached it. */
const LOOK_AFTER_MS = [5_000, 60_000]

/**
 * Wherever a single-track work is played — Play in the app, "Open in Spotify",
 * the week's playlist, or Spotify on its own — the app can only tell it was
 * heard end to end by watching the player while it plays (spotify/witness.ts).
 * So, mounted once at the app's root, this keeps the player watched on every
 * screen while Spotify is connected and the app is in front, and records each
 * track the witness saw played through as heard, on every confirmed
 * single-track recording of it (as Spotify's history maps a track to each
 * recording it confirms). Source `app`: it moves a recording forward, never
 * against the listener's own word. Then it tells anyone listening which
 * recordings it marked (the listening view opens its "how did it land" panel).
 */
export function HeardWitness() {
  const { repo, journey, bump, syncSpotify } = useServices()
  usePlayerState()
  useEffect(() => onHeardThrough((trackIds) => {
    recordHeardThrough(repo, journey, trackIds).then((ids) => {
      if (!ids.length) return
      bump()
      for (const l of recorded) l(ids)
    }).catch(() => {})
  }), [repo, journey, bump])

  // A work in movements is heard by Spotify's history (≥ 60% of its tracks,
  // spotify/verify.ts), which the app otherwise reads only on load and on
  // coming back to the foreground — so a work listened to with the app open
  // stayed "paused at movement 1" until the next visit. When one stops, look.
  useEffect(() => {
    let prev: NowPlaying | null = null
    const timers: number[] = []
    const off = onPlayerReading((np) => {
      const was = prev
      prev = np
      if (!was?.isPlaying) return
      repo.recordings.all().then(async (all) => {
        const stopped = stoppedWorks(was, np, all)
        if (!stopped.length) return
        const ids = stopped.map((r) => r.id)
        const heardNow = async () => {
          const events = await repo.events.all()
          return ids.filter((id) => listeningState(events, id) === 'heard')
        }
        const before = new Set(await heardNow())
        while (timers.length) clearTimeout(timers.pop())
        for (const ms of LOOK_AFTER_MS) {
          timers.push(window.setTimeout(() => {
            syncSpotify().then(async (n) => {
              if (!n) return
              const fresh = (await heardNow()).filter((id) => !before.has(id))
              for (const id of fresh) before.add(id)
              if (fresh.length) for (const l of recorded) l(fresh)
            }).catch(() => {})
          }, ms))
        }
      }).catch(() => {})
    })
    return () => { off(); while (timers.length) clearTimeout(timers.pop()) }
  }, [repo, syncSpotify])
  return null
}

const recorded = new Set<(recordingIds: string[]) => void>()

/** Told the recordings the app just marked heard from watching them play through. */
export function onHeardRecorded(listener: (recordingIds: string[]) => void): () => void {
  recorded.add(listener)
  return () => { recorded.delete(listener) }
}
