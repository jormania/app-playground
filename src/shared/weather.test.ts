import { test, expect, describe } from 'vitest'
import { conditionFromCode, intensityFromCode, parseWeather, parseToday } from './weather.ts'

describe('conditionFromCode', () => {
  test('0 → clear', () => expect(conditionFromCode(0)).toBe('clear'))
  test('1 → partly-cloudy', () => expect(conditionFromCode(1)).toBe('partly-cloudy'))
  test('3 → overcast', () => expect(conditionFromCode(3)).toBe('overcast'))
  test('45 → fog', () => expect(conditionFromCode(45)).toBe('fog'))
  test('61 → rain', () => expect(conditionFromCode(61)).toBe('rain'))
  test('75 → snow', () => expect(conditionFromCode(75)).toBe('snow'))
  test('95 → thunder', () => expect(conditionFromCode(95)).toBe('thunder'))
  test('unknown code falls back to cloud cover', () => {
    expect(conditionFromCode(123, 0.9)).toBe('overcast')
    expect(conditionFromCode(123, 0.4)).toBe('partly-cloudy')
    expect(conditionFromCode(123, 0.1)).toBe('clear')
  })
  test('missing code falls back to cloud cover too', () => {
    expect(conditionFromCode(undefined, 0.9)).toBe('overcast')
    expect(conditionFromCode(undefined)).toBe('clear')
  })
})

describe('intensityFromCode', () => {
  test('heavy rain > light rain', () =>
    expect(intensityFromCode(65)).toBeGreaterThan(intensityFromCode(61)))
  test('clear has zero intensity', () => expect(intensityFromCode(0)).toBe(0))
  test('missing code has zero intensity', () => expect(intensityFromCode(undefined)).toBe(0))
})

describe('parseWeather', () => {
  test('maps an Open-Meteo current object', () => {
    const w = parseWeather({
      weather_code: 63, cloud_cover: 90, wind_speed_10m: 18,
      temperature_2m: 7, precipitation: 1.2, is_day: 1,
    })
    expect(w.condition).toBe('rain')
    expect(w.cloud).toBeCloseTo(0.9)
    expect(w.wind).toBe(18)
    expect(w.temp).toBe(7)
    expect(w.isDay).toBe(true)
    expect(w.intensity).toBeGreaterThan(0)
  })
  test('absent optional fields fall back rather than throwing', () => {
    const w = parseWeather({ weather_code: 0 })
    expect(w.condition).toBe('clear')
    expect(w.temp).toBe(null)
    expect(w.wind).toBe(0)
    expect(w.isDay).toBe(false)
  })
})

describe('parseToday', () => {
  test('maps the daily arrays to numbers only — no prose', () => {
    const t = parseToday({
      temperature_2m_max: [27], temperature_2m_min: [15], weather_code: [61],
      wind_speed_10m_max: [12], precipitation_sum: [3], precipitation_probability_max: [80],
    })
    expect(t?.high).toBe(27)
    expect(t?.low).toBe(15)
    expect(t?.condition).toBe('rain')
    expect(t?.precipProb).toBe(80)
    // The shared model stays objective; Touch Grass's `alerts` are layered on
    // by its own wrapper, not here.
    expect(t).not.toHaveProperty('alerts')
  })
  test('returns null without data', () => expect(parseToday(null)).toBe(null))
})
