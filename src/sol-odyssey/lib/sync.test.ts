import { describe, it, expect, vi, afterEach } from 'vitest'
import { flushQueue, isNetworkError, type SyncDeps } from './sync'
import { checkinItem, enqueue, queueSize, reflectionItem, type StoreLike } from './queue'
import { EMPTY_SETTINGS, type Settings } from './settings'
import { EMPTY_CHECKIN } from './checkins'
import { EMPTY_REFLECTION } from './reflections'

function memStore(): StoreLike {
  const map = new Map<string, unknown>()
  return { get: async (k) => map.get(k), set: async (k, v) => void map.set(k, v) }
}

const settings: Settings = { ...EMPTY_SETTINGS, token: 't', dsCheckins: 'c', dsReflections: 'r', dsOdysseys: 'o' }
const odyssey = { id: 'o1', number: 1 }

function deps(over: Partial<SyncDeps>, store: StoreLike): SyncDeps {
  return {
    listCheckins: vi.fn(async () => []),
    upsertCheckin: vi.fn(async () => ({})),
    listReflections: vi.fn(async () => []),
    upsertReflection: vi.fn(async () => ({})),
    store,
    ...over,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('isNetworkError', () => {
  it('flags offline / dropped-fetch / relay-unreachable failures', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('Couldn’t reach the Notion relay (/api/notion).'))).toBe(true)
    expect(isNetworkError(new Error('Notion rejected the token.'))).toBe(false)
  })
})

describe('flushQueue', () => {
  it('replays each item, resolving existingId, and clears the queue on success', async () => {
    const store = memStore()
    await enqueue(checkinItem(odyssey, '2026-07-12', 7, { ...EMPTY_CHECKIN, done: true }), store)
    await enqueue(reflectionItem(odyssey, 1, '2026-07-13', { ...EMPTY_REFLECTION, temperature: 6 }), store)

    const upsertCheckin = vi.fn(async () => ({}))
    const upsertReflection = vi.fn(async () => ({}))
    const d = deps(
      {
        upsertCheckin,
        upsertReflection,
        // an existing check-in row for that date → existingId should be resolved to it
        listCheckins: vi.fn(async () => [
          { id: 'existing-c', date: '2026-07-12', dayIndex: 7, done: false, oneLine: '', friction: '', sentToBuddy: false },
        ]),
        listReflections: vi.fn(async () => []),
      },
      store,
    )

    const res = await flushQueue(settings, d)
    expect(res).toEqual({ synced: 2, remaining: 0 })
    expect(await queueSize(store)).toBe(0)
    expect(upsertCheckin).toHaveBeenCalledWith(settings, expect.objectContaining({ existingId: 'existing-c', dateISO: '2026-07-12' }))
    // no existing reflection for week 1 → POST (existingId undefined)
    expect(upsertReflection).toHaveBeenCalledWith(settings, expect.objectContaining({ existingId: undefined, weekIndex: 1 }))
  })

  it('keeps an item queued when its write fails, and reports remaining', async () => {
    const store = memStore()
    await enqueue(checkinItem(odyssey, '2026-07-12', 7, EMPTY_CHECKIN), store)
    const d = deps({ upsertCheckin: vi.fn(async () => { throw new Error('boom') }) }, store)

    const res = await flushQueue(settings, d)
    expect(res).toEqual({ synced: 0, remaining: 1 })
    expect(await queueSize(store)).toBe(1)
  })

  it('is a no-op when offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const store = memStore()
    await enqueue(checkinItem(odyssey, '2026-07-12', 7, EMPTY_CHECKIN), store)
    const upsertCheckin = vi.fn(async () => ({}))
    const res = await flushQueue(settings, deps({ upsertCheckin }, store))
    expect(upsertCheckin).not.toHaveBeenCalled()
    expect(res).toEqual({ synced: 0, remaining: 1 })
  })
})
