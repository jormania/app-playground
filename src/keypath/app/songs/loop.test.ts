import { describe, expect, it } from 'vitest'
import { Judge, DEFAULT_SETTINGS } from '../../engine'
import { starterSong, STARTER_PACK } from '../../engine/starterPack'
import { afterPass, barSong, isClean, startLoop, stretchEnd, tempoOf, nearestPlayable, playableBars } from './loop'

const ode = starterSong(STARTER_PACK.find((s) => s.id === 'starter:ode')!)

describe('practising one bar', () => {
  it('takes the bar’s notes alone, from 0, keeping their ids and fingers', () => {
    const bar = barSong(ode, 1)!
    const original = ode.notes.filter((n) => n.bar === 1)
    expect(bar.notes.map((n) => n.id)).toEqual(original.map((n) => n.id))
    expect(Math.min(...bar.notes.map((n) => n.startMs))).toBe(0)
    expect(bar.notes.map((n) => n.pitch)).toEqual(original.map((n) => n.pitch))
    expect(bar.notes.every((n) => n.finger)).toBe(true)
    expect(barSong(ode, 99)).toBeNull()
  })

  it('climbs 50 → 75 → 100%, one clean pass a rung, and an unclean pass stays put', () => {
    let loop = startLoop(4, 'running', 1)
    expect(loop.rungs).toEqual([0.5, 0.75, 1])
    let r = afterPass(loop, false)
    expect(r.step).toBe('again')
    expect(tempoOf(r.loop)).toBe(0.5)
    r = afterPass(r.loop, true)
    expect([r.step, tempoOf(r.loop)]).toEqual(['up', 0.75])
    r = afterPass(r.loop, true)
    expect([r.step, tempoOf(r.loop)]).toEqual(['up', 1])
    loop = r.loop
    r = afterPass(loop, true)
    expect(r.step).toBe('done')
    expect(r.loop.passes).toBe(4)
  })

  it('never climbs past the speed she played the song at', () => {
    expect(startLoop(0, 'running', 0.75).rungs).toEqual([0.5, 0.75])
    expect(startLoop(0, 'running', 0.5).rungs).toEqual([0.5])
  })

  it('in “Wait for it” there is no clock to speed up: one clean pass finishes it', () => {
    const loop = startLoop(2, 'wait', 1)
    expect(loop.rungs).toEqual([1])
    expect(afterPass(loop, true).step).toBe('done')
  })

  it('counts a pass clean only with every note played and no wrong key', () => {
    const bar = barSong(ode, 0)!
    const settings = { ...DEFAULT_SETTINGS, onWrong: 'wait' as const }
    const play = (wrongFirst: boolean) => {
      const j = new Judge(bar, { practice: 'right', settings })
      let t = 0
      if (wrongFirst) j.press(30, t)
      while (j.currentStep) for (const n of j.currentStep.notes) j.press(n.pitch, (t += 400))
      return j.summary()
    }
    expect(isClean(play(false))).toBe(true)
    expect(isClean(play(true))).toBe(false)
  })
})

describe('the bars there is something to practise in', () => {
  it('offers only bars a note starts in, for the hands played, and never the pickup alone', () => {
    // Bars 0 (a pickup), 1, 3: bar 2 is a rest (or a note tied over).
    const notes = [{ bar: 0 }, { bar: 1 }, { bar: 1 }, { bar: 3 }]
    expect(playableBars(notes, true)).toEqual([1, 3])
    expect(playableBars(notes)).toEqual([0, 1, 3])
    // A song that is all pickup still has its one bar.
    expect(playableBars([{ bar: 0 }], true)).toEqual([0])
  })

  it('moves a bar asked for that has nothing in it to the next one that has', () => {
    expect(nearestPlayable([1, 3], 2)).toBe(3)
    expect(nearestPlayable([1, 3], 9)).toBe(3)
    expect(nearestPlayable([1, 3], 0)).toBe(1)
    expect(nearestPlayable([], 0)).toBeNull()
  })
})

describe('practising a stretch of bars', () => {
  it('takes bars from one to another, from 0, and climbs the same ladder', () => {
    const two = barSong(ode, 1, 3)!
    const original = ode.notes.filter((n) => n.bar === 1 || n.bar === 2)
    expect(two.notes.map((n) => n.id)).toEqual(original.map((n) => n.id))
    expect(Math.min(...two.notes.map((n) => n.startMs))).toBe(0)
    expect(two.id).not.toBe(barSong(ode, 1)!.id)
    const loop = startLoop(1, 'running', 1, 3)
    expect(loop).toMatchObject({ bar: 1, to: 3, rungs: [0.5, 0.75, 1] })
    // One bar is a stretch of one; an end before the start is read as one bar.
    expect(startLoop(4, 'wait', 1)).toMatchObject({ bar: 4, to: 5 })
    expect(startLoop(4, 'wait', 1, 2)).toMatchObject({ bar: 4, to: 5 })
  })

  it('ends a stretch on a bar with notes, never before its start', () => {
    const playable = [1, 2, 4, 5]
    expect(stretchEnd(playable, 2, 2)).toBe(2)
    expect(stretchEnd(playable, 2, 3)).toBe(4) // 3 is empty: the next bar with notes
    expect(stretchEnd(playable, 4, 1)).toBe(4) // the start moved past the end: the end follows
    expect(stretchEnd(playable, 2, 9)).toBe(5)
  })
})
