import { describe, expect, it } from 'vitest'
import { Judge, DEFAULT_SETTINGS } from '../../engine'
import { starterSong, STARTER_PACK } from '../../engine/starterPack'
import { afterPass, barSong, isClean, startLoop, tempoOf } from './loop'

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
