// Touch Grass's weather surface. The objective model — WMO code mapping,
// intensity, the Open-Meteo fetch — was promoted to `src/shared/weather.ts` so a
// second app can use it without importing from this folder. What stays here is
// what is *Touch Grass's own*: the prose. The words the Threshold speaks and the
// gentle "later today" descriptors are this app's voice, not a shared utility.
//
// This module's public API is unchanged, so every existing import still works.
import {
  conditionFromCode,
  intensityFromCode,
  parseWeather,
  parseToday as parseTodayNumbers,
  fetchWeather as fetchWeatherShared,
} from '../shared/weather.ts'

export { conditionFromCode, intensityFromCode, parseWeather }

// Brief, glanceable words for a condition (shared by the Threshold's current-sky
// line and the "kept under" note on a find).
export const CONDITION_WORDS = {
  clear: 'clear', 'partly-cloudy': 'a few clouds', overcast: 'overcast',
  fog: 'fog', rain: 'rain', snow: 'snow', thunder: 'storms',
}
export function weatherWord(condition) {
  return CONDITION_WORDS[condition] || condition
}

// Gentle, non-alarming descriptors for today's outlook.
export function buildAlerts({ code, maxWind, precipSum, precipProb }) {
  const out = []
  if (maxWind >= 50) out.push('blustery out there later')
  else if (maxWind >= 32) out.push('a breeze picks up later')
  const cond = conditionFromCode(code)
  if (cond === 'thunder') out.push('storms brewing')
  else if (cond === 'snow') out.push('snow on the way')
  else if ((precipProb ?? 0) >= 55 || (precipSum ?? 0) > 1.5) out.push('a chance of rain')
  else if (cond === 'fog') out.push('fog may settle in')
  return out
}

// Today's forecast, with Touch Grass's descriptors attached.
export function parseToday(daily) {
  const today = parseTodayNumbers(daily)
  if (!today) return null
  return { ...today, alerts: buildAlerts(today) }
}

export async function fetchWeather(coords) {
  const w = await fetchWeatherShared(coords)
  if (w.today) w.today = { ...w.today, alerts: buildAlerts(w.today) }
  return w
}
