// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getHealthKey, setHealthKey, hasHealthKey, fetchSleep, fetchWindow, HealthClientError, HEALTH_KEY_STORAGE, localDate,
} from './googleHealth'

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('the key', () => {
  it('is one JSON-encoded entry that every app (and the static page) shares', () => {
    setHealthKey('  abc ')
    expect(localStorage.getItem(HEALTH_KEY_STORAGE)).toBe('"abc"')
    expect(getHealthKey()).toBe('abc')
    setHealthKey('')
    expect(hasHealthKey()).toBe(false)
  })
})

describe('calls', () => {
  it('refuse to go out without a key', async () => {
    await expect(fetchSleep('2026-11-01', '2026-11-04')).rejects.toMatchObject({ code: 'no_key' })
  })

  it('send the key as a header, never in the URL', async () => {
    setHealthKey('abc')
    const f = vi.fn(async (_url: string, _init: RequestInit) => ({ ok: true, json: async () => ({ nights: [{ date: '2026-11-04' }] }) }))
    vi.stubGlobal('fetch', f)
    const nights = await fetchSleep('2026-11-01', '2026-11-04')
    expect(nights).toEqual([{ date: '2026-11-04' }])
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('/api/google-health?mode=sleep&from=2026-11-01&to=2026-11-04')
    expect(url).not.toContain('abc')
    expect((init.headers as Record<string, string>)['x-health-key']).toBe('abc')
  })

  it('carry the server message and code on failure', async () => {
    setHealthKey('abc')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 409, json: async () => ({ message: 'Reconnect', code: 'reconnect' }) })))
    const err = await fetchWindow(0, 60000).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(HealthClientError)
    expect(err).toMatchObject({ status: 409, code: 'reconnect', message: 'Reconnect' })
  })

  it('time out instead of hanging the caller', async () => {
    setHealthKey('abc')
    vi.stubGlobal('fetch', vi.fn((_u: string, init: RequestInit) => new Promise((_res, rej) => {
      init.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    })))
    await expect(fetchWindow(0, 60000, 20)).rejects.toMatchObject({ code: 'timeout' })
  })
})

it('localDate uses the device calendar', () => {
  // TZ=Europe/Bucharest under npm test: 23:30 UTC on 3 Nov is 4 Nov locally
  expect(localDate(Date.parse('2026-11-03T23:30:00Z'))).toBe('2026-11-04')
})
