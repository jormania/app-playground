import { K, PREFIX, type KeyValueStore } from './store'

export interface Backup {
  keypathBackup: 1
  exportedAt: string
  data: Record<string, unknown>
}

/** Everything KeyPath keeps on this phone, as one JSON document. */
export async function exportBackup(store: KeyValueStore, now = new Date()): Promise<Backup> {
  const data: Record<string, unknown> = {}
  for (const key of await store.keys()) {
    if (key.startsWith(PREFIX) && key !== K.meta) data[key] = await store.get(key)
  }
  await markBackedUp(store, now)
  return { keypathBackup: 1, exportedAt: now.toISOString(), data }
}

export class BackupError extends Error {}

/** Restore replaces what's on the phone with the backup's contents. */
export async function restoreBackup(store: KeyValueStore, text: string): Promise<number> {
  let parsed: Backup
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new BackupError('not-json')
  }
  if (parsed?.keypathBackup !== 1 || typeof parsed.data !== 'object' || parsed.data === null) throw new BackupError('not-keypath')
  const entries = Object.entries(parsed.data).filter(([k]) => k.startsWith(PREFIX))
  for (const key of await store.keys()) if (key.startsWith(PREFIX) && key !== K.meta) await store.del(key)
  for (const [k, v] of entries) await store.set(k, v)
  return entries.length
}

interface Meta {
  lastBackupAt?: string
}

export async function markBackedUp(store: KeyValueStore, now = new Date()): Promise<void> {
  const meta = (await store.get<Meta>(K.meta)) ?? {}
  await store.set(K.meta, { ...meta, lastBackupAt: now.toISOString() })
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** The weekly nudge: shown when there's something worth saving and it hasn't been saved for a week. */
export async function backupDue(store: KeyValueStore, now = new Date()): Promise<boolean> {
  const profiles = (await store.get<{ createdAt: string }[]>(K.profiles)) ?? []
  if (profiles.length === 0) return false
  // Never backed up: count the week from the first profile, not from nothing,
  // so a brand-new phone isn't nagged on day one.
  const since = (await store.get<Meta>(K.meta))?.lastBackupAt ?? profiles.map((p) => p.createdAt).sort()[0]
  return now.getTime() - new Date(since).getTime() > WEEK_MS
}
