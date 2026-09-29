import { describe, expect, it } from 'vitest'
import { EAR_ROUND, EarTrain, MAX_TRIES, questionFor, targetsFor } from './earTrain'

const seeded = (seed = 1) => () => (seed = (seed * 16807) % 2147483647) / 2147483647

describe('what a level asks', () => {
  it('level 1: a neighbouring white key; level 2: up to four along; level 3: any key within an octave', () => {
    expect(targetsFor(1, 64)).toEqual([60, 62, 65, 67])
    expect(targetsFor(2, 60)).toEqual([62, 64, 65, 67])
    const l3 = targetsFor(3, 60)
    expect(l3).toContain(61) // a black key
    expect(l3).toContain(72)
    expect(l3).not.toContain(60)
    expect(Math.min(...l3)).toBe(55)
  })

  it('never asks the same question twice running, and keeps both notes on the screen’s keys', () => {
    const rnd = seeded(7)
    let prev = null as ReturnType<typeof questionFor> | null
    for (let i = 0; i < 200; i++) {
      const q = questionFor(3, rnd, prev)
      if (prev) expect(q).not.toEqual(prev)
      expect(q.root).not.toBe(q.target)
      expect(q.target).toBeGreaterThanOrEqual(55)
      expect(q.target).toBeLessThanOrEqual(72)
      prev = q
    }
  })
})

describe('a round', () => {
  const round = (level = 1 as const) => new EarTrain(level, seeded(3))

  it('scores a point for each found first time, in any octave', () => {
    const g = round()
    expect(g.press(g.current.target + 12)).toBe('right')
    expect(g.score).toBe(1)
    expect(g.isResolved).toBe(true)
    // Ignored until next(): a second press of the answer doesn't score twice.
    expect(g.press(g.current.target)).toBeNull()
    g.next()
    expect(g.number).toBe(2)
    expect(g.isResolved).toBe(false)
  })

  it('says which way after a wrong key, and gives no point for a later find', () => {
    const g = round()
    const target = g.current.target
    const above = target + 3
    expect(g.press(above)).toBe('wrong')
    expect(g.hint).toBe('lower')
    expect(g.press(target)).toBe('right')
    expect(g.score).toBe(0)
    expect(g.wrong).toBe(1)
    g.next()
    expect(g.hint).toBeNull()
  })

  it('gives up after three tries, showing the answer, and carries on', () => {
    const g = round()
    const target = g.current.target
    const wrong = [1, 2, 3].map((d) => target + d)
    const outcomes = wrong.slice(0, MAX_TRIES).map((p) => g.press(p))
    expect(outcomes).toEqual(['wrong', 'wrong', 'missed'])
    expect(g.isResolved).toBe(true)
    g.next()
    expect(g.number).toBe(2)
  })

  it('ends after five questions', () => {
    const g = round()
    for (let i = 0; i < EAR_ROUND; i++) {
      expect(g.finished).toBe(false)
      g.press(g.current.target)
      g.next()
    }
    expect(g.finished).toBe(true)
    expect(g.score).toBe(EAR_ROUND)
    expect(g.press(60)).toBeNull()
  })
})
