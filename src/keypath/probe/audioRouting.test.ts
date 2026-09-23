import { describe, expect, it } from 'vitest'
import { adviceFor } from './audioRouting'

describe('adviceFor', () => {
  it('gives the keyboard-side and phone-side fixes when audio went to the Yamaha', () => {
    const a = adviceFor('keyboard')
    expect(a.steps.join(' ')).toContain('045')
    expect(a.steps.join(' ')).toContain('Disable USB audio routing')
  })

  it('has advice for every answer', () => {
    for (const heard of ['keyboard', 'phone', 'both', 'nowhere'] as const) {
      expect(adviceFor(heard).headline).toBeTruthy()
    }
  })
})
