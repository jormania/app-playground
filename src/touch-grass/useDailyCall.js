import { useEffect, useRef } from 'react'
import { nextCallTime, buildMessage, walkToday, todayKey } from './dailyCall.js'
import { idbGet, idbSet } from './idbCall.js'

const CATCHUP_MS = 2 * 3600 * 1000 // still worth firing if the app is opened within 2h of the target
const MAX_TIMEOUT = 2147483647 // setTimeout ceiling (~24.8 days)

function showCall(body) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const opts = { body, tag: 'tg-daily-call', icon: '/icon-192.png', badge: '/icon-192.png' }
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready
        .then(reg => reg.showNotification('Touch Grass', opts))
        .catch(() => { try { new Notification('Touch Grass', opts) } catch (_) {} })
    } else {
      new Notification('Touch Grass', opts)
    }
  } catch (_) {}
}

// Ask the browser to wake the (installed) PWA's service worker periodically, so
// the daily call can be delivered even when the app is fully closed. Best-effort:
// installed-PWA + Chromium only, browser-controlled timing, throttled by battery
// saving. The SW does the actual decide/show (see sw.js).
async function registerPeriodicSync() {
  try {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    if (!reg.periodicSync) return
    try {
      const status = await navigator.permissions.query({ name: 'periodic-background-sync' })
      if (status.state !== 'granted') return
    } catch (_) { /* permission name unsupported — attempt registration anyway */ }
    await reg.periodicSync.register('tg-daily-call', { minInterval: 12 * 60 * 60 * 1000 })
  } catch (_) {}
}

async function unregisterPeriodicSync() {
  try {
    const reg = await navigator.serviceWorker.ready
    if (reg.periodicSync) await reg.periodicSync.unregister('tg-daily-call')
  } catch (_) {}
}

// One gentle notification a day, ~2h before sunset, in the app's voice. Fires
// while the tab is open and catches up on the next open; with periodic background
// sync (installed PWA) it can also fire while fully closed. Never more than once
// a day — the "last sent" day is shared with the SW via IndexedDB.
export function useDailyCall(enabled, coords, history) {
  const histRef = useRef(history)
  histRef.current = history
  const sentDayRef = useRef(null) // last day the call went out (shared with the SW)

  // mirror "did I walk today" + the find's name, for the SW's background message
  useEffect(() => {
    const t = todayKey(new Date())
    const todayWalk = (history || []).find(w => w && w.ts && todayKey(new Date(w.ts)) === t)
    idbSet('lastWalkDay', todayWalk ? t : '')
    idbSet('lastWalkName', todayWalk && todayWalk.discovery ? todayWalk.discovery.name : '')
  }, [history])

  useEffect(() => {
    idbSet('callEnabled', !!enabled) // mirror the toggle for the SW (even on disable)
    if (!enabled || typeof Notification === 'undefined') {
      if (!enabled) unregisterPeriodicSync()
      return
    }

    if (coords) idbSet('coords', { lat: coords.lat, lon: coords.lon })
    registerPeriodicSync()

    let preview = false
    try { preview = new URLSearchParams(window.location.search).get('call') === 'now' } catch (_) {}

    let timer = 0
    let cancelled = false
    let removeGesture = null

    const shownToday = (now) => sentDayRef.current === todayKey(now)
    const markShown = (now) => { const d = todayKey(now); sentDayRef.current = d; idbSet('lastCallDay', d) }

    const fire = () => {
      const now = new Date()
      if (shownToday(now)) return
      markShown(now)
      showCall(buildMessage(walkToday(histRef.current, now)))
    }
    const scheduleFor = (target) => {
      const delta = target.getTime() - Date.now()
      if (delta > 0) timer = setTimeout(() => { fire(); schedule() }, Math.min(delta, MAX_TIMEOUT))
    }
    const scheduleTomorrow = () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(now.getDate() + 1)
      scheduleFor(nextCallTime(tomorrow, coords))
    }
    const schedule = () => {
      if (cancelled || Notification.permission !== 'granted') return
      clearTimeout(timer)
      const now = new Date()
      const todayCall = nextCallTime(now, coords)
      const delta = todayCall.getTime() - now.getTime()
      if (delta > 0) scheduleFor(todayCall)
      else if (delta > -CATCHUP_MS && !shownToday(now)) { fire(); scheduleTomorrow() }
      else scheduleTomorrow()
    }
    const ready = () => {
      if (preview) showCall(buildMessage(walkToday(histRef.current, new Date())))
      schedule()
    }

    const start = async () => {
      sentDayRef.current = await idbGet('lastCallDay') // share the guard with the SW
      if (cancelled) return
      if (Notification.permission === 'granted') {
        ready()
      } else if (Notification.permission === 'default') {
        const onGesture = () => {
          removeGesture = null
          window.removeEventListener('pointerdown', onGesture)
          Notification.requestPermission().then(() => ready()).catch(() => {})
        }
        window.addEventListener('pointerdown', onGesture, { once: true })
        removeGesture = () => window.removeEventListener('pointerdown', onGesture)
      }
    }
    start()

    // returning to the app: re-read the shared guard (the SW may have fired) and reschedule
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      idbGet('lastCallDay').then((d) => { sentDayRef.current = d; schedule() })
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearTimeout(timer)
      if (removeGesture) removeGesture()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, coords])
}
