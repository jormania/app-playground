// Weather model + Open-Meteo fetch. The mappers are pure (and unit-tested);
// only fetchWeather touches the network.
//
// Normalized condition: 'clear' | 'partly-cloudy' | 'overcast' | 'fog'
//                     | 'rain' | 'snow' | 'thunder'

const RAIN_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]
const SNOW_CODES = [71, 73, 75, 77, 85, 86]
const THUNDER_CODES = [95, 96, 99]
const FOG_CODES = [45, 48]

// WMO code → precipitation/storm intensity (0..1); 0 when not precipitating
const INTENSITY = {
  51: 0.30, 53: 0.45, 55: 0.60, 56: 0.40, 57: 0.55,
  61: 0.40, 63: 0.60, 65: 0.85, 66: 0.50, 67: 0.70,
  80: 0.45, 81: 0.65, 82: 0.90,
  71: 0.40, 73: 0.60, 75: 0.85, 77: 0.50, 85: 0.50, 86: 0.80,
  95: 0.70, 96: 0.85, 99: 0.95,
}

// Map a WMO weather code (+ cloud fraction as a tiebreaker) to a condition.
export function conditionFromCode(code, cloudFraction = 0) {
  if (THUNDER_CODES.includes(code)) return 'thunder'
  if (SNOW_CODES.includes(code)) return 'snow'
  if (RAIN_CODES.includes(code)) return 'rain'
  if (FOG_CODES.includes(code)) return 'fog'
  if (code === 3) return 'overcast'
  if (code === 1 || code === 2) return 'partly-cloudy'
  if (code === 0) return 'clear'
  // unknown code → fall back to cloud cover
  if (cloudFraction >= 0.8) return 'overcast'
  if (cloudFraction >= 0.25) return 'partly-cloudy'
  return 'clear'
}

export function intensityFromCode(code) {
  return INTENSITY[code] ?? 0
}

// Turn an Open-Meteo `current` object into our normalized model.
export function parseWeather(current) {
  const code = current.weather_code
  const cloud = (current.cloud_cover ?? 0) / 100
  return {
    condition: conditionFromCode(code, cloud),
    intensity: intensityFromCode(code),
    cloud,
    wind: current.wind_speed_10m ?? 0,
    temp: current.temperature_2m ?? null,
    precip: current.precipitation ?? 0,
    isDay: current.is_day === 1,
    code,
  }
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

// Today's forecast from the Open-Meteo `daily` arrays (index 0 = today).
export function parseToday(daily) {
  if (!daily || !daily.weather_code) return null
  const at = (k) => Array.isArray(daily[k]) ? daily[k][0] : undefined
  const code = at('weather_code')
  const maxWind = at('wind_speed_10m_max')
  const precipSum = at('precipitation_sum')
  const precipProb = at('precipitation_probability_max')
  return {
    high: at('temperature_2m_max'),
    low: at('temperature_2m_min'),
    code,
    condition: conditionFromCode(code),
    maxWind, precipSum, precipProb,
    alerts: buildAlerts({ code, maxWind, precipSum, precipProb }),
  }
}

export async function fetchWeather(coords) {
  const current = 'temperature_2m,weather_code,cloud_cover,wind_speed_10m,precipitation,is_day'
  const daily = 'temperature_2m_max,temperature_2m_min,weather_code,wind_speed_10m_max,precipitation_sum,precipitation_probability_max'
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}`
    + `&current=${current}&daily=${daily}&timezone=auto&forecast_days=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`weather ${res.status}`)
  const data = await res.json()
  if (!data || !data.current) throw new Error('weather: no current data')
  const w = parseWeather(data.current)
  w.today = parseToday(data.daily)
  return w
}
