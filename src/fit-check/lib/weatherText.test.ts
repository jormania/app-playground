import { describe, it, expect } from 'vitest'
import { weatherSnapshot } from './weatherText.ts'
import type { CurrentWeather } from '../../shared/weather.ts'

const w = (over: Partial<CurrentWeather> = {}): CurrentWeather => ({
  condition: 'clear', intensity: 0, cloud: 0, wind: 0, temp: 18, precip: 0,
  isDay: true, code: 0, ...over,
})

describe('weatherSnapshot', () => {
  it('matches the format documented on the Notion Weather property', () => {
    expect(weatherSnapshot(w({ temp: 8, condition: 'rain' }))).toBe('8°C, rain')
  })

  it('rounds the temperature', () => {
    expect(weatherSnapshot(w({ temp: 18.6 }))).toContain('19°C')
  })

  it('keeps the raw condition slug, not the prose', () => {
    // Deliberate: the stored value should stay parseable, and the display words
    // live in weatherVisual.ts next to the icon they're shown with.
    expect(weatherSnapshot(w({ condition: 'partly-cloudy' }))).toBe('18°C, partly-cloudy')
  })

  it('is empty without weather', () => expect(weatherSnapshot(null)).toBe(''))
})
