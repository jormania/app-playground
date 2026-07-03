// A minimal IndexedDB key-value store, shared between a page and its service worker (the
// worker can't read localStorage). Each app opens its own db/store name so state never
// cross-contaminates between apps.

export interface IdbKv {
  get<T = unknown>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
}

function openDb(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(storeName)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function createIdbKv(dbName: string, storeName = 'kv'): IdbKv {
  return {
    async get<T = unknown>(key: string): Promise<T | undefined> {
      try {
        const db = await openDb(dbName, storeName)
        return await new Promise<T | undefined>((resolve) => {
          const r = db.transaction(storeName, 'readonly').objectStore(storeName).get(key)
          r.onsuccess = () => resolve(r.result)
          r.onerror = () => resolve(undefined)
        })
      } catch {
        return undefined
      }
    },
    async set(key: string, value: unknown): Promise<void> {
      try {
        const db = await openDb(dbName, storeName)
        await new Promise<void>((resolve) => {
          const tx = db.transaction(storeName, 'readwrite')
          tx.objectStore(storeName).put(value, key)
          tx.oncomplete = () => resolve()
          tx.onerror = () => resolve()
        })
      } catch {
        /* IDB unavailable — reminders just won't fire in the background */
      }
    },
  }
}
