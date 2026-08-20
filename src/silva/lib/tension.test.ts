import { describe, it, expect, vi } from 'vitest'
import { confirmTension } from './tension'
import type { Thing } from './notion'

function thing(overrides: Partial<Thing>): Thing {
  return {
    id: 'thing-1',
    handle: 'A thing',
    body: 'A thing worth keeping.',
    kind: 'Passage',
    state: 'Kept',
    sourceId: null,
    locator: '',
    encountered: '2026-01-01',
    kept: '2026-01-01',
    note: '',
    lociIds: [],
    image: null,
    link: null,
    koboBookmarkId: null,
    arrived: null,
    ...overrides,
  }
}

function stubFetchWithText(text: string) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status: 200 }),
  )
}

describe('confirmTension', () => {
  it('returns false without a key, never calling fetch', async () => {
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)
    const result = await confirmTension('', thing({ id: 'a' }), thing({ id: 'b' }))
    expect(result).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('returns true when the model answers yes', async () => {
    vi.stubGlobal('fetch', stubFetchWithText('Yes'))
    const result = await confirmTension('sk-ant-test', thing({ id: 'a' }), thing({ id: 'b' }))
    expect(result).toBe(true)
    vi.unstubAllGlobals()
  })

  it('returns false when the model answers no', async () => {
    vi.stubGlobal('fetch', stubFetchWithText('no'))
    const result = await confirmTension('sk-ant-test', thing({ id: 'a' }), thing({ id: 'b' }))
    expect(result).toBe(false)
    vi.unstubAllGlobals()
  })

  it('returns false on a non-ok response rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
    const result = await confirmTension('sk-ant-bad', thing({ id: 'a' }), thing({ id: 'b' }))
    expect(result).toBe(false)
    vi.unstubAllGlobals()
  })

  it('returns false on a network failure rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const result = await confirmTension('sk-ant-test', thing({ id: 'a' }), thing({ id: 'b' }))
    expect(result).toBe(false)
    vi.unstubAllGlobals()
  })
})
