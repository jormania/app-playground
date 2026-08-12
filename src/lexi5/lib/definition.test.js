import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchDefinition } from './definition'

describe('fetchDefinition', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports found for a real entry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ meanings: [{ definitions: [{ definition: 'A humanoid machine.' }] }] }],
    }))
    expect(await fetchDefinition('robot')).toEqual({ status: 'found', text: 'A humanoid machine.' })
  })

  // A word the API simply doesn't carry is not the same failure as a dead connection —
  // this used to be indistinguishable to callers, who reported both as "check your
  // connection" even for a word that plainly loaded, just with no dictionary entry.
  it('reports not-found on a 404, distinct from a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    expect(await fetchDefinition('gully')).toEqual({ status: 'not-found' })
  })

  it('reports not-found when the response has no usable definition', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] }))
    expect(await fetchDefinition('zzzzz')).toEqual({ status: 'not-found' })
  })

  it('reports error on a genuine network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    expect(await fetchDefinition('robot')).toEqual({ status: 'error' })
  })

  it('reports error on a server failure (5xx) rather than blaming the connection message on the caller', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    expect(await fetchDefinition('robot')).toEqual({ status: 'error' })
  })

  it('reports error on a rate limit (429)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }))
    expect(await fetchDefinition('robot')).toEqual({ status: 'error' })
  })
})
