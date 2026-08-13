// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWeather } from './useWeather.ts'
import { BUCHAREST } from './config.ts'
import * as weather from '../../shared/weather.ts'

const reading = (temp: number): weather.CurrentWeather => ({
  condition: 'clear', intensity: 0, cloud: 0, wind: 4, temp,
  precip: 0, isDay: true, code: 0,
})

/** A geolocation that answers however the test tells it to. */
function installGeolocation(behaviour: 'grant' | 'deny', coords = { lat: 51.5, lon: -0.12 }) {
  const getCurrentPosition = vi.fn((ok: PositionCallback, fail?: PositionErrorCallback) => {
    if (behaviour === 'grant') {
      ok({ coords: { latitude: coords.lat, longitude: coords.lon } } as GeolocationPosition)
    } else {
      fail?.({ code: 1, message: 'denied' } as GeolocationPositionError)
    }
  })
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition }, configurable: true, writable: true,
  })
  return getCurrentPosition
}

describe('useWeather', () => {
  let fetchWeather: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchWeather = vi.spyOn(weather, 'fetchWeather').mockResolvedValue(reading(19))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('uses saved coordinates without ever asking the device', async () => {
    // The whole point of storing them: no permission round-trip on a return
    // visit, and the weather paints immediately.
    const getCurrentPosition = installGeolocation('grant')
    const { result } = renderHook(() => useWeather({ lat: 44.4, lon: 26.1 }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(fetchWeather).toHaveBeenCalledWith({ lat: 44.4, lon: 26.1 })
    expect(result.current.fallback).toBe(false)
  })

  it('reports a freshly resolved position back so it can be remembered', async () => {
    // Regression: nothing in the app wrote `config.coords`, so the "saved
    // coordinates" branch above was unreachable and every visit re-prompted.
    installGeolocation('grant', { lat: 51.5, lon: -0.12 })
    const onResolved = vi.fn()
    const { result } = renderHook(() => useWeather(null, onResolved))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(onResolved).toHaveBeenCalledWith({ lat: 51.5, lon: -0.12 })
  })

  it('falls back to Bucharest when location is refused, and says so', async () => {
    installGeolocation('deny')
    const onResolved = vi.fn()
    const { result } = renderHook(() => useWeather(null, onResolved))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchWeather).toHaveBeenCalledWith(BUCHAREST)
    expect(result.current.fallback).toBe(true)
    // A refusal is a normal outcome — there's nothing to remember from it.
    expect(onResolved).not.toHaveBeenCalled()
  })

  it('is not an error state when the forecast itself fails', async () => {
    fetchWeather.mockRejectedValue(new Error('offline'))
    installGeolocation('deny')
    const { result } = renderHook(() => useWeather(null))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.weather).toBe(null)
  })

  it('re-reads the sky while the app stays open', async () => {
    vi.useFakeTimers()
    installGeolocation('deny')
    const { result } = renderHook(() => useWeather(null))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(result.current.weather?.temp).toBe(19)

    fetchWeather.mockResolvedValue(reading(27))
    await act(async () => { await vi.advanceTimersByTimeAsync(31 * 60 * 1000) })

    // Installed on a home screen and left there, the morning's reading was
    // still driving suggestions in the afternoon.
    expect(result.current.weather?.temp).toBe(27)
  })

  it('does not refetch on every tab switch', async () => {
    installGeolocation('deny')
    renderHook(() => useWeather(null))
    await waitFor(() => expect(fetchWeather).toHaveBeenCalledTimes(1))

    for (let i = 0; i < 5; i++) {
      act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    }
    expect(fetchWeather).toHaveBeenCalledTimes(1)
  })

  it('does not restart when unrelated settings change', async () => {
    // `config.coords` is replaced wholesale on any settings edit; keying on the
    // object would refetch the weather every time a wardrobe was renamed.
    installGeolocation('grant')
    const { rerender } = renderHook(
      ({ coords }) => useWeather(coords),
      { initialProps: { coords: { lat: 44.4, lon: 26.1 } } },
    )
    await waitFor(() => expect(fetchWeather).toHaveBeenCalledTimes(1))

    rerender({ coords: { lat: 44.4, lon: 26.1 } })
    expect(fetchWeather).toHaveBeenCalledTimes(1)
  })
})
