import { del, get, keys, set } from 'idb-keyval'

/**
 * Where KeyPath keeps everything: profiles, settings, the engagement log.
 * IndexedDB on the phone, via idb-keyval — local only, never uploaded
 * (KEYPATH_TUTOR.md §6). An interface so tests can swap in memory.
 */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  del(key: string): Promise<void>
  keys(): Promise<string[]>
}

export const indexedDbStore: KeyValueStore = {
  get: (key) => get(key),
  set: (key, value) => set(key, value),
  del: (key) => del(key),
  keys: async () => (await keys()).map(String),
}

export function memoryStore(initial: Record<string, unknown> = {}): KeyValueStore {
  const m = new Map<string, unknown>(Object.entries(initial))
  return {
    get: async <T,>(key: string) => structuredClone(m.get(key)) as T | undefined,
    set: async (key, value) => void m.set(key, structuredClone(value)),
    del: async (key) => void m.delete(key),
    keys: async () => [...m.keys()],
  }
}

/** Every KeyPath key starts with this; a backup is exactly the keys under it. */
export const PREFIX = 'keypath:v1:'
export const K = {
  profiles: `${PREFIX}profiles`,
  current: `${PREFIX}current`,
  meta: `${PREFIX}meta`,
  /** The keyboard this phone last connected to, for Home's first-run card. */
  keyboard: `${PREFIX}keyboard`,
  settings: (profileId: string) => `${PREFIX}settings:${profileId}`,
  log: (profileId: string) => `${PREFIX}log:${profileId}`,
  journey: (profileId: string) => `${PREFIX}journey:${profileId}`,
  studio: (profileId: string) => `${PREFIX}studio:${profileId}`,
}

export type Persistence = 'persisted' | 'best-effort' | 'unknown'

/**
 * Ask Chrome not to evict KeyPath's data when the phone is short of space.
 * Granted more readily to apps added to the home screen. Never throws.
 */
export async function requestPersistence(): Promise<Persistence> {
  try {
    const sm = typeof navigator === 'undefined' ? undefined : navigator.storage
    if (!sm?.persist) return 'unknown'
    if (await sm.persisted()) return 'persisted'
    return (await sm.persist()) ? 'persisted' : 'best-effort'
  } catch {
    return 'unknown'
  }
}

export async function persistenceState(): Promise<Persistence> {
  try {
    const sm = typeof navigator === 'undefined' ? undefined : navigator.storage
    if (!sm?.persisted) return 'unknown'
    return (await sm.persisted()) ? 'persisted' : 'best-effort'
  } catch {
    return 'unknown'
  }
}
