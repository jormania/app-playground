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

/** Why a restore didn't happen: not a backup at all, a backup that's damaged, or the phone refused the writes. */
export class BackupError extends Error {
  constructor(readonly reason: 'not-json' | 'not-keypath' | 'damaged' | 'write-failed') {
    super(reason)
  }
}

/**
 * The shapes KeyPath can't open without: the players, and each player's log.
 * A file with the right header but a broken player list would otherwise go in
 * and leave the app unable to start.
 */
function damaged(data: Record<string, unknown>): boolean {
  const profiles = data[K.profiles]
  if (profiles !== undefined) {
    if (!Array.isArray(profiles)) return true
    if (!profiles.every((p) => p && typeof p === 'object' && typeof (p as { id?: unknown }).id === 'string' && typeof (p as { name?: unknown }).name === 'string')) return true
  }
  return Object.entries(data).some(([k, v]) => k.startsWith(`${PREFIX}log:`) && !Array.isArray(v))
}

/**
 * Restore replaces what's on the phone with the backup's contents. The
 * backup goes in first and what it doesn't hold is cleared after, so a write
 * that fails part way (the phone's storage full) never leaves the phone
 * empty: what was there is put back, and the restore reports it failed.
 */
export async function restoreBackup(store: KeyValueStore, text: string): Promise<number> {
  let parsed: Backup
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new BackupError('not-json')
  }
  if (parsed?.keypathBackup !== 1 || typeof parsed.data !== 'object' || parsed.data === null || Array.isArray(parsed.data)) throw new BackupError('not-keypath')
  const entries = Object.entries(parsed.data).filter(([k]) => k.startsWith(PREFIX) && k !== K.meta)
  if (damaged(Object.fromEntries(entries))) throw new BackupError('damaged')
  const before = new Map<string, unknown>()
  for (const key of await store.keys()) if (key.startsWith(PREFIX) && key !== K.meta) before.set(key, await store.get(key))
  try {
    for (const [k, v] of entries) await store.set(k, v)
    const kept = new Set(entries.map(([k]) => k))
    for (const key of before.keys()) if (!kept.has(key)) await store.del(key)
  } catch {
    for (const [k] of entries) if (!before.has(k)) await store.del(k).catch(() => {})
    for (const [k, v] of before) await store.set(k, v).catch(() => {})
    throw new BackupError('write-failed')
  }
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
