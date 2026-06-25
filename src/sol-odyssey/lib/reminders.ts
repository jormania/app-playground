// Opt-in local reminders: a daily "log your tiny version" nudge and a weekly "reflect" nudge.
// Best-effort, on-device, no server — the same Periodic Background Sync pattern Touch Grass uses
// (public/sw.js): a service worker wakes periodically, reads the shared IndexedDB snapshot this
// module writes, and decides whether to show a notification. Background delivery only works where
// the platform supports it (installed PWA on Chromium); elsewhere it's a no-op and the in-app
// surfaces still carry the reminder.
//
// The pure decision logic lives here (unit-tested in node); the service worker reimplements the
// same minimal logic inline, since it can't import an ES module.

/** The app-owned snapshot the worker reads. (The worker owns the lastDailySent / lastWeeklySent
 *  guards separately, so a snapshot write never clobbers them.) */
export interface ReminderState {
  enabled: boolean
  /** Daily nudge time, minutes since midnight (from `dailyTime`); null when unset/unparseable. */
  dailyMinutes: number | null
  /** Weekly nudge slot (from `weeklySlot`); null when unset/unparseable. */
  weekly: { dow: number; minutes: number } | null
  /** Is an Active Odyssey currently within its 1..42 window. */
  cycleActive: boolean
  /** Date (yyyy-mm-dd) of today's saved check-in — for "don't nag once it's done". */
  todayLogged: string
  /** Is a completed week awaiting its reflection. */
  weeklyDue: boolean
  /** A planned Odyssey whose start date has arrived and is waiting to be begun. */
  startReady: boolean
  /** Stable id for the start nudge's once-guard (the planned draft's id). */
  startId: string
  /** An Active Odyssey has reached Day 42 and is awaiting harvest. */
  harvestReady: boolean
  /** Stable id for the harvest nudge's once-guard (the Odyssey's id). */
  harvestId: string
}

export const REMINDERS_DB = 'sol-reminders'
export const REMINDERS_STORE = 'kv'
export const STATE_KEY = 'state'

const DOW: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
}

/** "HH:MM" (24h) → minutes since midnight, or null. */
export function parseDailyTime(value: string): number | null {
  const m = /(\d{1,2}):(\d{2})/.exec(String(value || '').trim())
  if (!m) return null
  const h = Number(m[1]), min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

/** Lenient parse of a weekly slot like "Sun 18:00" → { dow, minutes }, or null if either the day or
 *  the time is missing/unparseable (then the weekly background nudge simply doesn't fire). */
export function parseWeeklySlot(value: string): { dow: number; minutes: number } | null {
  const s = String(value || '').trim().toLowerCase()
  const minutes = parseDailyTime(s)
  if (minutes == null) return null
  const dayToken = s.match(/[a-z]+/)?.[0]
  if (!dayToken || !(dayToken in DOW)) return null
  return { dow: DOW[dayToken], minutes }
}

// ── Pure decision logic (shared shape with the worker) ──────────────────────────────────────────

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}
/** A stable per-ISO-week key (year + week number) for once-a-week suppression. */
export function weekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Should the daily nudge fire now? (enabled, cycle active, past the time, today not yet logged,
 *  not already sent today). */
export function shouldFireDaily(state: ReminderState, lastDailySent: string, now: Date): boolean {
  if (!state.enabled || !state.cycleActive || state.dailyMinutes == null) return false
  const today = dateKey(now)
  if (state.todayLogged === today) return false
  if (lastDailySent === today) return false
  return minutesOfDay(now) >= state.dailyMinutes
}

/** Should the weekly nudge fire now? (enabled, a week is due, right weekday, past the slot time,
 *  not already sent this week). */
export function shouldFireWeekly(state: ReminderState, lastWeeklySent: string, now: Date): boolean {
  if (!state.enabled || !state.weekly || !state.weeklyDue) return false
  if (now.getDay() !== state.weekly.dow) return false
  if (lastWeeklySent === weekKey(now)) return false
  return minutesOfDay(now) >= state.weekly.minutes
}

/** Should the "your planned Odyssey is ready to begin" nudge fire? (enabled, a planned draft's start
 *  date has arrived, not already sent for that draft). Event-based — no time-of-day gate. */
export function shouldFireStart(state: ReminderState, lastStartSent: string): boolean {
  if (!state.enabled || !state.startReady || !state.startId) return false
  return lastStartSent !== state.startId
}

/** Should the "you reached the summit — harvest" nudge fire? (enabled, an Odyssey has hit Day 42,
 *  not already sent for that Odyssey). Event-based — no time-of-day gate. */
export function shouldFireHarvest(state: ReminderState, lastHarvestSent: string): boolean {
  if (!state.enabled || !state.harvestReady || !state.harvestId) return false
  return lastHarvestSent !== state.harvestId
}

// ── Browser side-effects (guarded so node/tests never touch them) ───────────────────────────────

export interface ReminderCapabilities {
  notifications: boolean
  periodicSync: boolean
  supported: boolean
}

export function capabilities(): ReminderCapabilities {
  const notifications = typeof Notification !== 'undefined'
  const periodicSync =
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof (globalThis as { PeriodicSyncManager?: unknown }).PeriodicSyncManager !== 'undefined'
  return { notifications, periodicSync, supported: notifications && periodicSync }
}

export function notificationPermission(): NotificationPermission {
  return typeof Notification !== 'undefined' ? Notification.permission : 'denied'
}

function openRemindersDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(REMINDERS_DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(REMINDERS_STORE)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

/** Write the app-owned snapshot for the worker to read. Best-effort. */
export async function writeReminderState(state: ReminderState): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  try {
    const db = await openRemindersDB()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(REMINDERS_STORE, 'readwrite')
      tx.objectStore(REMINDERS_STORE).put(state, STATE_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    /* IDB unavailable — reminders just won't fire in the background */
  }
}

/** Request permission (must be from a user gesture) and best-effort register periodic sync.
 *  Returns the resulting Notification permission. */
export async function enableReminders(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied'
  let permission = Notification.permission
  if (permission === 'default') permission = await Notification.requestPermission()
  if (permission === 'granted') await registerPeriodicSync()
  return permission
}

/** Best-effort periodic-sync registration (no-op where unsupported or not permitted). */
export async function registerPeriodicSync(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return
    const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> }
    }
    if (!reg.periodicSync) return
    await reg.periodicSync.register('sol-reminders', { minInterval: 12 * 60 * 60 * 1000 })
  } catch {
    /* not installed / not permitted — the in-app reminders still work */
  }
}

export async function unregisterPeriodicSync(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return
    const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      periodicSync?: { unregister: (tag: string) => Promise<void> }
    }
    await reg.periodicSync?.unregister('sol-reminders')
  } catch {
    /* ignore */
  }
}
