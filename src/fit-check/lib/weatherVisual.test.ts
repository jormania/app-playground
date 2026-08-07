import { describe, it, expect } from 'vitest'
import { WEATHER_VISUALS, weatherVisual, temperatureWord } from './weatherVisual.ts'
import { targetWarmth } from './recommend.ts'
import type { Condition } from '../../shared/weather.ts'

const ALL: Condition[] = [
  'clear', 'partly-cloudy', 'overcast', 'fog', 'rain', 'snow', 'thunder',
]

describe('WEATHER_VISUALS', () => {
  it('covers every condition the weather module can produce', () => {
    for (const c of ALL) expect(WEATHER_VISUALS[c]).toBeDefined()
  })

  it('gives every condition an icon and words', () => {
    for (const c of ALL) {
      expect(WEATHER_VISUALS[c].icon).toBeTruthy()
      expect(WEATHER_VISUALS[c].words).toBeTruthy()
    }
  })

  it('does not reuse one icon for two different skies', () => {
    // Rain and snow reading identically would be a genuinely misleading glance.
    const icons = ALL.map((c) => WEATHER_VISUALS[c].icon)
    expect(new Set(icons).size).toBe(icons.length)
  })
})

describe('weatherVisual', () => {
  it('returns the mapped look', () => {
    expect(weatherVisual('rain').icon).toBe('cloud-rain')
  })

  it('falls back to a neutral sky rather than rendering nothing', () => {
    expect(weatherVisual(null).icon).toBe('cloud')
    expect(weatherVisual(undefined).icon).toBe('cloud')
    expect(weatherVisual('nonsense' as Condition).icon).toBe('cloud')
  })
})

describe('temperatureWord', () => {
  it('describes the range', () => {
    expect(temperatureWord(31)).toBe('hot')
    expect(temperatureWord(24)).toBe('warm')
    expect(temperatureWord(16)).toBe('mild')
    expect(temperatureWord(8)).toBe('chilly')
    expect(temperatureWord(-2)).toBe('cold')
  })

  it('says nothing without a temperature', () => {
    expect(temperatureWord(null)).toBe('')
  })

  it('agrees with the warmth the recommender is actually aiming for', () => {
    // The word on screen and the recommender's target must not disagree —
    // "warm" on screen while it scores for Light clothing would be confusing.
    expect(targetWarmth(24)).toBe('Light')   // warm/hot
    expect(targetWarmth(31)).toBe('Light')
    expect(targetWarmth(16)).toBe('Mid')     // mild
    expect(targetWarmth(8)).toBe('Warm')     // chilly/cold
    expect(targetWarmth(-2)).toBe('Warm')
  })

  it('switches word exactly where targetWarmth switches band', () => {
    // 22 and 12 are the boundaries in recommend.ts; drifting them apart here
    // is the failure this guards.
    expect(temperatureWord(22)).toBe('warm')
    expect(temperatureWord(21)).toBe('mild')
    expect(temperatureWord(12)).toBe('mild')
    expect(temperatureWord(11)).toBe('chilly')
  })
})
