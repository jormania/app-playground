// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { DUSK_KEYS, applyDusk, chooseDusk, duskTally, likeDusk, pickDusk, recordDusk } from './theme'

describe('the listening view’s shades', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.listening
  })

  it('rotates among the four, never showing the same shade twice running', () => {
    for (const last of DUSK_KEYS) {
      for (const r of [0, 0.3, 0.6, 0.99]) {
        const next = pickDusk('rotate', last, () => r)
        expect(DUSK_KEYS).toContain(next)
        expect(next).not.toBe(last)
      }
    }
  })

  it('keeps to a chosen shade', () => {
    expect(pickDusk('slate', 'slate')).toBe('slate')
  })

  it('marks the page with the shade, counts it, and clears on leaving', () => {
    const shade = chooseDusk('wine')
    expect(shade).toBe('wine')
    recordDusk(shade, 'rotate')
    const leave = applyDusk(shade)
    expect(document.documentElement.dataset.listening).toBe('wine')
    likeDusk('wine')
    expect(duskTally().wine).toEqual({ shown: 1, liked: 1 })
    expect(duskTally().umber).toEqual({ shown: 0, liked: 0 })
    leave()
    expect(document.documentElement.dataset.listening).toBeUndefined()
  })

  it('chooses without side effects, and the next visit differs from the one recorded', () => {
    const first = chooseDusk('rotate')
    expect(duskTally()[first].shown).toBe(0)
    recordDusk(first, 'rotate')
    for (let i = 0; i < 10; i++) expect(chooseDusk('rotate')).not.toBe(first)
  })
})
