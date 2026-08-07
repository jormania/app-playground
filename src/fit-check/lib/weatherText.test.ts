import { describe, it, expect } from 'vitest'
import { weatherLine, weatherSnapshot } from './weatherText.ts'
import type { CurrentWeather } from '../../shared/weather.ts'

const w = (over: Partial<CurrentWeather> = {}): CurrentWeather => ({
  condition: 'clear', intensity: 0, cloud: 0, wind: 0, temp: 18, precip: 0,
  isDay: true, code: 0, ...over,
})

describe('weatherLine', () => {
  it('reads as a sentence fragment', () => {
    expect(weatherLine(w({ temp: 18.4, condition: 'rain' }))).toBe('18°C and raining')
  })
  it('rounds the temperature', () => {
    expect(weatherLine(w({ temp: 18.6 }))).toContain('19°C')
  })
  it('falls back to the raw condition for anything unmapped', () => {
    expect(weatherLine(w({ condition: 'partly-cloudy' as never }))).toContain('a bit cloudy')
  })
  it('is empty without weather', () => expect(weatherLine(null)).toBe(''))
})

describe('weatherSnapshot', () => {
  it('matches the format documented on the Notion Weather property', () => {
    expect(weatherSnapshot(w({ temp: 8, condition: 'rain' }))).toBe('8°C, rain')
  })
  it('is empty without weather', () => expect(weatherSnapshot(null)).toBe(''))
})
