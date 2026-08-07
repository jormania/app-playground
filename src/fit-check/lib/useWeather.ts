import { useEffect, useState } from 'react'
import { fetchWeather, type CurrentWeather } from '../../shared/weather.ts'
import { BUCHAREST } from './config.ts'

export interface WeatherState {
  weather: CurrentWeather | null
  loading: boolean
  /** True when we fell back to Bucharest rather than using real coordinates. */
  fallback: boolean
}

/**
 * Today's weather, from the device's location if it's offered and Bucharest if
 * it isn't (charter). Location is asked for once, never insisted on: a refusal
 * is a normal outcome, not an error, and the app carries on.
 */
export function useWeather(saved: { lat: number; lon: number } | null): WeatherState {
  const [state, setState] = useState<WeatherState>({
    weather: null, loading: true, fallback: false,
  })

  useEffect(() => {
    let cancelled = false

    async function load(coords: { lat: number; lon: number }, fallback: boolean) {
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
    if (saved) {
      void load(saved, false)
      return () => { cancelled = true }
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      void load(BUCHAREST, true)
      return () => { cancelled = true }
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => { void load({ lat: pos.coords.latitude, lon: pos.coords.longitude }, false) },
      () => { void load(BUCHAREST, true) },
      { timeout: 8000, maximumAge: 30 * 60 * 1000 },
    )

    return () => { cancelled = true }
  }, [saved])

  return state
}
