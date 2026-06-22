import { useEffect, useRef } from 'react'
import {
  nextCallTime, goldenNotifyTime, buildMessage, buildGoldenBody, buildAlmanacBody,
  walkToday, todayKey,
} from './dailyCall.js'
import { idbGet, idbSet } from './idbCall.js'

const GOLDEN_WINDOW = 80 * 60 * 1000 // a generous window around golden hour (it's a treat, not precise)
const EVAL_EVERY = 60 * 1000

function showCall(body, tag) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const opts = { body, tag, icon: '/icon-sun-192.png', badge: '/icon-192.png' }
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
// the notifications can be delivered even when the app is fully closed.
async function registerPeriodicSync() {
  try {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    if (!reg.periodicSync) return
    try {
      const status = await navigator.permissions.query({ name: 'periodic-background-sync' })
      if (status.state !== 'granted') return
    } catch (_) { /* permission name unsupported — attempt anyway */ }
    await reg.periodicSync.register('tg-daily-call', { minInterval: 12 * 60 * 60 * 1000 })
  } catch (_) {}
}
async function unregisterPeriodicSync() {
  try {
    const reg = await navigator.serviceWorker.ready
    if (reg.periodicSync) await reg.periodicSync.unregister('tg-daily-call')
  } catch (_) {}
}

// Three notifications, each in the app's voice:
//   golden  — ~30 min before golden hour. Always (walked or not).
//   almanac — on a special almanac day. Always, and may stack with golden.
//   daily   — the generic "take a walk" nudge. Only when NOT walked today AND no
//             golden hour is on offer (golden supersedes it). Effectively the
//             no-location fallback.
// Fires while the app is open and catches up on open; with periodic background
// sync (installed PWA) it can also fire while fully closed (see sw.js). Each is
// once a day, the "last sent" day shared with the SW via IndexedDB.
export function useDailyCall(enabled, coords, history, moments) {
  const histRef = useRef(history)
  histRef.current = history
  const momentsRef = useRef(moments)
  momentsRef.current = moments

  // mirror "walked today" and today's almanac line for the SW's background fire
  useEffect(() => {
    const t = todayKey(new Date())
    const walked = (history || []).some(w => w && w.ts && todayKey(new Date(w.ts)) === t)
    idbSet('lastWalkDay', walked ? t : '')
  }, [history])
  useEffect(() => {
    idbSet('almanacBody', buildAlmanacBody(moments))
  }, [moments])

  useEffect(() => {
    idbSet('callEnabled', !!enabled)
    if (!enabled || typeof Notification === 'undefined') {
      if (!enabled) unregisterPeriodicSync()
      return
    }
    if (coords) idbSet('coords', { lat: coords.lat, lon: coords.lon })
    registerPeriodicSync()

    let cancelled = false
    let interval = 0
    let removeGesture = null
    const sent = {} // call key -> 'YYYY-MM-DD' it last went out (loaded from IndexedDB)

    const midnight = (now) => { const m = new Date(now); m.setHours(24, 0, 0, 0); return m.getTime() }

    const calls = [
      {
        key: 'golden', dayKey: 'lastGoldenDay', tag: 'tg-golden',
        time: (now) => goldenNotifyTime(now, coords),
        end: (now, t) => t + GOLDEN_WINDOW,
        eligible: () => true,
        body: () => buildGoldenBody(),
      },
      {
        key: 'almanac', dayKey: 'lastAlmanacDay', tag: 'tg-almanac',
        time: (now) => nextCallTime(now, coords),
        end: (now) => midnight(now),
        eligible: () => !!buildAlmanacBody(momentsRef.current),
        body: () => buildAlmanacBody(momentsRef.current),
      },
      {
        key: 'daily', dayKey: 'lastCallDay', tag: 'tg-daily-call',
        time: (now) => nextCallTime(now, coords),
        end: (now) => midnight(now),
        // only when no golden hour is on offer, and not already out today
        eligible: () => goldenNotifyTime(new Date(), coords) == null && !walkToday(histRef.current, new Date()),
        body: () => buildMessage(null),
      },
    ]

    const evaluate = () => {
      if (cancelled || Notification.permission !== 'granted') return
      const now = new Date()
      const today = todayKey(now)
      const nowMs = now.getTime()
      for (const c of calls) {
        if (sent[c.key] === today) continue
        const t = c.time(now)
        if (!t) continue
        const tMs = t.getTime()
        if (nowMs < tMs || nowMs > c.end(now, tMs)) continue // not yet, or window passed
        if (!c.eligible()) continue
        sent[c.key] = today
        idbSet(c.dayKey, today)
        showCall(c.body(), c.tag)
      }
    }

    // ?call=now|daily|golden|almanac — fire one immediately, for previewing
    const preview = () => {
      let p = null
      try { p = new URLSearchParams(window.location.search).get('call') } catch (_) {}
      if (!p) return
      if (p === 'golden') showCall(buildGoldenBody(), 'tg-golden')
      else if (p === 'almanac') showCall(buildAlmanacBody(momentsRef.current) || 'No almanac moment today.', 'tg-almanac')
      else showCall(buildMessage(null), 'tg-daily-call')
    }

    const loadGuards = () => Promise.all([
      idbGet('lastGoldenDay'), idbGet('lastAlmanacDay'), idbGet('lastCallDay'),
    ]).then(([g, a, d]) => { sent.golden = g; sent.almanac = a; sent.daily = d })

    const begin = async () => {
      await loadGuards()
      if (cancelled) return
      preview()
      evaluate()
      interval = setInterval(evaluate, EVAL_EVERY)
    }

    if (Notification.permission === 'granted') {
      begin()
    } else if (Notification.permission === 'default') {
      const onGesture = () => {
        removeGesture = null
        window.removeEventListener('pointerdown', onGesture)
        Notification.requestPermission().then(() => begin()).catch(() => {})
      }
      window.addEventListener('pointerdown', onGesture, { once: true })
      removeGesture = () => window.removeEventListener('pointerdown', onGesture)
    }

    // returning to the app: the SW may have fired meanwhile — re-read the guards
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      loadGuards().then(evaluate)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearInterval(interval)
      if (removeGesture) removeGesture()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, coords])
}
