// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { DUSK_KEYS, applyDusk, chooseDusk, pickDusk, rememberDusk } from './theme'

describe('the listening view’s shades', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.listening
  })

  it('picks among the four at random, never the same shade twice running', () => {
    for (const last of DUSK_KEYS) {
      for (const r of [0, 0.3, 0.6, 0.99]) {
        const next = pickDusk(last, () => r)
        expect(DUSK_KEYS).toContain(next)
        expect(next).not.toBe(last)
      }
    }
  })

  it('marks the page with the shade, and clears it on leaving', () => {
    const shade = chooseDusk()
    const leave = applyDusk(shade)
    expect(document.documentElement.dataset.listening).toBe(shade)
    leave()
    expect(document.documentElement.dataset.listening).toBeUndefined()
  })

  it('chooses without side effects, and the next visit differs from the one remembered', () => {
    const first = chooseDusk()
    expect(localStorage.getItem('long-listen:dusk-last')).toBeNull()
    rememberDusk(first)
    for (let i = 0; i < 10; i++) expect(chooseDusk()).not.toBe(first)
  })

  it('clears the old shown-and-liked tally', () => {
    localStorage.setItem('long-listen:dusk-tally', JSON.stringify({ wine: { shown: 3, liked: 1 } }))
    rememberDusk('wine')
    expect(localStorage.getItem('long-listen:dusk-tally')).toBeNull()
  })
})
