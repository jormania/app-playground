import { describe, expect, it } from 'vitest'
import type { NowPlaying } from './client'
import { LATE_MS, Witness, covered } from './witness'

const MIN = 60_000
const TINTAGEL = 15 * MIN

const np = (progressMs: number, isPlaying = true, trackId = 'tintagel', durationMs = TINTAGEL): NowPlaying =>
  ({ trackId, trackName: '', isPlaying, progressMs, durationMs })

/** Readings every `step` ms while the track plays from `from` to `to`, as the player watch takes them. */
function play(w: Witness, start: number, from: number, to: number, step = 15_000): { heard: string[]; at: number } {
  const heard: string[] = []
  let at = start
  for (let p = from; p < to; p += step, at += step) heard.push(...w.observe({ at, np: np(p) }))
  heard.push(...w.observe({ at, np: np(Math.min(to, TINTAGEL)) }))
  return { heard, at }
}

describe('the app as witness to a single track', () => {
  it('hears a track played end to end, ending paused at its close', () => {
    const w = new Witness()
    const { heard, at } = play(w, 0, 1_200, TINTAGEL - 8_000)
    expect(heard).toEqual([])
    expect(w.observe({ at: at + 9_000, np: np(TINTAGEL - 200, false) })).toEqual(['tintagel'])
  })

  it('hears it when Spotify stops at the end and rewinds to the start', () => {
    const w = new Witness()
    const { at } = play(w, 0, 1_200, TINTAGEL - 6_000)
    expect(w.observe({ at: at + 8_000, np: np(0, false) })).toEqual(['tintagel'])
  })

  it('hears it when the player moves on to something else right as it ends', () => {
    const w = new Witness()
    const { at } = play(w, 0, 1_200, TINTAGEL - 10_000)
    expect(w.observe({ at: at + 11_500, np: np(2_000, true, 'next-song', 3 * MIN) })).toEqual(['tintagel'])
  })

  it('hears it through a pause in the middle', () => {
    const w = new Witness()
    let { at } = play(w, 0, 1_200, 7 * MIN)
    // Paused for twenty minutes, then on again.
    w.observe({ at: at + 1_000, np: np(7 * MIN, false) })
    at += 20 * MIN
    w.observe({ at, np: np(7 * MIN, false) })
    const rest = play(w, at + 15_000, 7 * MIN + 15_000, TINTAGEL - 8_000)
    expect(rest.heard).toEqual([])
    expect(w.observe({ at: rest.at + 9_000, np: np(0, false) })).toEqual(['tintagel'])
  })

  it('hears it when the phone slept through the end and the page came back later', () => {
    const w = new Witness()
    // Pressed Play on the programme, watched the first half minute, then the screen went off.
    w.observe({ at: 0, np: np(1_200) })
    w.observe({ at: 15_000, np: np(16_200) })
    // An hour later, the page is back: Spotify holds the track at its start, paused.
    expect(w.observe({ at: 60 * MIN, np: np(0, false) })).toEqual(['tintagel'])
  })

  it('hears it when the page came back while it was still playing, then saw it out', () => {
    const w = new Witness()
    w.observe({ at: 0, np: np(1_200) })
    w.observe({ at: 9 * MIN, np: np(9 * MIN + 1_200) })
    const { at } = play(w, 9 * MIN + 15_000, 9 * MIN + 16_200, TINTAGEL - 8_000)
    expect(w.observe({ at: at + 9_000, np: np(TINTAGEL - 100, false) })).toEqual(['tintagel'])
  })

  it('does not hear a jump to the end', () => {
    const w = new Witness()
    w.observe({ at: 0, np: np(1_200) })
    w.observe({ at: 15_000, np: np(16_200) })
    const { heard, at } = play(w, 30_000, TINTAGEL - 60_000, TINTAGEL - 1_000)
    expect(heard).toEqual([])
    expect(w.observe({ at: at + 2_500, np: np(0, false) })).toEqual([])
  })

  it('does not hear a track begun halfway through', () => {
    const w = new Witness()
    const { at } = play(w, 0, 7 * MIN, TINTAGEL - 1_000)
    expect(w.observe({ at: at + 2_500, np: np(0, false) })).toEqual([])
  })

  it('does not hear a track left for another one partway', () => {
    const w = new Witness()
    const { at } = play(w, 0, 1_200, 6 * MIN)
    expect(w.observe({ at: at + 15_000, np: np(15_000, true, 'next-song', 3 * MIN) })).toEqual([])
  })

  it('does not credit the close when the page came back long after something else took over', () => {
    const w = new Witness()
    w.observe({ at: 0, np: np(1_200) })
    const late = TINTAGEL + LATE_MS + MIN
    expect(w.observe({ at: late, np: np(30_000, true, 'next-song', 3 * MIN) })).toEqual([])
  })

  it('does not hear it from a pause at the close that came too soon to be real', () => {
    const w = new Witness()
    w.observe({ at: 0, np: np(1_200) })
    // Five minutes later Spotify holds it at the start: it can't have played fifteen.
    expect(w.observe({ at: 5 * MIN, np: np(0, false) })).toEqual([])
  })

  it('hears a session once, and a second listening from the top again', () => {
    const w = new Witness()
    let { at } = play(w, 0, 1_200, TINTAGEL - 8_000)
    expect(w.observe({ at: at + 9_000, np: np(0, false) })).toEqual(['tintagel'])
    expect(w.observe({ at: at + 24_000, np: np(0, false) })).toEqual([])
    at += 30 * MIN
    const again = play(w, at, 1_200, TINTAGEL - 8_000)
    expect(again.heard).toEqual([])
    expect(w.observe({ at: again.at + 9_000, np: np(0, false) })).toEqual(['tintagel'])
  })

  it('keys a relinked track by the id the app asked for', () => {
    const w = new Witness()
    const relinked = (p: number, playing = true): NowPlaying => ({ ...np(p, playing, 'market-copy'), linkedFromId: 'tintagel' })
    let at = 0
    for (let p = 1_200; p < TINTAGEL; p += 15_000, at += 15_000) w.observe({ at, np: relinked(p) })
    expect(w.observe({ at: at + 2_000, np: relinked(0, false) })).toEqual(['tintagel'])
  })
})

describe('covered', () => {
  it('counts overlapping stretches once', () => {
    expect(covered([[0, 10], [5, 20], [30, 40]])).toBe(30)
    expect(covered([])).toBe(0)
  })
})
