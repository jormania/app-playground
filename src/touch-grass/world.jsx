import { createContext, useContext, useState, useEffect } from 'react'
import { getTimeOfDay, getSeason, getMoonPhase, getLight } from './context.js'
import { fetchWeather } from './weather.js'
import { getActiveMoments, getMomentByKey } from './moments.js'
import { resolveBiome, BIOMES } from './place.js'

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

// A forced moon-phase moment (?event=full-moon|new-moon) should also set the moon
// itself — otherwise the label says "a Full Moon" while the real phase (and so the
// sky glyph and the ticker's "Nd to full moon") still reflect today's actual moon,
// which contradicts it. Tie the two together so the preview reads consistently.
function moonForMoment(moment) {
  if (!moment) return null
  if (moment.key === 'full-moon') return { phase: 0.5, fraction: 1 }
  if (moment.key === 'new-moon') return { phase: 0, fraction: 0 }
  return null
}

// Preview override: append ?light=golden|blue|day|night to force the light.
function loadForcedLight() {
  try {
    const l = new URLSearchParams(window.location.search).get('light')
    if (l === 'golden') return { golden: 1, blue: 0 }
    if (l === 'blue') return { golden: 0, blue: 1 }
    if (l === 'day' || l === 'night') return { golden: 0, blue: 0 }
    return null
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

// Preview override: append ?season=spring|summer|autumn|winter.
function loadForcedSeason() {
  try {
    const s = new URLSearchParams(window.location.search).get('season')
    return ['spring', 'summer', 'autumn', 'winter'].includes(s) ? s : null
  } catch (_) {
    return null
  }
}

// Preview override: append ?biome=coast|forest|city|mountain|plain.
function loadForcedBiome() {
  try {
    const b = new URLSearchParams(window.location.search).get('biome')
    return BIOMES.includes(b) ? b : null
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
  const [biome, setBiome] = useState(null)
  const [locationEnabled, setLocationEnabled] = useState(loadLocationPref)
  const [forcedWeather] = useState(loadForcedWeather)
  const [forcedBiome] = useState(loadForcedBiome)
  const [forcedMoon] = useState(loadForcedMoon)
  const [forcedTod] = useState(loadForcedTod)
  const [forcedLight] = useState(loadForcedLight)
  const [forcedSeason] = useState(loadForcedSeason)
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

  // resolve a coarse biome for the location (once, cached); degrade silently
  useEffect(() => {
    if (!effectiveCoords) { setBiome(null); return }
    let cancelled = false
    resolveBiome(effectiveCoords)
      .then(b => { if (!cancelled) setBiome(b) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [effectiveCoords])

  function toggleLocation() {
    setLocationEnabled(prev => {
      const next = !prev
      try { localStorage.setItem(LOCATION_PREF_KEY, next ? '1' : '0') } catch (_) {}
      return next
    })
  }

  const moon = forcedMoon || moonForMoment(forcedMoment) || getMoonPhase(now)
  const moments = forcedMoment ? [forcedMoment] : getActiveMoments(now, moon.phase)

  const value = {
    now,
    coords: effectiveCoords,
    timeOfDay: forcedTod || getTimeOfDay(now, effectiveCoords),
    light: forcedLight || getLight(now, effectiveCoords),
    season: forcedSeason || getSeason(now),
    weather: forcedWeather || weather,
    biome: forcedBiome || biome,
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
