import { describe, it, expect } from 'vitest'
import { weekAdjusted } from './validate.js'

describe('weekAdjusted — this week, differently', () => {
  const prefs = { timePerWeek: 'generous', breadth: 3, familiarity: 3, pairs: false }

  it('moves each preference one step for the week, and leaves the rest', () => {
    expect(weekAdjusted(prefs, ['shorter'])).toMatchObject({ timePerWeek: 'standard', breadth: 3, familiarity: 3 })
    expect(weekAdjusted(prefs, ['wider', 'familiar'])).toMatchObject({ timePerWeek: 'generous', breadth: 4, familiarity: 2 })
    expect(weekAdjusted(prefs, ['quieter'])).toEqual(prefs)
  })

  it('stops at the ends of each scale', () => {
    expect(weekAdjusted({ timePerWeek: 'short', breadth: 5, familiarity: 1 }, ['shorter', 'wider', 'familiar'])).toMatchObject({ timePerWeek: 'short', breadth: 5, familiarity: 1 })
    expect(weekAdjusted(prefs, undefined)).toEqual(prefs)
  })
})
