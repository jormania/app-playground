// Opt-in local reminders: a 9pm nudge to write today's delight if it isn't written yet, and
// a 7pm "on this day" note when past years share the calendar day (silent when there's no
// match). Best-effort, on-device, no server — built on the cross-app shared foundation in
// src/shared/notify/ (see NOTIFICATIONS.md), the same one Touch Grass and Sol Odyssey use.
// A service worker (public/journal-sw.js) wakes periodically, reads the snapshot this module
// writes to IndexedDB, and decides whether to show a notification.
import { entriesOnSameDay, todayKey } from './dates.js'
import { getRemindersEnabled, getRemindersNudge, getRemindersOnThisDay } from './store.js'
import { createIdbKv } from '../shared/notify/idbKv'
import { requestPermission, notificationPermission, capabilities } from '../shared/notify/permission'
import {
  registerPeriodicSync as sharedRegisterPeriodicSync,
  unregisterPeriodicSync as sharedUnregisterPeriodicSync,
} from '../shared/notify/periodicSync'

export const REMINDERS_DB = 'jod-reminders'
export const REMINDERS_STORE = 'kv'
export const STATE_KEY = 'state'
const TAG = 'jod-reminders'

const remindersKv = createIdbKv(REMINDERS_DB, REMINDERS_STORE)

// Pure: past delights that fall on today's calendar day, trimmed to what the worker's
// notification body needs. Reuses the same match dates.js already uses for the in-app
// "On this day" glance, so the background note and the in-app one never disagree.
export function onThisDayMatches(entries, date = new Date()) {
  return entriesOnSameDay(entries, todayKey(date)).map((e) => ({ date: e.date, title: e.title || 'untitled' }))
}

// Pure: the snapshot the worker needs to decide both nudges.
export function computeReminderState(entries, { enabled = false, wantNudge = true, wantOnThisDay = true, date = new Date() } = {}) {
  const today = todayKey(date)
  const hasToday = (entries || []).some((e) => e && e.date === today)
  return {
    enabled: !!enabled,
    wantNudge: !!wantNudge,
    wantOnThisDay: !!wantOnThisDay,
    todayLogged: hasToday ? today : '',
    onThisDay: onThisDayMatches(entries, date),
  }
}

// Mirror the state the worker needs into the shared IndexedDB whenever entries change.
export async function writeReminderState(entries) {
  await remindersKv.set(STATE_KEY, computeReminderState(entries, {
    enabled: getRemindersEnabled(),
    wantNudge: getRemindersNudge(),
    wantOnThisDay: getRemindersOnThisDay(),
  }))
}

export { capabilities, notificationPermission }

// Request permission (must be from a user gesture) and best-effort register periodic sync.
export async function enableReminders() {
  const permission = await requestPermission()
  if (permission === 'granted') await registerPeriodicSync()
  return permission
}

export async function registerPeriodicSync() {
  await sharedRegisterPeriodicSync(TAG, 12 * 60 * 60 * 1000)
}

export async function unregisterPeriodicSync() {
  await sharedUnregisterPeriodicSync(TAG)
}

function showNotification(body, tag) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const opts = { body, tag, icon: '/journal-icon.svg', badge: '/journal-icon.svg' }
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready
        .then((reg) => reg.showNotification('Journal of Delights', opts))
        .catch(() => { try { new Notification('Journal of Delights', opts) } catch { /* ignore */ } })
    } else {
      new Notification('Journal of Delights', opts)
    }
  } catch { /* ignore */ }
}

function onThisDayBody(matches) {
  if (matches.length === 1) return `On this day: ${matches[0].title} (${matches[0].date.slice(0, 4)}).`
  return `On this day, ${matches.length} delights from years past are worth a look.`
}

// ?notify=nudge|onthisday — fire one immediately, for previewing (mirrors Touch Grass's ?call=).
export function previewFromQuery(entries) {
  let p = null
  try { p = new URLSearchParams(window.location.search).get('notify') } catch { /* ignore */ }
  if (!p) return
  if (p === 'onthisday') {
    const matches = onThisDayMatches(entries)
    showNotification(matches.length ? onThisDayBody(matches) : 'No "on this day" matches to preview.', 'jod-on-this-day')
  } else if (p === 'nudge') {
    showNotification("Anything catch your eye today? There's still time to write it down.", 'jod-nudge')
  }
}
