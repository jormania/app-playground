import { test, expect, describe } from 'vitest'
import { conditionFromCode, intensityFromCode, parseWeather } from './weather.js'

describe('conditionFromCode', () => {
  test('0 → clear', () => expect(conditionFromCode(0)).toBe('clear'))
  test('1 → partly-cloudy', () => expect(conditionFromCode(1)).toBe('partly-cloudy'))
  test('2 → partly-cloudy', () => expect(conditionFromCode(2)).toBe('partly-cloudy'))
  test('3 → overcast', () => expect(conditionFromCode(3)).toBe('overcast'))
  test('45 → fog', () => expect(conditionFromCode(45)).toBe('fog'))
  test('48 → fog', () => expect(conditionFromCode(48)).toBe('fog'))
  test('61 → rain', () => expect(conditionFromCode(61)).toBe('rain'))
  test('82 → rain (violent showers)', () => expect(conditionFromCode(82)).toBe('rain'))
  test('75 → snow', () => expect(conditionFromCode(75)).toBe('snow'))
  test('86 → snow (showers)', () => expect(conditionFromCode(86)).toBe('snow'))
  test('95 → thunder', () => expect(conditionFromCode(95)).toBe('thunder'))
  test('99 → thunder (hail)', () => expect(conditionFromCode(99)).toBe('thunder'))
  test('unknown code falls back to cloud cover', () => {
    expect(conditionFromCode(123, 0.9)).toBe('overcast')
    expect(conditionFromCode(123, 0.4)).toBe('partly-cloudy')
    expect(conditionFromCode(123, 0.1)).toBe('clear')
  })
})

describe('intensityFromCode', () => {
  test('heavy rain > light rain', () => expect(intensityFromCode(65)).toBeGreaterThan(intensityFromCode(61)))
  test('clear has zero intensity', () => expect(intensityFromCode(0)).toBe(0))
  test('thunder with hail is strongest', () => expect(intensityFromCode(99)).toBeGreaterThan(intensityFromCode(95)))
})

describe('parseWeather', () => {
  test('maps an Open-Meteo current object', () => {
    const w = parseWeather({
      weather_code: 63, cloud_cover: 90, wind_speed_10m: 18, temperature_2m: 7, precipitation: 1.2, is_day: 1,
    })
    expect(w.condition).toBe('rain')
    expect(w.cloud).toBeCloseTo(0.9)
    expect(w.wind).toBe(18)
    expect(w.temp).toBe(7)
    expect(w.isDay).toBe(true)
    expect(w.intensity).toBeGreaterThan(0)
  })
  test('clear day', () => {
    const w = parseWeather({ weather_code: 0, cloud_cover: 5, wind_speed_10m: 3, temperature_2m: 24, precipitation: 0, is_day: 1 })
    expect(w.condition).toBe('clear')
    expect(w.intensity).toBe(0)
  })
})
