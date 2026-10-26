import { describe, it, expect } from 'vitest'
import { putWorkBack, type PutBackPlayer } from './putBack'
import type { NowPlaying } from './client'

const np = (trackId: string, isPlaying: boolean, volumePercent?: number): NowPlaying => ({ trackId, trackName: trackId, isPlaying, progressMs: 0, durationMs: 1000, ...(volumePercent !== undefined ? { volumePercent } : {}) })

/** A player that loads what it's told and answers readings; `lag` readings pass before a play lands. */
function fakePlayer(opts: { volume?: number | null; volumeOk?: boolean; lag?: number; playFails?: boolean } = {}) {
  const { volumeOk = true, lag = 0, playFails = false } = opts
  const volume = opts.volume === null ? undefined : (opts.volume ?? 60)
  const log: string[] = []
  let current = np('jeux', false, volume)
  let pending = 0
  const player: PutBackPlayer = {
    async nowPlaying() {
      if (pending > 0 && --pending === 0) current = { ...current, trackId: 'nuages', isPlaying: true }
      return current
    },
    async setVolume(p) { log.push(`volume ${p}`); return volumeOk },
    async play(uris, from, pos) {
      log.push(`play ${uris.join(',')} ${from} ${pos}`)
      if (playFails) throw new Error('no device')
      if (lag) pending = lag
      else current = { ...current, trackId: 'nuages', isPlaying: true }
    },
    async pause() { log.push('pause'); current = { ...current, isPlaying: false } },
  }
  return { player, log }
}

describe('putting a work back after it ran on (26 October 2026)', () => {
  it('loads the work at its start, paused, without a sound, and gives the volume back', async () => {
    const { player, log } = fakePlayer()
    expect(await putWorkBack(player, ['nuages', 'fetes', 'sirenes'], { settleMs: 0 })).toBe(true)
    expect(log).toEqual(['volume 0', 'play spotify:track:nuages,spotify:track:fetes,spotify:track:sirenes 0 0', 'pause', 'volume 60'])
  })

  it('pauses only once the player has the work, however slowly the play lands', async () => {
    const { player, log } = fakePlayer({ lag: 3 })
    expect(await putWorkBack(player, ['nuages'], { settleMs: 0 })).toBe(true)
    expect(log.indexOf('pause')).toBeGreaterThan(log.findIndex((l) => l.startsWith('play')))
    expect(log.at(-1)).toBe('volume 60')
  })

  it('leaves a device alone whose volume can’t be read or set', async () => {
    const unknown = fakePlayer({ volume: null })
    expect(await putWorkBack(unknown.player, ['nuages'], { settleMs: 0 })).toBe(false)
    expect(unknown.log).toEqual([])
    const refused = fakePlayer({ volumeOk: false })
    expect(await putWorkBack(refused.player, ['nuages'], { settleMs: 0 })).toBe(false)
    expect(refused.log).toEqual(['volume 0'])
  })

  it('gives the volume back even when the play fails', async () => {
    const { player, log } = fakePlayer({ playFails: true })
    await expect(putWorkBack(player, ['nuages'], { settleMs: 0 })).rejects.toThrow()
    expect(log.at(-1)).toBe('volume 60')
  })

  it('never touches a player that is playing something', async () => {
    const { player, log } = fakePlayer()
    await player.play(['x'])
    log.length = 0
    expect(await putWorkBack(player, ['nuages'], { settleMs: 0 })).toBe(false)
    expect(log).toEqual([])
  })
})
