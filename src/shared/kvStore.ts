import { createStore, del, entries, get, keys, promisifyRequest, set, setMany } from 'idb-keyval'

/**
 * A small key-value seam over IndexedDB, so an app's repository can run on
 * memory in tests and on the phone's IndexedDB in the browser.
 *
 * Promoted from The Long Listen (`src/long-listen/store/repo.ts`, which now
 * re-exports it) when Stillflow became the second app to need it. Each app gets
 * a database of its own by name, so one app's "reset" can never touch another's.
 *
 * KeyPath deliberately keeps its own, smaller `store.ts`: it lives in
 * idb-keyval's default database, and moving it here would mean a migration
 * that, done wrong, empties every profile on the phone.
 */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  setMany(pairs: [string, unknown][]): Promise<void>
  del(key: string): Promise<void>
  keys(): Promise<string[]>
  entries(): Promise<[string, unknown][]>
  /** Delete these keys and write these pairs as one change: all of it lands, or none of it. */
  replace(deleteKeys: string[], pairs: [string, unknown][]): Promise<void>
}

export function indexedDbStore(dbName: string, storeName = 'records'): KeyValueStore {
  const db = createStore(dbName, storeName)
  return {
    get: (key) => get(key, db),
    set: (key, value) => set(key, value, db),
    setMany: (pairs) => setMany(pairs, db),
    del: (key) => del(key, db),
    keys: async () => (await keys(db)).map(String),
    entries: async () => (await entries(db)).map(([k, v]) => [String(k), v] as [string, unknown]),
    // One readwrite transaction: a page closed or a write refused halfway rolls the whole of it back.
    replace: (deleteKeys, pairs) => db('readwrite', (store) => {
      for (const k of deleteKeys) store.delete(k)
      for (const [k, v] of pairs) store.put(v, k)
      return promisifyRequest(store.transaction)
    }),
  }
}

export function memoryStore(initial: Record<string, unknown> = {}): KeyValueStore {
  const m = new Map<string, unknown>(Object.entries(initial))
  return {
    get: async <T,>(key: string) => structuredClone(m.get(key)) as T | undefined,
    set: async (key, value) => void m.set(key, structuredClone(value)),
    setMany: async (pairs) => { for (const [k, v] of pairs) m.set(k, structuredClone(v)) },
    del: async (key) => void m.delete(key),
    keys: async () => [...m.keys()],
    entries: async () => [...m.entries()].map(([k, v]) => [k, structuredClone(v)] as [string, unknown]),
    replace: async (deleteKeys, pairs) => {
      // Cloned before anything changes, so a value that can't be stored leaves the map as it was.
      const copies = pairs.map(([k, v]): [string, unknown] => [k, structuredClone(v)])
      for (const k of deleteKeys) m.delete(k)
      for (const [k, v] of copies) m.set(k, v)
    },
  }
}
