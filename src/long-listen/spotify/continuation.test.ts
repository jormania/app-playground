import { describe, it, expect } from 'vitest'
import { follow, FOLLOW_START, type Follow } from './continuation'
import type { NowPlaying } from './client'

const ids = ['m1', 'm2']
const np = (trackId: string, isPlaying: boolean, progressMs: number, durationMs = 300_000): NowPlaying => ({ trackId, trackName: '', isPlaying, progressMs, durationMs })

function run(readings: (NowPlaying | null)[]): boolean[] {
  let s: Follow = FOLLOW_START
  return readings.map((r) => { const o = follow(s, r, ids); s = o.next; return o.ended })
}

describe('follow', () => {
  it('sees the end when the last movement stops at its close', () => {
    expect(run([np('m1', true, 1000), np('m2', true, 290_000), np('m2', false, 299_000)])).toEqual([false, false, true])
  })

  it('sees the end when the player moves on, or goes quiet, straight after the last movement', () => {
    expect(run([np('m2', true, 295_000), np('autoplay', true, 3000)])).toEqual([false, true])
    expect(run([np('m2', true, 295_000), null])).toEqual([false, true])
    expect(run([np('m2', true, 295_000), np('m2', false, 0)])).toEqual([false, true])
  })

  it('never calls a pause, an early skip, or a first sighting an ending', () => {
    expect(run([np('m2', true, 100_000), np('m2', false, 100_500)])).toEqual([false, false])
    expect(run([np('m1', true, 290_000), np('other', true, 1000)])).toEqual([false, false])
    expect(run([np('m2', true, 100_000), np('other', true, 1000)])).toEqual([false, false])
    expect(run([np('m2', false, 0)])).toEqual([false])
  })
})
