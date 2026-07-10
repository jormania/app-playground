import { useCallback, useEffect, useRef, useState } from 'react'

// Requests the device location for the location-based moon position. Fires
// automatically once `enabled`, but some contexts (notably installed/standalone
// PWA windows) have been seen to silently swallow a programmatic request with
// no prompt at all — the browser API offers no way to detect or force that.
// `request` is exposed so the UI can offer a manual retry from a real tap,
// which reliably surfaces the native prompt where the automatic one didn't.
// Fully optional throughout: if the user declines or it's unavailable, coords
// stays null and the sky falls back to a gentle default moon.
export function useCoords(enabled) {
  const [coords, setCoords] = useState(null)
  // idle -> pending -> 'granted' | 'denied' (permission refused) | 'unavailable'
  // (no API, insecure context, position unreadable, or a timeout).
  const [status, setStatus] = useState('idle')
  // Reset on mount, not just cleared on unmount: StrictMode's dev-only
  // mount→unmount→mount double-invoke would otherwise leave this false
  // forever after the simulated first cleanup, silently dropping every
  // future success/error callback.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const request = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable')
      return
    }
    setStatus('pending')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!mounted.current) return
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setStatus('granted')
      },
      (err) => {
        if (!mounted.current) return
        setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable')
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60 * 60 * 1000 },
    )
  }, [])

  useEffect(() => {
    if (enabled) request()
  }, [enabled, request])

  return { coords, status, request }
}
