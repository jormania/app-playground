// Shared weather model + Open-Meteo fetch. Promoted out of src/touch-grass/ so a
// second app could use it without reaching into another app's folder (the same
// move that produced src/shared/notify/). Touch Grass keeps its own weather.js as
// a thin wrapper that re-exports these and layers its own prose on top — the
// objective model lives here, the voice stays with the app that speaks it.
//
// The mappers are pure (and unit-tested); only fetchWeather touches the network.

export type Condition =
  | 'clear' | 'partly-cloudy' | 'overcast' | 'fog' | 'rain' | 'snow' | 'thunder'

export interface Coords {
  lat: number
  lon: number
}

/** Normalized "right now" reading. */
export interface CurrentWeather {
  condition: Condition
  /** Precipitation/storm intensity, 0..1; 0 when not precipitating. */
  intensity: number
  /** Cloud cover as a fraction, 0..1. */
  cloud: number
  /** Wind speed at 10m, km/h. */
  wind: number
  /** Temperature in °C, or null when the feed omits it. */
  temp: number | null
  precip: number
  isDay: boolean
  code: number
  today?: TodayForecast | null
}

/** Today's outlook, from the `daily` arrays (index 0). */
export interface TodayForecast {
  high: number | undefined
  low: number | undefined
  code: number | undefined
  condition: Condition
  maxWind: number | undefined
  precipSum: number | undefined
  precipProb: number | undefined
}

/** Shape of Open-Meteo's `current` object for the fields we request. */
export interface OpenMeteoCurrent {
  weather_code: number
  cloud_cover?: number
  wind_speed_10m?: number
  temperature_2m?: number
  precipitation?: number
  is_day?: number
}

/** Shape of Open-Meteo's `daily` object — parallel arrays, index 0 = today. */
export interface OpenMeteoDaily {
  weather_code?: number[]
  temperature_2m_max?: number[]
  temperature_2m_min?: number[]
  wind_speed_10m_max?: number[]
  precipitation_sum?: number[]
  precipitation_probability_max?: number[]
}

const RAIN_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]
const SNOW_CODES = [71, 73, 75, 77, 85, 86]
const THUNDER_CODES = [95, 96, 99]
const FOG_CODES = [45, 48]

// WMO code → precipitation/storm intensity (0..1); 0 when not precipitating
const INTENSITY: Record<number, number> = {
  51: 0.30, 53: 0.45, 55: 0.60, 56: 0.40, 57: 0.55,
  61: 0.40, 63: 0.60, 65: 0.85, 66: 0.50, 67: 0.70,
  80: 0.45, 81: 0.65, 82: 0.90,
  71: 0.40, 73: 0.60, 75: 0.85, 77: 0.50, 85: 0.50, 86: 0.80,
  95: 0.70, 96: 0.85, 99: 0.95,
}

// Map a WMO weather code (+ cloud fraction as a tiebreaker) to a condition.
export function conditionFromCode(code: number | undefined, cloudFraction = 0): Condition {
  if (code !== undefined) {
    if (THUNDER_CODES.includes(code)) return 'thunder'
    if (SNOW_CODES.includes(code)) return 'snow'
    if (RAIN_CODES.includes(code)) return 'rain'
    if (FOG_CODES.includes(code)) return 'fog'
    if (code === 3) return 'overcast'
    if (code === 1 || code === 2) return 'partly-cloudy'
    if (code === 0) return 'clear'
  }
  // unknown code → fall back to cloud cover
  if (cloudFraction >= 0.8) return 'overcast'
  if (cloudFraction >= 0.25) return 'partly-cloudy'
  return 'clear'
}

export function intensityFromCode(code: number | undefined): number {
  if (code === undefined) return 0
  return INTENSITY[code] ?? 0
}

// Turn an Open-Meteo `current` object into our normalized model.
export function parseWeather(current: OpenMeteoCurrent): CurrentWeather {
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

// Today's forecast from the Open-Meteo `daily` arrays (index 0 = today).
// Numbers only — any prose about them belongs to the consuming app.
export function parseToday(daily: OpenMeteoDaily | null | undefined): TodayForecast | null {
  if (!daily || !daily.weather_code) return null
  const at = <K extends keyof OpenMeteoDaily>(k: K): number | undefined => {
    const arr = daily[k]
    return Array.isArray(arr) ? arr[0] : undefined
  }
  const code = at('weather_code')
  return {
    high: at('temperature_2m_max'),
    low: at('temperature_2m_min'),
    code,
    condition: conditionFromCode(code),
    maxWind: at('wind_speed_10m_max'),
    precipSum: at('precipitation_sum'),
    precipProb: at('precipitation_probability_max'),
  }
}

const CURRENT_FIELDS =
  'temperature_2m,weather_code,cloud_cover,wind_speed_10m,precipitation,is_day'
const DAILY_FIELDS =
  'temperature_2m_max,temperature_2m_min,weather_code,wind_speed_10m_max,precipitation_sum,precipitation_probability_max'

export async function fetchWeather(coords: Coords): Promise<CurrentWeather> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}`
    + `&current=${CURRENT_FIELDS}&daily=${DAILY_FIELDS}&timezone=auto&forecast_days=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`weather ${res.status}`)
  const data = await res.json()
  if (!data || !data.current) throw new Error('weather: no current data')
  const w = parseWeather(data.current)
  w.today = parseToday(data.daily)
  return w
}
