import { createContext, useContext, useState, useEffect } from 'react'
import { getTimeOfDay, getSeason, getMoonPhase } from './context.js'
import { fetchWeather } from './weather.js'
import { getActiveMoments, getMomentByKey } from './moments.js'

const LOCATION_KEY = 'tg-react-location'
const LOCATION_PREF_KEY = 'tg-react-location-on'
const WEATHER_REFRESH = 15 * 60_000 // 15 minutes
const WorldCtx = createContext(null)

function loadLocationPref() {
  return localStorage.getItem(LOCATION_PREF_KEY) !== '0' // default on
}

// Preview override: append ?wx=rain|snow|fog|thunder|overcast|cloudy|clear
// to the URL to force a weather condition (for demos / verifying the scene).
function loadForcedWeather() {
  try {
    const wx = new URLSearchParams(window.location.search).get('wx')
    const presets = {
      clear:    { condition: 'clear',         cloud: 0.05, intensity: 0 },
      cloudy:   { condition: 'partly-cloudy', cloud: 0.45, intensity: 0 },
      overcast: { condition: 'overcast',      cloud: 0.95, intensity: 0 },
      fog:      { condition: 'fog',           cloud: 0.90, intensity: 0 },
      rain:     { condition: 'rain',          cloud: 0.85, intensity: 0.6 },
      snow:     { condition: 'snow',          cloud: 0.80, intensity: 0.6 },
      thunder:  { condition: 'thunder',       cloud: 0.95, intensity: 0.85 },
    }
    const p = presets[wx]
    return p ? { wind: 14, temp: null, precip: 0, isDay: true, code: 0, ...p } : null
  } catch (_) {
    return null
  }
}

// Preview override: append ?event=perseids|samhain|full-moon|... to force a moment.
function loadForcedMoment() {
  try {
    const e = new URLSearchParams(window.location.search).get('event')
    return e ? getMomentByKey(e) : null
  } catch (_) {
    return null
  }
}

// Preview override: append ?tod=dawn|day|dusk|night to force the time of day.
function loadForcedTod() {
  try {
    const t = new URLSearchParams(window.location.search).get('tod')
    return ['dawn', 'day', 'dusk', 'night'].includes(t) ? t : null
  } catch (_) {
    return null
  }
}

// Preview override: append ?moon=0.1 (0 new … 0.5 full … 1 new) to the URL.
function loadForcedMoon() {
  try {
    const m = new URLSearchParams(window.location.search).get('moon')
    if (m == null) return null
    const p = parseFloat(m)
    return Number.isFinite(p) ? { phase: ((p % 1) + 1) % 1, fraction: 0 } : null
  } catch (_) {
    return null
  }
}

function loadCoords() {
  try {
    const raw = localStorage.getItem(LOCATION_KEY)
    if (raw) {
      const c = JSON.parse(raw)
      if (c && typeof c.lat === 'number' && typeof c.lon === 'number') return { lat: c.lat, lon: c.lon }
    }
  } catch (_) {}
  return null
}

export function WorldProvider({ children }) {
  const [now, setNow] = useState(() => new Date())
  const [coords, setCoords] = useState(loadCoords)
  const [weather, setWeather] = useState(null)
  const [locationEnabled, setLocationEnabled] = useState(loadLocationPref)
  const [forcedWeather] = useState(loadForcedWeather)
  const [forcedMoon] = useState(loadForcedMoon)
  const [forcedTod] = useState(loadForcedTod)
  const [forcedMoment] = useState(loadForcedMoment)

  // single clock for the whole app — drives time-of-day / season everywhere
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // ask for location (only when enabled); cache it; stay silent if denied
  useEffect(() => {
    if (!locationEnabled || !('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        setCoords(c)
        try {
          localStorage.setItem(LOCATION_KEY, JSON.stringify({ ...c, ts: Date.now() }))
        } catch (_) {}
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 86_400_000, timeout: 10_000 }
    )
  }, [locationEnabled])

  // location off → fall back to the season tables / clear sky
  const effectiveCoords = locationEnabled ? coords : null

  // fetch live weather for the location; refresh periodically; degrade silently
  useEffect(() => {
    if (!effectiveCoords) { setWeather(null); return }
    let cancelled = false
    const load = () => {
      fetchWeather(effectiveCoords)
        .then(w => { if (!cancelled) setWeather(w) })
        .catch(() => {})
    }
    load()
    const id = setInterval(load, WEATHER_REFRESH)
    return () => { cancelled = true; clearInterval(id) }
  }, [effectiveCoords])

  function toggleLocation() {
    setLocationEnabled(prev => {
      const next = !prev
      try { localStorage.setItem(LOCATION_PREF_KEY, next ? '1' : '0') } catch (_) {}
      return next
    })
  }

  const moon = forcedMoon || getMoonPhase(now)
  const moments = forcedMoment ? [forcedMoment] : getActiveMoments(now, moon.phase)

  const value = {
    now,
    coords: effectiveCoords,
    timeOfDay: forcedTod || getTimeOfDay(now, effectiveCoords),
    season: getSeason(now),
    weather: forcedWeather || weather,
    moon,
    moments,
    locationEnabled,
    toggleLocation,
  }

  return <WorldCtx.Provider value={value}>{children}</WorldCtx.Provider>
}

export function useWorld() {
  return useContext(WorldCtx)
}
