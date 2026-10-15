import { describe, expect, it } from 'vitest'
import { WorkGuard, endOfWork, ranOn, type Armed } from './workGuard'
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

  it('lets go of a work that ended at rest — Spotify holding its first movement, paused — instead of watching for hours', () => {
    const g = new WorkGuard()
    g.arm(work, 0)
    g.observe(null, at('m1', 1_000), 1)
    g.observe(at('m1', 1_000), at('m3', 200_000), 2)
    // The page slept through the end; back to Spotify at rest on movement I.
    expect(g.observe(at('m3', 200_000), at('m1', 0, 300_000, false), 3)).toBe(false)
    expect(g.isArmed(4)).toBe(false)
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

describe('a run-on, told from the listener’s own choice', () => {
  const ids = ['m1', 'm2', 'm3']
  const np = (trackId: string, progressMs: number, durationMs = 600_000, isPlaying = true) => ({ trackId, trackName: '', isPlaying, progressMs, durationMs })
  it('needs time enough for the finale to have ended', () => {
    // 60 s left, and 15 s later another album: chosen, not run on.
    expect(ranOn(np('m3', 540_000), np('other', 5_000), ids, 15_000)).toBe(false)
    // 60 s left, and 65 s later the next track on the album: run on.
    expect(ranOn(np('m3', 540_000), np('other', 5_000), ids, 65_000)).toBe(true)
  })
  it('lets go of a work once Spotify has nothing on at all', () => {
    const g = new WorkGuard()
    g.arm(ids, 0)
    g.observe(null, np('m1', 1000), 1000)
    g.observe(np('m1', 1000), null, 20_000)
    expect(g.isArmed(21_000)).toBe(false)
  })
})

describe('a work that ran on while the page slept', () => {
  const ids = ['m1', 'm2', 'm3']
  const lengths = [400_000, 240_000, 420_000]
  const np = (trackId: string, progressMs: number, durationMs = 420_000) => ({ trackId, trackName: '', isPlaying: true, progressMs, durationMs })
  // Last seen 100 s into the first movement; the work ends 300 + 240 + 420 s later.
  const end = 300_000 + 240_000 + 420_000

  it('knows when the work should have ended, from any movement, given the lengths of those to come', () => {
    expect(endOfWork({ np: np('m1', 100_000, 400_000), at: 1_000 }, ids, lengths)).toBe(1_000 + end)
    expect(endOfWork({ np: np('m1', 100_000, 400_000), at: 1_000 }, ids)).toBeUndefined()
    expect(endOfWork({ np: np('m3', 400_000), at: 0 }, ids)).toBe(20_000)
  })

  it('stops what began when the work ended — not a choice made later, nor a skip made earlier', () => {
    const g = new WorkGuard()
    g.arm(ids, 0, lengths)
    g.observe(null, np('m1', 100_000, 400_000), 0)
    // The page wakes 2 minutes after the work ended; the Hymnus that followed it is 2 minutes in.
    expect(g.observe(null, np('hymnus', 120_000, 300_000), end + 120_000)).toBe(true)

    g.arm(ids, 0, lengths)
    g.observe(null, np('m1', 100_000, 400_000), 0)
    // The same moment, but what plays began a minute after the work ended: the listener's.
    expect(g.observe(null, np('theirs', 60_000, 300_000), end + 120_000)).toBe(false)
    expect(g.isArmed(end + 120_001)).toBe(false)

    g.arm(ids, 0, lengths)
    g.observe(null, np('m1', 100_000, 400_000), 0)
    // Skipped on from the second movement: began long before the work could have ended.
    expect(g.observe(null, np('next', 10_000, 300_000), 400_000)).toBe(false)
  })

  it('remembers the armed work and its last reading across a page reloaded by the browser', () => {
    let kept: Armed | null = null
    const store = { load: () => kept, save: (a: Armed | null) => { kept = a && structuredClone(a) } }
    const before = new WorkGuard(store)
    before.arm(ids, 0, lengths)
    before.observe(null, np('m1', 100_000, 400_000), 0)
    const after = new WorkGuard(store)
    expect(after.isArmed(1)).toBe(true)
    expect(after.observe(null, np('hymnus', 5_000, 300_000), end + 5_000)).toBe(true)
    expect(kept).toBeNull()
  })
})
