import { describe, expect, it } from 'vitest'
import type { SongNote } from '../../engine'
import type { Sink } from '../studio/playback'
import { Accompanist } from './accompany'

const note = (pitch: number, startMs: number, durationMs = 400): SongNote => ({ id: pitch, pitch, startMs, durationMs, hand: 'left', bar: 0 })
function recorder() {
  const on: [number, number][] = []
  const off: [number, number][] = []
  let silenced = 0
  const sink: Sink = { noteOn: (p, _v, at) => on.push([p, at]), noteOff: (p, at) => off.push([p, at]), pedal() {}, silence: () => void silenced++ }
  return { sink, on, off, silenced: () => silenced }
}

describe('the other hand', () => {
  const left = [note(48, 0), note(55, 1000), note(52, 2000)]

  it('with a clock, hands each note over a little ahead, at its own moment and speed', () => {
    const r = recorder()
    const a = new Accompanist(r.sink, left, 0.5)
    a.tick(-1000, 10_000) // the count-in: nothing due yet
    expect(r.on).toEqual([])
    a.tick(-100, 10_000)
    expect(r.on).toEqual([[48, 10_200]]) // 100 song ms at half speed = 200 ms
    expect(r.off).toEqual([[48, 11_000]])
    a.tick(-100, 10_000) // asked again: not twice
    expect(r.on.length).toBe(1)
  })

  it('skips a note whose moment passed while paused, rather than playing it late', () => {
    const r = recorder()
    const a = new Accompanist(r.sink, left, 1)
    a.tick(1500, 5000)
    expect(r.on.map(([p]) => p)).toEqual([])
    a.tick(1900, 5400)
    expect(r.on).toEqual([[52, 5500]])
  })

  it('in “Wait for it”, plays up to her next step when she plays one, in the song’s rhythm', () => {
    const r = recorder()
    const a = new Accompanist(r.sink, left, 1)
    a.stepPlayed(0, 1500, 20_000)
    expect(r.on).toEqual([
      [48, 20_000],
      [55, 21_000],
    ])
    // She took her time over the next one: what's left sounds from now.
    a.stepPlayed(1500, Infinity, 30_000)
    expect(r.on.at(-1)).toEqual([52, 30_500])
  })

  it('knows its own notes coming back from the keyboard', () => {
    const r = recorder()
    const a = new Accompanist(r.sink, left, 1)
    a.stepPlayed(0, 500, 1000)
    expect(a.isEcho(48, 1030)).toBe(true)
    expect(a.isEcho(48, 1500)).toBe(false)
    expect(a.isEcho(60, 1030)).toBe(false)
    a.stop()
    expect(r.silenced()).toBe(1)
  })
})
