import { test, expect, describe, beforeEach, vi } from 'vitest'
import { geocode, cachedGeocode } from './geocode.js'

// Node env (vitest.config.js) — stub a minimal in-memory localStorage, same harness the
// offlineClient test uses.
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}

beforeEach(() => {
  store.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('cachedGeocode', () => {
  test('undefined when never looked up; the stored value once cached (incl. a null miss)', () => {
    expect(cachedGeocode('Cinema Pro')).toBeUndefined()
    localStorage.setItem('wanderlist_geocode', JSON.stringify({ 'Cinema Pro': { lat: 44.4, lon: 26.1 }, 'Nowhere': null }))
    expect(cachedGeocode('Cinema Pro')).toEqual({ lat: 44.4, lon: 26.1 })
    expect(cachedGeocode('Nowhere')).toBeNull()   // known miss, not "unknown"
    expect(cachedGeocode('Other')).toBeUndefined()
  })
  test('blank place -> null', () => {
    expect(cachedGeocode('')).toBeNull()
    expect(cachedGeocode(null)).toBeNull()
  })
})

describe('geocode', () => {
  test('fetches, returns lat/lon, and caches the hit', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '44.4325', lon: '26.1039' }],
    })
    vi.stubGlobal('fetch', fetchMock)
    const r = await geocode('Cinema Pro, București')
    expect(r).toEqual({ lat: 44.4325, lon: 26.1039 })
    expect(fetchMock).toHaveBeenCalledOnce()
    // second call is served from cache — no new fetch
    const r2 = await geocode('Cinema Pro, București')
    expect(r2).toEqual({ lat: 44.4325, lon: 26.1039 })
    expect(fetchMock).toHaveBeenCalledOnce()
  })
  test('caches a miss (empty results) as null so it is not re-queried', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetchMock)
    expect(await geocode('Nowhere in particular')).toBeNull()
    expect(await geocode('Nowhere in particular')).toBeNull()
    expect(fetchMock).toHaveBeenCalledOnce()
  })
  test('never throws on a network error — resolves null (and does not cache)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    expect(await geocode('Somewhere')).toBeNull()
    expect(cachedGeocode('Somewhere')).toBeUndefined()  // not cached, so it retries later
  })
  test('blank place resolves null without fetching', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await geocode('   ')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
