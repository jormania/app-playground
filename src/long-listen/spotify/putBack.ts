import type { NowPlaying } from './client'

/** What putting a work back needs of the Spotify client. */
export interface PutBackPlayer {
  nowPlaying(): Promise<NowPlaying | null>
  setVolume(percent: number): Promise<boolean>
  play(trackUris: string[], from?: number, positionMs?: number): Promise<void>
  pause(): Promise<void>
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * After a work started from the app ran on into the next track of its album
 * (Spotify, a TV above all, carries on past the tracks it was given, and no
 * request can stop it loading), the guard pauses it — and the player is left
 * showing music that isn't in the programme. This sets the work back in its
 * place: its first movement, at its start, paused, without a sound — the
 * volume down to nothing first, up again only once the player is seen paused.
 *
 * Never on a device whose volume can't be set or read: there it stays as it
 * was, paused on the other track. Returns true when the work is back.
 */
export async function putWorkBack(player: PutBackPlayer, trackIds: string[], { settleMs = 400, tries = 8 }: { settleMs?: number; tries?: number } = {}): Promise<boolean> {
  if (!trackIds.length) return false
  const before = await player.nowPlaying().catch(() => null)
  const volume = before?.volumePercent
  if (before?.isPlaying || typeof volume !== 'number') return false
  if (!(await player.setVolume(0))) return false
  let back = false
  try {
    await player.play(trackIds.map((id) => `spotify:track:${id}`), 0, 0)
    // Paused only once the player has the work: a pause sent before the play lands leaves it playing, silently.
    for (let i = 0; i < tries; i++) {
      await wait(settleMs)
      const np = await player.nowPlaying().catch(() => null)
      if (np && (np.trackId === trackIds[0] || np.linkedFromId === trackIds[0])) {
        await player.pause().catch(() => undefined)
        await wait(settleMs)
        back = !(await player.nowPlaying().catch(() => null))?.isPlaying
        if (back) break
      }
    }
    if (!back) await player.pause().catch(() => undefined)
  } finally {
    // The volume comes back only after the last pause, whatever happened on the way.
    await player.setVolume(volume)
  }
  return back
}
