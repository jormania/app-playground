import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Thing } from './notion'

const embed = vi.fn()
const getVector = vi.fn()
const setVector = vi.fn()

vi.mock('./embeddings', async () => {
  const actual = await vi.importActual<typeof import('./embeddings')>('./embeddings')
  return { ...actual, embed: (text: string) => embed(text) }
})
vi.mock('./vectorCache', () => ({
  getVector: (id: string, hash: string) => getVector(id, hash),
  setVector: (id: string, hash: string, v: Float32Array) => setVector(id, hash, v),
}))

const { indexThings, indexableThings } = await import('./indexer')

function thing(patch: Partial<Thing>): Thing {
  return {
    id: 'x', handle: 'x', body: 'body', kind: null, state: 'Kept', sourceId: null,
    locator: '', encountered: '2026-01-01', kept: '2026-01-01', note: '',
    lociIds: [], image: null, link: null, koboBookmarkId: null, arrived: null, ...patch,
  }
}

const vec = (n: number) => new Float32Array([n, n, n])

beforeEach(() => {
  embed.mockReset()
  getVector.mockReset()
  setVector.mockReset()
  getVector.mockResolvedValue(null)
  setVector.mockResolvedValue(undefined)
  embed.mockImplementation(async () => vec(1))
})

describe('indexableThings', () => {
  it('only ever spends embeddings on kept things', () => {
    const things = [
      thing({ id: 'kept', state: 'Kept' }),
      thing({ id: 'understory', state: 'Understory' }),
      thing({ id: 'released', state: 'Released' }),
    ]
    expect(indexableThings(things).map((t) => t.id)).toEqual(['kept'])
  })
})

describe('indexThings', () => {
  it('embeds and caches anything without a fresh vector', async () => {
    const vectors = await indexThings([thing({ id: 'a' }), thing({ id: 'b' })])
    expect(embed).toHaveBeenCalledTimes(2)
    expect(setVector).toHaveBeenCalledTimes(2)
    expect([...vectors.keys()].sort()).toEqual(['a', 'b'])
  })

  it('never re-embeds something already cached under its current hash', async () => {
    getVector.mockResolvedValue(vec(7))
    const vectors = await indexThings([thing({ id: 'a' })])
    expect(embed).not.toHaveBeenCalled()
    expect(vectors.get('a')).toEqual(vec(7))
  })

  it('skips one thing that will not embed and keeps going', async () => {
    embed
      .mockImplementationOnce(async () => vec(1))
      .mockImplementationOnce(async () => { throw new Error('nope') })
      .mockImplementationOnce(async () => vec(3))
    const vectors = await indexThings([thing({ id: 'a' }), thing({ id: 'b' }), thing({ id: 'c' })])
    expect([...vectors.keys()].sort()).toEqual(['a', 'c'])
  })

  it('surfaces a model that cannot load at all, rather than silently indexing nothing', async () => {
    embed.mockRejectedValue(new Error('model unavailable'))
    await expect(indexThings([thing({ id: 'a' })])).rejects.toThrow('model unavailable')
  })

  it('stops promptly when cancelled', async () => {
    let calls = 0
    const vectors = await indexThings(
      [thing({ id: 'a' }), thing({ id: 'b' }), thing({ id: 'c' })],
      { isCancelled: () => calls++ >= 1 },
    )
    expect(vectors.size).toBe(1)
  })

  it('reports progress as it goes', async () => {
    const seen: number[] = []
    await indexThings([thing({ id: 'a' }), thing({ id: 'b' })], {
      onProgress: (p) => seen.push(p.done),
    })
    expect(seen).toEqual([0, 1, 2])
  })
})
