import { indexedDbStore, type KeyValueStore } from '../../shared/kvStore'
import {
  normalisePreferences,
  type Backup, type PracticeEntry, type Preferences, type Session, type UserCollection, type UserSessionData,
} from '../domain/types'

/**
 * Stillflow's data access. The only module that knows records live in
 * IndexedDB, under one key per record in a database of Stillflow's own. Swap
 * `KeyValueStore` for a Supabase-backed one and nothing above this file changes.
 *
 * Catalogue and personal data sit under different prefixes, so catalogue
 * imports (even "replace") never touch favourites, history or collections.
 */

export const PREFIX = 'sf:v1:'
const K = {
  session: (id: string) => `${PREFIX}session:${id}`,
  user: (id: string) => `${PREFIX}user:${id}`,
  history: (id: string) => `${PREFIX}history:${id}`,
  collection: (id: string) => `${PREFIX}collection:${id}`,
  prefs: `${PREFIX}prefs`,
  meta: `${PREFIX}meta`,
}

interface Meta {
  /** True once the demo records have been offered, so deleting them sticks. */
  seeded: boolean
}

export interface Snapshot {
  sessions: Session[]
  userData: Record<string, UserSessionData>
  history: PracticeEntry[]
  collections: UserCollection[]
  preferences: Preferences
}

export class StillflowRepo {
  constructor(private readonly store: KeyValueStore) {}

  private async byPrefix<T>(kind: string): Promise<T[]> {
    const p = `${PREFIX}${kind}:`
    return (await this.store.entries()).filter(([k]) => k.startsWith(p)).map(([, v]) => v as T)
  }

  async load(): Promise<Snapshot> {
    const [sessions, users, history, collections, prefs] = await Promise.all([
      this.byPrefix<Session>('session'),
      this.byPrefix<UserSessionData>('user'),
      this.byPrefix<PracticeEntry>('history'),
      this.byPrefix<UserCollection>('collection'),
      this.store.get<Partial<Preferences>>(K.prefs),
    ])
    return {
      sessions,
      userData: Object.fromEntries(users.map((u) => [u.sessionId, u])),
      history: history.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
      collections: collections.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      preferences: normalisePreferences(prefs),
    }
  }

  /** Writes the demo records once, on a device that has never had a catalogue. */
  async seedOnce(demo: Session[]): Promise<boolean> {
    const meta = await this.store.get<Meta>(K.meta)
    if (meta?.seeded) return false
    const existing = await this.byPrefix<Session>('session')
    const pairs: [string, unknown][] = [[K.meta, { seeded: true } satisfies Meta]]
    if (existing.length === 0) for (const s of demo) pairs.push([K.session(s.id), s])
    await this.store.setMany(pairs)
    return existing.length === 0
  }

  putSessions(sessions: Session[]) {
    return this.store.setMany(sessions.map((s) => [K.session(s.id), s]))
  }

  deleteSessions(ids: string[]) {
    return this.store.replace(ids.map(K.session), [])
  }

  putUserData(data: UserSessionData) {
    return this.store.set(K.user(data.sessionId), data)
  }

  putHistory(entry: PracticeEntry) {
    return this.store.set(K.history(entry.id), entry)
  }

  deleteHistory(id: string) {
    return this.store.del(K.history(id))
  }

  putCollection(c: UserCollection) {
    return this.store.set(K.collection(c.id), c)
  }

  deleteCollection(id: string) {
    return this.store.del(K.collection(id))
  }

  putPreferences(p: Preferences) {
    return this.store.set(K.prefs, p)
  }

  async exportBackup(now = new Date()): Promise<Backup> {
    const s = await this.load()
    return {
      app: 'stillflow',
      version: 1,
      exportedAt: now.toISOString(),
      sessions: s.sessions,
      userData: Object.values(s.userData),
      history: s.history,
      collections: s.collections,
      preferences: s.preferences,
    }
  }

  /** Replaces everything with the backup's contents, in one transaction. */
  async restoreBackup(b: Backup): Promise<void> {
    const old = (await this.store.keys()).filter((k) => k.startsWith(PREFIX))
    const pairs: [string, unknown][] = [
      [K.meta, { seeded: true } satisfies Meta],
      [K.prefs, normalisePreferences(b.preferences)],
      ...b.sessions.map((s): [string, unknown] => [K.session(s.id), s]),
      ...b.userData.map((u): [string, unknown] => [K.user(u.sessionId), u]),
      ...b.history.map((h): [string, unknown] => [K.history(h.id), h]),
      ...b.collections.map((c): [string, unknown] => [K.collection(c.id), c]),
    ]
    await this.store.replace(old, pairs)
  }

  /** Erases every Stillflow record on this device. The demo is not re-offered. */
  async resetAll(): Promise<void> {
    const old = (await this.store.keys()).filter((k) => k.startsWith(PREFIX))
    await this.store.replace(old, [[K.meta, { seeded: true } satisfies Meta]])
  }
}

export function openRepo(): StillflowRepo {
  return new StillflowRepo(indexedDbStore('stillflow'))
}

export function isBackup(value: unknown): value is Backup {
  const b = value as Backup
  return !!b && b.app === 'stillflow' && b.version === 1 &&
    [b.sessions, b.userData, b.history, b.collections].every(Array.isArray)
}
