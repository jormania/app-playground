// The offline / demo client. Loom is local-first: this holds the whole thread
// array in localStorage and is the single source of truth until a Notion token
// is set (see store.js). Same method surface as notionClient — list/create/
// update/remove — so the app never knows which one it's talking to.
import { demoThreads } from './fixtures.js'

const STORE_KEY = 'loom_threads'
const SEED_KEY = 'loom_seeded'

function read() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}

function write(threads) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(threads)) } catch { /* quota */ }
}

// A stable-ish local id — good enough for a single-device demo store.
function newId() {
  return `loom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createLocalClient() {
  return {
    mode: 'demo',

    // First run seeds the demo threads once; after that we respect whatever the
    // user has (even an empty board — clearing everything must stick, not reseed).
    async listThreads() {
      const existing = read()
      if (existing) return existing
      let seeded = false
      try { seeded = localStorage.getItem(SEED_KEY) === '1' } catch { /* ignore */ }
      if (seeded) return []
      const seed = demoThreads()
      write(seed)
      try { localStorage.setItem(SEED_KEY, '1') } catch { /* ignore */ }
      return seed
    },

    async createThread(thread) {
      const threads = read() || []
      const created = { ...thread, id: newId() }
      write([...threads, created])
      return created
    },

    async updateThread(id, patch) {
      const threads = read() || []
      const next = threads.map(t => (t.id === id ? { ...t, ...patch, id } : t))
      write(next)
      return next.find(t => t.id === id) || null
    },

    async removeThread(id) {
      const threads = read() || []
      write(threads.filter(t => t.id !== id))
      return { ok: true }
    },

    // Replace the whole board (used by "clear the loom" and by tests).
    async replaceAll(threads) {
      write(threads)
      try { localStorage.setItem(SEED_KEY, '1') } catch { /* ignore */ }
      return threads
    },
  }
}
