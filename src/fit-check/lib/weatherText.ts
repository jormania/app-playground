import type { CurrentWeather } from '../../shared/weather.ts'

/**
 * A short snapshot stored on an outfit record, e.g. "18°C, rain" — the raw
 * condition slug rather than prose, so a future reader (or a future feature)
 * can parse it back out if it ever needs to. Kept as plain text on the row so
 * History reads without a second lookup or a weather-API replay.
 *
 * The *prose* for a sky lives in `lib/weatherVisual.ts` alongside the icon it's
 * shown with — there used to be a second copy of those words here, feeding a
 * `weatherLine()` that the Today screen stopped using once the weather card
 * replaced it. Two lists of words for the same seven conditions is precisely
 * how they end up disagreeing, so this file no longer keeps one.
 */
export function weatherSnapshot(weather: CurrentWeather | null): string {
  if (!weather) return ''
  return `${Math.round(weather.temp ?? 0)}°C, ${weather.condition}`
}
