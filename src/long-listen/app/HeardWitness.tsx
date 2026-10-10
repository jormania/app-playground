import { useEffect } from 'react'
import { useServices } from './services'
import { onHeardThrough, usePlayerState } from './playback'
import { isConfirmed } from '../spotify/verify'
import type { Repo } from '../store/repo'
import type { Journey } from '../curation/journey'

/** Mark heard (source `app`) every confirmed single-track recording of these tracks; returns their ids. */
export async function recordHeardThrough(repo: Repo, journey: Pick<Journey, 'markListening'>, trackIds: string[]): Promise<string[]> {
  const heard = (await repo.recordings.all()).filter((r) => isConfirmed(r) && r.spotify.trackIds.length === 1 && trackIds.includes(r.spotify.trackIds[0]))
  for (const r of heard) await journey.markListening({ recordingId: r.id, workId: r.workId }, 'heard', undefined, 'app')
  return heard.map((r) => r.id)
}

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
  const { repo, journey, bump } = useServices()
  usePlayerState()
  useEffect(() => onHeardThrough((trackIds) => {
    recordHeardThrough(repo, journey, trackIds).then((ids) => {
      if (!ids.length) return
      bump()
      for (const l of recorded) l(ids)
    }).catch(() => {})
  }), [repo, journey, bump])
  return null
}

const recorded = new Set<(recordingIds: string[]) => void>()

/** Told the recordings the app just marked heard from watching them play through. */
export function onHeardRecorded(listener: (recordingIds: string[]) => void): () => void {
  recorded.add(listener)
  return () => { recorded.delete(listener) }
}
