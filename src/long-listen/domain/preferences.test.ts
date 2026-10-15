import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFERENCES, inLanguage, normalisePreferences, type ListenerPreferences } from './types'

describe('preferences as stored, brought up to date', () => {
  it('keeps every real value as it is', () => {
    const mine: ListenerPreferences = { ...DEFAULT_PREFERENCES, timePerWeek: 'short', breadth: 5, familiarity: 1, pairs: true, depth: 'deeper', recordingEra: 'period-practice', includeVoices: false, includeConcertos: false, language: 'ro', nextRequest: 'more Sibelius' }
    expect(normalisePreferences(mine)).toEqual(mine)
  })

  it('gives anything missing or unknown its default — a hand-edited file or an old backup never puts undefined into a prompt', () => {
    const odd = { depth: 'verbose', recordingEra: 'vintage', language: 'fr', includeVoices: 'yes', includeConcertos: undefined, nextRequest: 3, breadth: 9, timePerWeek: 'forever' } as unknown as Partial<ListenerPreferences>
    expect(normalisePreferences(odd)).toEqual({ ...DEFAULT_PREFERENCES, breadth: DEFAULT_PREFERENCES.breadth })
    expect(normalisePreferences(undefined)).toEqual(DEFAULT_PREFERENCES)
  })

  it('reads the old three-step adventure as a familiarity level', () => {
    expect(normalisePreferences({ adventure: 'gentle' } as never).familiarity).toBe(2)
    expect(normalisePreferences({ adventure: 'bold' } as never).familiarity).toBe(4)
  })
})

describe('written in the language the curator writes in now', () => {
  it('counts a note written before the language was kept as English, and one in another language as not yet written', () => {
    expect(inLanguage({}, 'en')).toBe(true)
    expect(inLanguage({}, 'ro')).toBe(false)
    expect(inLanguage({ language: 'ro' }, 'ro')).toBe(true)
    expect(inLanguage({ language: 'ro' }, 'en')).toBe(false)
    expect(inLanguage(undefined, 'en')).toBe(false)
  })
})
