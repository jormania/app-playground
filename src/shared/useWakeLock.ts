import { useEffect, useRef } from 'react'

/**
 * Keeps the screen awake while `active` is true. No-ops silently if the Wake Lock
 * API isn't supported or the request is denied — the screen may just sleep.
 *
 * Promoted out of src/tempo/lib/useWakeLock.js once a third app (Lexi5) needed the
 * same behavior — src/tempo and src/yoru now re-export this so their import paths
 * are unchanged.
 */
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.wakeLock) return undefined

    let cancelled = false

    const acquire = async () => {
      try {
        const sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) {
          sentinel.release().catch(() => {})
          return
        }
        // The OS/browser can release the lock on its own (e.g. tab hidden) without
        // us calling release() — listen so the ref doesn't go stale and block a
        // re-acquire once the tab is visible again.
        sentinel.addEventListener('release', () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null
        })
        sentinelRef.current = sentinel
      } catch {
        // denied or unsupported in this context — degrade silently
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !sentinelRef.current) acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      if (sentinelRef.current) {
        sentinelRef.current.release().catch(() => {})
        sentinelRef.current = null
      }
    }
  }, [active])
}
