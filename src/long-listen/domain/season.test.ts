import { describe, it, expect } from 'vitest'
import { addWeeks, season, seasonName, seasonNumberAt } from './season'

describe('seasons of twelve weeks', () => {
  it('counts twelve weeks from the first, across a year', () => {
    const s = season('2026-W41', 1, '2026-W43')
    expect(s.weekKeys[0]).toBe('2026-W41')
    expect(s.weekKeys[11]).toBe('2026-W52')
    expect(s.label).toBe('5 October – 27 December 2026')
    expect(s.complete).toBe(false)
    expect(s.weeksSoFar).toBe(3)
    const two = season('2026-W41', 2, '2027-W03')
    expect(two.weekKeys[0]).toBe('2026-W53')
    expect(two.label).toBe('28 December 2026 – 21 March 2027')
  })

  it('is complete once its last week is over', () => {
    expect(season('2026-W41', 1, '2026-W52').complete).toBe(false)
    expect(season('2026-W41', 1, '2026-W53').complete).toBe(true)
  })

  it('knows which season a week is in, and names it', () => {
    expect(seasonNumberAt('2026-W41', '2026-W41')).toBe(1)
    expect(seasonNumberAt('2026-W41', '2026-W52')).toBe(1)
    expect(seasonNumberAt('2026-W41', addWeeks('2026-W41', 12))).toBe(2)
    expect(seasonName(1)).toBe('Season one')
  })
})
