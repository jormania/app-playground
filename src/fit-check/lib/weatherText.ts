import type { CurrentWeather } from '../../shared/weather.ts'

/**
 * Fit Check's own words for a sky — plain and short, for the Today screen and
 * for what gets written to an outfit's history row. Touch Grass keeps its own
 * voice (`CONDITION_WORDS` in its weather.js wrapper); this is deliberately not
 * shared, since the words are this app's writing, not a shared utility.
 */
export const SKY_WORDS: Record<string, string> = {
  clear: 'clear', 'partly-cloudy': 'a bit cloudy', overcast: 'grey',
  fog: 'foggy', rain: 'raining', snow: 'snowing', thunder: 'stormy',
}

/** One line for the Today screen, e.g. "18°C and raining." (no trailing period —
 *  callers that want one add it, so this stays reusable as a fragment). */
export function weatherLine(weather: CurrentWeather | null): string {
  if (!weather) return ''
  return `${Math.round(weather.temp ?? 0)}°C and ${SKY_WORDS[weather.condition] ?? weather.condition}`
}

/**
 * A short snapshot stored on an outfit record, e.g. "18°C, rain" — the raw
 * condition slug rather than the prose, so a future reader (or a future
 * feature) can parse it back out if it ever needs to. Kept as plain text on
 * the row so History reads without a second lookup or a weather-API replay.
 */
export function weatherSnapshot(weather: CurrentWeather | null): string {
  if (!weather) return ''
  return `${Math.round(weather.temp ?? 0)}°C, ${weather.condition}`
}
