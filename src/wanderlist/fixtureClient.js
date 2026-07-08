// In-memory client with the SAME interface as the live Notion client, so the UI can't
// tell them apart. Backed by localStorage so created/edited items survive a reload — it
// should feel like a real backlog while you build (and in the public demo) before any
// token exists. Mirrors JoD's fixtureClient.
import { seedEntries } from './fixtures.js'
import { todayKey } from './dates.js'

const STORE_KEY = 'wanderlist_fixture_entries'

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* fall through to seed */ }
  const seeded = seedEntries()
  save(seeded)
  return seeded
}

function save(entries) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(entries)) } catch { /* ignore quota */ }
}

export function createFixtureClient() {
  return {
    mode: 'fixtures',

    async listEntries() {
      return load()
    },

    async createEntry(entry) {
      const entries = load()
      const saved = { ...entry, id: `local-${Date.now()}`, dateAdded: entry.dateAdded || todayKey() }
      save([saved, ...entries])
      return saved
    },

    async updateEntry(id, entry) {
      const entries = load()
      const saved = { ...entry, id }
      save(entries.map(e => (e.id === id ? saved : e)))
      return saved
    },

    // Demo mode has no backend to upload to — an object URL stands in for a Notion-hosted
    // file. It only survives this tab session, which is fine: demo data is sample content,
    // not something anyone relies on persisting.
    async uploadFile(blob, filename) {
      return { ref: URL.createObjectURL(blob), name: filename }
    },

    async attachPhoto(pageId, photo) {
      const entries = load()
      const updated = entries.map(e => (e.id === pageId ? { ...e, photo: { url: photo.ref, name: photo.name } } : e))
      save(updated)
      return updated.find(e => e.id === pageId)
    },

    async removePhoto(pageId) {
      const entries = load()
      const updated = entries.map(e => (e.id === pageId ? { ...e, photo: null } : e))
      save(updated)
      return updated.find(e => e.id === pageId)
    },

    async setTickets(pageId, tickets) {
      const entries = load()
      const updated = entries.map(e => (e.id === pageId
        ? { ...e, tickets: (tickets || []).map(t => ({ url: t.ref || t.url, name: t.name, fileUploadId: null })) }
        : e))
      save(updated)
      return updated.find(e => e.id === pageId)
    },
  }
}

// Test/escape hatch: wipe the local sample data so seeds are restored next load.
export function resetFixtures() {
  try { localStorage.removeItem(STORE_KEY) } catch { /* ignore */ }
}
