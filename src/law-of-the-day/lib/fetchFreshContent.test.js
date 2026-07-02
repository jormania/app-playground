import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchFreshContent } from './fetchFreshContent'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchFreshContent', () => {
  it('returns the parsed content on a successful, well-shaped response', async () => {
    const payload = { lawId: 5, scenarioText: 'a scenario', explanationText: 'an explanation' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    }))

    const result = await fetchFreshContent(5)
    expect(result).toEqual(payload)
  })

  it('returns null on a non-200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    expect(await fetchFreshContent(5)).toBeNull()
  })

  it('returns null when the response body is missing expected fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ lawId: 5 }),
    }))
    expect(await fetchFreshContent(5)).toBeNull()
  })

  it('returns null when fetch throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    expect(await fetchFreshContent(5)).toBeNull()
  })

  it('returns null when the response body is not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw new Error('invalid json') },
    }))
    expect(await fetchFreshContent(5)).toBeNull()
  })
})
