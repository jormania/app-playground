import { useEffect, useRef } from 'react'
import { nextCallTime, buildMessage, walkToday, todayKey } from './dailyCall.js'

const LAST_KEY = 'tg-react-call-last'
const CATCHUP_MS = 2 * 3600 * 1000 // still worth firing if the app is opened within 2h of the target
const MAX_TIMEOUT = 2147483647 // setTimeout ceiling (~24.8 days)

function shownToday(now) {
  try { return localStorage.getItem(LAST_KEY) === todayKey(now) } catch (_) { return false }
}
function markShown(now) {
  try { localStorage.setItem(LAST_KEY, todayKey(now)) } catch (_) {}
}

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

// One gentle notification a day, ~2h before sunset, in the app's voice. Fires
// while the tab is open and catches up on the next open if the window was just
// missed; never more than once per day. No backend — closed-tab delivery isn't
// guaranteed, which is the honest limit of a browser-only app.
export function useDailyCall(enabled, coords, history) {
  // read the latest history at fire time without re-scheduling on every change
  const histRef = useRef(history)
  histRef.current = history

  useEffect(() => {
    if (!enabled || typeof Notification === 'undefined') return

    // ?call=now — fire the call immediately (for previewing the message/flow)
    let preview = false
    try { preview = new URLSearchParams(window.location.search).get('call') === 'now' } catch (_) {}

    let timer = 0
    let cancelled = false
    let removeGesture = null

    const ready = () => {
      if (preview) showCall(buildMessage(walkToday(histRef.current, new Date())))
      schedule()
    }

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
      if (delta > 0) {
        scheduleFor(todayCall)
      } else if (delta > -CATCHUP_MS && !shownToday(now)) {
        fire()
        scheduleTomorrow()
      } else {
        scheduleTomorrow()
      }
    }

    const onVisible = () => { if (document.visibilityState === 'visible') schedule() }

    if (Notification.permission === 'granted') {
      ready()
    } else if (Notification.permission === 'default') {
      // browsers want a user gesture for the prompt — ask on the first interaction
      const onGesture = () => {
        removeGesture = null
        window.removeEventListener('pointerdown', onGesture)
        Notification.requestPermission().then(() => ready()).catch(() => {})
      }
      window.addEventListener('pointerdown', onGesture, { once: true })
      removeGesture = () => window.removeEventListener('pointerdown', onGesture)
    }
    // permission === 'denied' → stay silent

    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearTimeout(timer)
      if (removeGesture) removeGesture()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, coords])
}
