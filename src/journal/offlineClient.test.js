import { test, expect, describe, beforeEach, vi } from 'vitest'
import { createOfflineClient } from './offlineClient.js'

// Tests run in the 'node' environment (vitest.config.js), so localStorage and
// navigator aren't provided — stub a minimal in-memory localStorage and a
// settable navigator.onLine, matching what the browser gives the real code.
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}
let online = true
Object.defineProperty(globalThis, 'navigator', {
  value: { get onLine() { return online } },
  configurable: true,
})
function setOnline(v) { online = v }

function makeInner() {
  return {
    listEntries: vi.fn(),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
  }
}

const offlineError = () => new TypeError('Failed to fetch')

describe('createOfflineClient', () => {
  beforeEach(() => {
    localStorage.clear()
    setOnline(true)
  })

  test('caches the server list on a successful read', async () => {
    const inner = makeInner()
    const server = [{ id: 'a', date: '2026-06-24', entry: 'one' }]
    inner.listEntries.mockResolvedValue(server)
    const c = createOfflineClient(inner, { databaseId: 'db1' })

    const list = await c.listEntries()
    expect(list).toEqual(server)
    expect(c.offline).toBe(false)
    expect(JSON.parse(localStorage.getItem('jod_cache:db1'))).toEqual(server)
  })

  test('serves the cache (not an error) when the network is down', async () => {
    const inner = makeInner()
    const server = [{ id: 'a', date: '2026-06-24', entry: 'one' }]
    inner.listEntries.mockResolvedValueOnce(server)
    const c = createOfflineClient(inner, { databaseId: 'db1' })
    await c.listEntries() // prime the cache

    inner.listEntries.mockRejectedValueOnce(offlineError())
    const list = await c.listEntries()
    expect(list).toEqual(server)
    expect(c.offline).toBe(true)
  })

  test('a real (auth) error still rejects', async () => {
    const inner = makeInner()
    inner.listEntries.mockRejectedValue(new Error('API token is invalid.'))
    const c = createOfflineClient(inner, { databaseId: 'db1' })
    await expect(c.listEntries()).rejects.toThrow('API token is invalid.')
  })

  test('queues a create when offline and surfaces it optimistically', async () => {
    setOnline(false)
    const inner = makeInner()
    const c = createOfflineClient(inner, { databaseId: 'db1' })

    const entry = { date: '2026-06-25', entry: 'a fresh delight', tags: [], people: [] }
    const saved = await c.createEntry(entry)

    expect(inner.createEntry).not.toHaveBeenCalled()
    expect(saved.pending).toBe(true)
    expect(saved.id).toMatch(/^pending-/)
    expect(c.hasPending()).toBe(true)

    // It appears in the merged read even though the server knows nothing of it.
    inner.listEntries.mockRejectedValue(offlineError())
    const list = await c.listEntries()
    expect(list.find(e => e.date === '2026-06-25')?.pending).toBe(true)
  })

  test('queues an update when the live call drops mid-flight', async () => {
    const inner = makeInner()
    inner.updateEntry.mockRejectedValue(offlineError())
    const c = createOfflineClient(inner, { databaseId: 'db1' })

    const res = await c.updateEntry('real-1', { date: '2026-06-24', entry: 'edited', tags: [], people: [] })
    expect(res.pending).toBe(true)
    expect(c.hasPending()).toBe(true)
  })

  test('editing a still-queued entry amends the op in place (no double-write)', async () => {
    setOnline(false)
    const inner = makeInner()
    const c = createOfflineClient(inner, { databaseId: 'db1' })

    const created = await c.createEntry({ date: '2026-06-25', entry: 'first', tags: [], people: [] })
    await c.updateEntry(created.id, { date: '2026-06-25', entry: 'second', tags: [], people: [] })

    // Still one queued op, now carrying the edited text.
    const outbox = JSON.parse(localStorage.getItem('jod_outbox:db1'))
    expect(outbox).toHaveLength(1)
    expect(outbox[0].entry.entry).toBe('second')
  })

  test('sync() flushes the outbox in order and clears it', async () => {
    setOnline(false)
    const inner = makeInner()
    const c = createOfflineClient(inner, { databaseId: 'db1' })
    await c.createEntry({ date: '2026-06-25', entry: 'one', tags: [], people: [] })
    await c.updateEntry('real-1', { date: '2026-06-24', entry: 'two', tags: [], people: [] })

    setOnline(true)
    inner.createEntry.mockResolvedValue({ id: 'new-1' })
    inner.updateEntry.mockResolvedValue({ id: 'real-1' })

    const synced = await c.sync()
    expect(synced).toBe(2)
    expect(inner.createEntry).toHaveBeenCalledOnce()
    expect(inner.updateEntry).toHaveBeenCalledWith('real-1', expect.objectContaining({ entry: 'two' }))
    expect(c.hasPending()).toBe(false)
  })

  test('sync() stops at the first failure, leaving the rest queued', async () => {
    setOnline(false)
    const inner = makeInner()
    const c = createOfflineClient(inner, { databaseId: 'db1' })
    await c.createEntry({ date: '2026-06-25', entry: 'one', tags: [], people: [] })
    await c.createEntry({ date: '2026-06-26', entry: 'two', tags: [], people: [] })

    setOnline(true)
    inner.createEntry.mockResolvedValueOnce({ id: 'new-1' }).mockRejectedValueOnce(offlineError())
    const synced = await c.sync()
    expect(synced).toBe(1)
    expect(c.hasPending()).toBe(true)
  })
})
