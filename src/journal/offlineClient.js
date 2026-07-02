// Makes the journal usable with no connection. Wraps the live Notion client so the
// UI keeps the same listEntries / createEntry / updateEntry interface, but:
//   • the last successful read is CACHED locally, so the journal is browsable offline;
//   • writes made offline go into an OUTBOX and sync to Notion on reconnect.
// Fixtures mode is already fully local, so it isn't wrapped — only live mode is.
//
// Two localStorage stores, keyed by databaseId so pointing the app at a different
// database can never cross-contaminate cached entries or queued writes:
//   jod_cache:<id>   — array, the raw last-synced server list
//   jod_outbox:<id>  — array of pending ops { tempId, kind, id?, entry, queuedAt }
import { wordCount } from './notion.js'

const CACHE_PREFIX = 'jod_cache:'
const OUTBOX_PREFIX = 'jod_outbox:'

// Unique even for two writes in the same millisecond (Date.now() alone collides,
// and a colliding temp id would let one sync remove another queued op).
let seq = 0
const tempId = () => `pending-${Date.now()}-${seq++}`

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore quota */ }
}

// A failed save is "offline" (queue it) when the network never answered — a true
// fetch rejection is a TypeError. A proxy Error WITH a message (bad token, DB not
// shared, 4xx) is a real error we must surface, not silently swallow.
function isOfflineError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  return err instanceof TypeError || /failed to fetch|networkerror|network request failed/i.test(err?.message || '')
}

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false

// Lay the queued writes over a base list, tagging each touched entry `pending: true`
// so the UI can mark it "not yet synced". Creates surface under a temp id.
function applyOutbox(base, outbox) {
  const list = (base || []).map(e => ({ ...e }))
  for (const op of outbox) {
    const optimistic = { ...op.entry, pending: true, wordCount: wordCount(op.entry?.entry) }
    if (op.kind === 'create') {
      list.unshift({ ...optimistic, id: op.tempId })
    } else {
      const idx = list.findIndex(e => e.id === op.id)
      if (idx >= 0) list[idx] = { ...optimistic, id: op.id }
      else list.unshift({ ...optimistic, id: op.id })
    }
  }
  return list
}

export function createOfflineClient(inner, { databaseId = 'default' } = {}) {
  const cacheKey = CACHE_PREFIX + databaseId
  const outboxKey = OUTBOX_PREFIX + databaseId

  const getCache = () => readJSON(cacheKey, [])
  const setCache = (list) => writeJSON(cacheKey, list)
  const getOutbox = () => readJSON(outboxKey, [])
  const setOutbox = (ops) => writeJSON(outboxKey, ops)
  const pushOp = (op) => { const q = getOutbox(); q.push(op); setOutbox(q) }
  const removeOp = (tempId) => setOutbox(getOutbox().filter(o => o.tempId !== tempId))

  const client = {
    mode: 'live',
    databaseId,
    // Set by listEntries(): true when the result was served from cache (offline).
    offline: false,

    async listEntries() {
      const outbox = getOutbox()
      try {
        const fresh = await inner.listEntries()
        setCache(fresh)
        this.offline = false
        return applyOutbox(fresh, outbox)
      } catch (err) {
        if (isOfflineError(err)) {
          this.offline = true
          return applyOutbox(getCache(), outbox)
        }
        throw err // real error (bad token / DB not shared) — surface it
      }
    },

    async createEntry(entry) {
      if (!offline()) {
        try {
          const saved = await inner.createEntry(entry)
          setCache([saved, ...getCache()])
          return saved
        } catch (err) {
          if (!isOfflineError(err)) throw err
        }
      }
      // Offline (or the call dropped): queue it and hand back an optimistic entry.
      const id = tempId()
      pushOp({ tempId: id, kind: 'create', entry, queuedAt: Date.now() })
      return { ...entry, id, pending: true, wordCount: wordCount(entry.entry) }
    },

    async updateEntry(id, entry) {
      // Editing an entry that is itself still queued (a pending create, or a prior
      // pending edit): amend the queued op in place rather than stacking a second
      // op against a temp id that Notion will never know.
      const outbox = getOutbox()
      const queued = outbox.find(o => o.tempId === id || (o.kind === 'update' && o.id === id))
      if (queued) {
        setOutbox(outbox.map(o => (o.tempId === queued.tempId ? { ...o, entry } : o)))
        return { ...entry, id, pending: true, wordCount: wordCount(entry.entry) }
      }
      if (!offline()) {
        try {
          const saved = await inner.updateEntry(id, entry)
          setCache(getCache().map(e => (e.id === id ? saved : e)))
          return saved
        } catch (err) {
          if (!isOfflineError(err)) throw err
        }
      }
      pushOp({ tempId: tempId(), kind: 'update', id, entry, queuedAt: Date.now() })
      return { ...entry, id, pending: true, wordCount: wordCount(entry.entry) }
    },

    hasPending() {
      return getOutbox().length > 0
    },

    // Photo actions need a live connection outright (the upload itself is a
    // network call before any of this runs) — no offline queueing, just a
    // passthrough that keeps the local cache in step with what Notion now holds.
    async uploadPhoto(blob, filename) {
      return inner.uploadPhoto(blob, filename)
    },

    async attachPhoto(pageId, photo) {
      const page = await inner.attachPhoto(pageId, photo)
      setCache(getCache().map(e => (e.id === pageId ? page : e)))
      return page
    },

    async removePhoto(pageId) {
      const page = await inner.removePhoto(pageId)
      setCache(getCache().map(e => (e.id === pageId ? page : e)))
      return page
    },

    // Replay the outbox in order. Stops at the first op that fails (offline again,
    // or a real error) and leaves it — plus everything after — queued for next time.
    // Returns how many ops synced.
    async sync() {
      let synced = 0
      for (const op of getOutbox()) {
        try {
          if (op.kind === 'create') await inner.createEntry(op.entry)
          else await inner.updateEntry(op.id, op.entry)
          removeOp(op.tempId)
          synced++
        } catch {
          break
        }
      }
      return synced
    },
  }
  return client
}
