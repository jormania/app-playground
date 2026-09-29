import { useEffect } from 'react'
import { createIdbKv } from '../../shared/notify/idbKv'
import { capabilities, notificationPermission, requestPermission } from '../../shared/notify/permission'
import { registerPeriodicSync, unregisterPeriodicSync } from '../../shared/notify/periodicSync'
import { shouldFireOncePerDay } from '../../shared/notify/schedule'
import { readJson, writeJson } from '../../shared/storage'
import type { EngagementLog } from './log'
import type { Language, ProfileRepo } from './profiles'
import { summarise } from './progress/summary'

// The daily reminder (KEYPATH_ROADMAP.md, "A daily reminder"): a gentle nudge
// at a time the family picks, if nobody has practised yet today. It is the
// shared local-notifications foundation (NOTIFICATIONS.md) used the way Sol
// Odyssey and the Journal use it: the page mirrors what the worker needs into
// IndexedDB, and public/keypath-notify.js, imported by keypath-sw.js, decides
// on a periodic wake. Phone-wide, like the Claude key: kept in localStorage,
// out of backups, since a permission doesn't travel to another phone.

export const REMINDER_KEY = 'keypath:reminder'
const TAG = 'keypath-reminder'
export const REMINDER_DB = 'keypath-reminders'

export interface ReminderSettings {
  enabled: boolean
  /** Minutes since midnight. */
  minutes: number
}
export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, minutes: 17 * 60 }
/** The times offered: after school to bedtime. */
export const REMINDER_HOURS = [15, 16, 17, 18, 19, 20, 21] as const

export const readReminder = (): ReminderSettings => {
  const r = readJson<Partial<ReminderSettings>>(REMINDER_KEY, {})
  const minutes = typeof r.minutes === 'number' && r.minutes >= 0 && r.minutes < 1440 ? Math.round(r.minutes) : DEFAULT_REMINDER.minutes
  return { enabled: r.enabled === true, minutes }
}
export const saveReminder = (r: ReminderSettings) => writeJson(REMINDER_KEY, r)

/** What the worker reads: the setting, the language, and the last day anyone came to play. */
export interface ReminderState {
  enabled: boolean
  minutes: number | null
  language: Language
  /** Local YYYY-MM-DD of the latest day any player practised. */
  practisedDay: string
}

/** Should the reminder fire now? The worker (public/keypath-notify.js) reimplements exactly this. */
export const shouldFire = (state: ReminderState | undefined, lastSentDay: string, now: Date): boolean =>
  !!state && shouldFireOncePerDay({ enabled: state.enabled, now, targetMinutes: state.minutes, lastSentDayKey: lastSentDay, doneDayKey: state.practisedDay })

export const REMINDER_TEXT: Record<Language, { title: string; body: string }> = {
  en: { title: 'KeyPath', body: 'Time for your five minutes of piano.' },
  ro: { title: 'KeyPath', body: 'E ora celor cinci minute de pian.' },
}

const kv = createIdbKv(REMINDER_DB, 'kv')

/** The latest day any player on this phone came to play (a session began), or ''. */
export async function lastPractisedDay(profiles: ProfileRepo, log: EngagementLog): Promise<string> {
  let latest = ''
  for (const p of await profiles.list()) {
    const days = summarise(await log.read(p.id)).days
    const last = days[days.length - 1] ?? ''
    if (last > latest) latest = last
  }
  return latest
}

/** Write what the worker needs. Best-effort: never throws. */
export async function syncReminder(profiles: ProfileRepo, log: EngagementLog): Promise<void> {
  try {
    const r = readReminder()
    const language = (await profiles.current().then((p) => (p ? profiles.settings(p.id) : null)))?.language ?? 'en'
    const state: ReminderState = { enabled: r.enabled, minutes: r.enabled ? r.minutes : null, language, practisedDay: await lastPractisedDay(profiles, log) }
    await kv.set('state', state)
  } catch {
    /* the reminder is a nicety */
  }
}

/** Keep the worker's copy current: at start, and whenever the app is left (that is when a session's practice has just been written). */
export function useReminderSync(profiles: ProfileRepo, log: EngagementLog) {
  useEffect(() => {
    void syncReminder(profiles, log)
    const onVis = () => document.visibilityState === 'hidden' && void syncReminder(profiles, log)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [profiles, log])
}

export type ReminderCapability = 'ready' | 'blocked' | 'unsupported'
export function reminderCapability(): ReminderCapability {
  const c = capabilities()
  if (!c.notifications) return 'unsupported'
  return notificationPermission() === 'denied' ? 'blocked' : 'ready'
}

/** Ask for permission (from a tap) and register the periodic wake. Returns the permission. */
export async function enableReminder(): Promise<NotificationPermission> {
  const permission = await requestPermission()
  if (permission === 'granted') await registerPeriodicSync(TAG, 12 * 60 * 60 * 1000)
  return permission
}
export const disableReminder = () => unregisterPeriodicSync(TAG)

/** Show the reminder now, to see that it works. Resolves false when it can't. */
export async function sendTestReminder(language: Language): Promise<boolean> {
  try {
    if (notificationPermission() !== 'granted') return false
    const text = REMINDER_TEXT[language]
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration('/keypath-react.html') : undefined
    if (reg) await reg.showNotification(text.title, { body: text.body, tag: 'keypath-test', icon: '/keypath-icon-192.png' })
    else new Notification(text.title, { body: text.body })
    return true
  } catch {
    return false
  }
}
