// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { chooseDusk, duskTally, recordDusk } from '../app/theme'

describe('the dusk tally', () => {
  beforeEach(() => localStorage.clear())

  it('counts a shade shown only while rotating: a shade kept on purpose is not a vote for itself', () => {
    recordDusk(chooseDusk('wine'), 'wine')
    expect(duskTally().wine.shown).toBe(0)
    const shade = chooseDusk('rotate')
    recordDusk(shade, 'rotate')
    expect(duskTally()[shade].shown).toBe(1)
  })
})
