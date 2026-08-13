import { useEffect, useRef, useState } from 'react'
import { fetchWeather, type Coords, type CurrentWeather } from '../../shared/weather.ts'
import { BUCHAREST } from './config.ts'

export interface WeatherState {
  weather: CurrentWeather | null
  loading: boolean
  /** True when we fell back to Bucharest rather than using real coordinates. */
  fallback: boolean
}

/** How often an open app re-reads the sky. Fit Check gets installed and left on
 *  a home screen, so a reading taken at breakfast was still on screen at 4pm,
 *  quietly recommending a coat for weather that had long since passed. */
const REFRESH_MS = 30 * 60 * 1000
/** Coming back to the tab refreshes too, but not more often than this — flicking
 *  between apps shouldn't turn into a burst of requests. */
const MIN_GAP_MS = 10 * 60 * 1000

/**
 * Today's weather, from the device's location if it's offered and Bucharest if
 * it isn't (charter). Location is asked for once, never insisted on: a refusal
 * is a normal outcome, not an error, and the app carries on.
 *
 * `onResolved` is how the resolved position gets remembered. Without it the
 * `saved` branch below was unreachable: nothing in the app ever wrote
 * `config.coords`, so it was always null and every single visit went back
 * through `getCurrentPosition` — the exact prompt-on-every-visit the field was
 * added to avoid.
 */
export function useWeather(
  saved: Coords | null,
  onResolved?: (coords: Coords) => void,
): WeatherState {
  const [state, setState] = useState<WeatherState>({
    weather: null, loading: true, fallback: false,
  })

  // Held in a ref rather than depended on: callers pass an inline arrow, which
  // is a new function every render, and depending on it would restart
  // geolocation on each one.
  const report = useRef(onResolved)
  useEffect(() => { report.current = onResolved })

  // Values, not the object: `config.coords` is replaced wholesale whenever any
  // setting changes, and keying on identity would refetch the weather every
  // time Nora renamed a wardrobe.
  const lat = saved?.lat ?? null
  const lon = saved?.lon ?? null

  useEffect(() => {
    let cancelled = false
    // Where the current reading came from, so a refresh doesn't have to ask the
    // device for its position all over again.
    let source: { coords: Coords; fallback: boolean } | null = null
    let lastFetch = 0

    async function load(coords: Coords, fallback: boolean) {
      source = { coords, fallback }
      lastFetch = Date.now()
      try {
        const weather = await fetchWeather(coords)
        if (!cancelled) setState({ weather, loading: false, fallback })
      } catch {
        // Offline, or Open-Meteo having a bad day. The recommender copes with a
        // null temperature by ignoring warmth rather than guessing.
        if (!cancelled) setState({ weather: null, loading: false, fallback })
      }
    }

    // A previously granted position is used immediately so the page isn't
    // blocked behind a permission prompt on every visit.
    if (lat !== null && lon !== null) {
      void load({ lat, lon }, false)
    } else if (typeof navigator === 'undefined' || !navigator.geolocation) {
      void load(BUCHAREST, true)
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const found = { lat: pos.coords.latitude, lon: pos.coords.longitude }
          report.current?.(found)
          void load(found, false)
        },
        () => { void load(BUCHAREST, true) },
        { timeout: 8000, maximumAge: 30 * 60 * 1000 },
      )
    }

    function refresh(force: boolean) {
      if (!source) return
      if (!force && Date.now() - lastFetch < MIN_GAP_MS) return
      void load(source.coords, source.fallback)
    }

    const timer = setInterval(() => refresh(true), REFRESH_MS)
    const onVisible = () => { if (!document.hidden) refresh(false) }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [lat, lon])

  return state
}
