import { readJson, removeJson, writeJson } from '../../shared/storage'
import { isoDateIn } from '../domain/week'
import type { Repo } from '../store/repo'

/**
 * The journey lives on this device alone (IndexedDB; Notion is a partial,
 * one-way copy), so two things guard it: asking the browser to keep the app's
 * data rather than clear it when space runs short, and remembering when a
 * backup was last saved — said in Settings, and once in a while on This week.
 */
const LAST_KEY = 'long-listen:last-backup'
const SNOOZE_KEY = 'long-listen:backup-nudge-until'
const DAY = 86_400_000
/** Four weeks: about one reminder a month while backups go unsaved. */
export const BACKUP_DUE_AFTER_MS = 28 * DAY
const SNOOZE_MS = 14 * DAY
/** A journey worth guarding: a few weeks of it, not the first day. */
const WEEKS_BEFORE_ASKING = 3

export function markBackedUp(now = Date.now()): void {
  writeJson(LAST_KEY, new Date(now).toISOString())
  removeJson(SNOOZE_KEY)
}

export function lastBackup(): string | undefined {
  const v = readJson<unknown>(LAST_KEY, null)
  return typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : undefined
}

/** Whether This week should mention it: a few weeks of journey, no backup for four weeks (or ever), not put off. */
export function backupDue(weeks: number, last: string | undefined, now = Date.now(), snoozedUntil = snoozed()): boolean {
  if (weeks < WEEKS_BEFORE_ASKING) return false
  if (snoozedUntil && now < snoozedUntil) return false
  return !last || now - Date.parse(last) > BACKUP_DUE_AFTER_MS
}

function snoozed(): number | undefined {
  const v = readJson<unknown>(SNOOZE_KEY, null)
  return typeof v === 'number' ? v : undefined
}

export function snoozeBackupNudge(now = Date.now()): void {
  writeJson(SNOOZE_KEY, now + SNOOZE_MS)
}

/**
 * Ask the browser to keep this origin's storage. Chrome grants it to an
 * installed or often-used app without a prompt; elsewhere it may say no, and
 * nothing changes. Asked once per start; the answer is remembered by the browser.
 */
export async function askToKeepData(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted?.()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/** Whether the browser has agreed to keep the data; undefined where it can't say. */
export async function dataKept(): Promise<boolean | undefined> {
  try {
    return navigator.storage?.persisted ? await navigator.storage.persisted() : undefined
  } catch {
    return undefined
  }
}

/** Everything in the store, as one JSON file in the downloads — and remembered as the last backup. */
export async function downloadBackup(repo: Repo, name: string, timeZone: string): Promise<void> {
  const data = await repo.exportAll()
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  // Today's date where the listener is, as the week reckons it — not UTC's, a day behind after midnight.
  a.download = `${name}-${isoDateIn(new Date(), timeZone)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  markBackedUp()
}
