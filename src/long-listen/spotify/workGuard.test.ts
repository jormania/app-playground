import { describe, expect, it } from 'vitest'
import { WorkGuard, ranOn } from './workGuard'
import type { NowPlaying } from './client'

const work = ['m1', 'm2', 'm3']
const at = (trackId: string, progressMs: number, durationMs = 300_000, isPlaying = true): NowPlaying => ({ trackId, trackName: '', isPlaying, progressMs, durationMs })

describe('stopping a work at its last movement', () => {
  it('sees the last movement run on into the next track on the album', () => {
    expect(ranOn(at('m3', 290_000), at('sym4-1', 2_000), work)).toBe(true)
  })

  it('leaves alone a skip from the middle of the last movement, a pause, and movements within the work', () => {
    expect(ranOn(at('m3', 60_000), at('other', 2_000), work)).toBe(false)
    expect(ranOn(at('m3', 290_000), at('sym4-1', 2_000, 300_000, false), work)).toBe(false)
    expect(ranOn(at('m2', 299_000), at('m3', 1_000), work)).toBe(false)
    expect(ranOn(at('m1', 299_000), at('other', 1_000), work)).toBe(false)
  })

  it('stops only an armed work, once, and forgets it when the listener moves on', () => {
    const g = new WorkGuard()
    // Not armed (the week's playlist, Spotify on its own): never stopped.
    expect(g.observe(at('m3', 295_000), at('sym4-1', 1_000), 0)).toBe(false)

    g.arm(work, 0)
    expect(g.observe(null, at('m1', 1_000), 1)).toBe(false)
    expect(g.observe(at('m1', 1_000), at('m3', 295_000), 2)).toBe(false)
    expect(g.observe(at('m3', 295_000), at('sym4-1', 1_000), 3)).toBe(true)
    // Stopped once; the next reading is not a second stop.
    expect(g.isArmed(4)).toBe(false)

    // Armed, begun, then the listener chose something else: disarmed, never stopped later.
    g.arm(work, 10)
    g.observe(null, at('m2', 1_000), 11)
    expect(g.observe(at('m2', 1_000), at('their-choice', 1_000), 12)).toBe(false)
    expect(g.isArmed(13)).toBe(false)

    // Armed before the work's first reading: what was playing before isn't the listener moving on.
    g.arm(work, 20)
    expect(g.observe(at('before', 1_000), at('before', 5_000), 21)).toBe(false)
    expect(g.isArmed(22)).toBe(true)
  })

  it('forgets an armed work after four hours', () => {
    const g = new WorkGuard()
    g.arm(work, 0)
    expect(g.isArmed(4 * 60 * 60_000 + 1)).toBe(false)
  })
})

import { workEnded } from './workGuard'

describe('the work ending', () => {
  it('ends when the last movement plays out: stopped at its close, back at the start, or on to something else', () => {
    expect(workEnded(at('m3', 295_000), at('m3', 299_000, 300_000, false), work)).toBe(true)
    expect(workEnded(at('m3', 295_000), at('m1', 0, 300_000, false), work)).toBe(true)
    expect(workEnded(at('m3', 295_000), at('next-work', 1_000), work)).toBe(true)
    expect(workEnded(at('m3', 295_000), null, work)).toBe(true)
  })

  it('does not end on a pause partway through, or between movements', () => {
    expect(workEnded(at('m3', 120_000), at('m3', 121_000, 300_000, false), work)).toBe(false)
    expect(workEnded(at('m3', 295_000), at('m3', 250_000, 300_000, false), work)).toBe(false)
    expect(workEnded(at('m2', 299_000), at('m3', 1_000), work)).toBe(false)
  })
})
