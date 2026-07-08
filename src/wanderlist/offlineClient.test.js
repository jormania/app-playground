import { test, expect, describe, beforeEach, vi } from 'vitest'
import { createOfflineClient } from './offlineClient.js'

// Tests run in the 'node' environment (vitest.config.js) — stub a minimal in-memory
// localStorage and a settable navigator.onLine, matching the browser. (Same harness as
// Journal of Delights' offlineClient test.)
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
  return { listEntries: vi.fn(), createEntry: vi.fn(), updateEntry: vi.fn() }
}
const offlineError = () => new TypeError('Failed to fetch')

describe('createOfflineClient', () => {
  beforeEach(() => { localStorage.clear(); setOnline(true) })

  test('caches the server list on a successful read', async () => {
    const inner = makeInner()
    const server = [{ id: 'a', name: 'one', dateExpiring: '2026-07-10' }]
    inner.listEntries.mockResolvedValue(server)
    const c = createOfflineClient(inner, { databaseId: 'db' })
    expect(await c.listEntries()).toEqual(server)
    expect(c.offline).toBe(false)
  })

  test('serves cache + queued creates when offline, then syncs on reconnect', async () => {
    const inner = makeInner()
    inner.listEntries.mockResolvedValueOnce([{ id: 'a', name: 'one' }]) // seed cache
    const c = createOfflineClient(inner, { databaseId: 'db' })
    await c.listEntries()

    setOnline(false)
    const created = await c.createEntry({ name: 'two' })
    expect(created.pending).toBe(true)
    expect(c.hasPending()).toBe(true)

    // Offline read overlays the queued create on the cached list.
    inner.listEntries.mockRejectedValueOnce(offlineError())
    const list = await c.listEntries()
    expect(list.map(e => e.name)).toContain('two')
    expect(c.offline).toBe(true)

    // Reconnect → sync replays the outbox.
    setOnline(true)
    inner.createEntry.mockResolvedValue({ id: 'server-2', name: 'two' })
    expect(await c.sync()).toBe(1)
    expect(c.hasPending()).toBe(false)
    expect(inner.createEntry).toHaveBeenCalledWith({ name: 'two' })
  })

  test('a real error (bad token) surfaces instead of being queued', async () => {
    const inner = makeInner()
    inner.listEntries.mockRejectedValue(new Error('API token is invalid'))
    const c = createOfflineClient(inner, { databaseId: 'db' })
    await expect(c.listEntries()).rejects.toThrow(/invalid/)
  })

  test('editing a still-queued create amends it in place, not a second op', async () => {
    const inner = makeInner()
    inner.listEntries.mockResolvedValueOnce([])
    const c = createOfflineClient(inner, { databaseId: 'db' })
    await c.listEntries()
    setOnline(false)
    const created = await c.createEntry({ name: 'draft' })
    await c.updateEntry(created.id, { name: 'refined' })
    setOnline(true)
    inner.createEntry.mockResolvedValue({ id: 's', name: 'refined' })
    expect(await c.sync()).toBe(1)
    expect(inner.createEntry).toHaveBeenCalledTimes(1)
    expect(inner.createEntry).toHaveBeenCalledWith({ name: 'refined' })
  })
})
