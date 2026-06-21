// A minimal IndexedDB key-value store, shared between the page and the service
// worker (the SW can't read localStorage). Holds what the SW needs to decide
// the daily call on its own in the background: coords, the toggle, the last day
// it was sent, and whether/what was walked today.

const DB_NAME = 'tg-call'
const STORE = 'kv'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbGet(key) {
  try {
    const db = await openDB()
    return await new Promise((resolve) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => resolve(undefined)
    })
  } catch (_) {
    return undefined
  }
}

export async function idbSet(key, val) {
  try {
    const db = await openDB()
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(val, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch (_) {}
}
