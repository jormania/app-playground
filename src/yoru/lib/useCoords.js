import { useEffect, useState } from 'react'

// Requests the device location once (for the location-based moon position).
// Fully optional: if the user declines or it's unavailable, returns null and the
// sky falls back to a gentle default moon. Coarse accuracy is plenty for the moon.
export function useCoords(enabled) {
  const [coords, setCoords] = useState(null)

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.geolocation) return
    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!cancelled) setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude })
      },
      () => {}, // declined / unavailable — stay null, degrade gracefully
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60 * 60 * 1000 },
    )
    return () => {
      cancelled = true
    }
  }, [enabled])

  return coords
}
