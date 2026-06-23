// In-memory client with the SAME interface as the live Notion client, so the UI
// can't tell them apart. Backed by localStorage so created/edited delights survive
// a reload — it should feel like a real journal while you build, before any token
// exists. This is the "fixtures first" half of the build plan.
import { wordCount } from './notion.js'
import { seedEntries } from './fixtures.js'

const STORE_KEY = 'jod_fixture_entries'

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

// Notion recomputes Word Count from the Entry on every write; the fixture client
// mirrors that so the saved value matches what live mode would show.
function withCount(entry) {
  return { ...entry, wordCount: wordCount(entry.entry) }
}

export function createFixtureClient() {
  return {
    mode: 'fixtures',

    async listEntries() {
      return load()
    },

    async createEntry(entry) {
      const entries = load()
      const saved = withCount({ ...entry, id: `local-${Date.now()}` })
      save([saved, ...entries])
      return saved
    },

    async updateEntry(id, entry) {
      const entries = load()
      const saved = withCount({ ...entry, id })
      save(entries.map(e => (e.id === id ? saved : e)))
      return saved
    },
  }
}

// Test/escape hatch: wipe the local sample data so seeds are restored next load.
export function resetFixtures() {
  try { localStorage.removeItem(STORE_KEY) } catch { /* ignore */ }
}
