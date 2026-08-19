import { describe, it, expect } from 'vitest'
import { computeNeighbourhood, layoutEgoGraph, egoViewBox, EGO_SIZE, NEIGHBOURHOOD_LIMIT } from './neighbourhood'
import { MYCORRHIZA_THRESHOLD } from './graph'
import type { Thing } from './notion'
import type { Path } from './paths'

function thing(id: string, patch: Partial<Thing> = {}): Thing {
  return {
    id, handle: id, body: `body ${id}`, kind: null, state: 'Kept', sourceId: null,
    locator: '', encountered: '2026-01-01', kept: '2026-01-01', note: '',
    lociIds: [], image: null, link: null, koboBookmarkId: null, ...patch,
  }
}

function path(id: string, fromId: string, toId: string): Path {
  return { id, label: `${fromId} → ${toId}`, fromId, toId, why: 'because', made: '2026-01-01', origin: 'Yours' }
}

/** Unit vectors at a chosen cosine similarity to [1,0]. */
const at = (cos: number) => new Float32Array([cos, Math.sqrt(Math.max(0, 1 - cos * cos))])
const SELF = new Float32Array([1, 0])

describe('computeNeighbourhood — near (mycorrhiza)', () => {
  it('proposes things above the mycorrhiza threshold, closest first', () => {
    const me = thing('me')
    const things = [me, thing('close'), thing('closer'), thing('far')]
    const vectors = new Map([
      ['me', SELF],
      ['close', at(0.7)],
      ['closer', at(0.95)],
      ['far', at(0.1)],
    ])
    const { near } = computeNeighbourhood(me, things, vectors, [])
    expect(near.map((n) => n.thing.id)).toEqual(['closer', 'close'])
  })

  it('proposes nothing when the thing itself has no vector', () => {
    const me = thing('me')
    const things = [me, thing('other')]
    const vectors = new Map([['other', at(0.99)]])
    expect(computeNeighbourhood(me, things, vectors, []).near).toEqual([])
  })

  it('never proposes something already connected by a path — that is asserted, not latent', () => {
    const me = thing('me')
    const things = [me, thing('linked')]
    const vectors = new Map([['me', SELF], ['linked', at(0.99)]])
    const { near, connected } = computeNeighbourhood(me, things, vectors, [path('p', 'me', 'linked')])
    expect(near).toEqual([])
    expect(connected.map((c) => c.thing.id)).toEqual(['linked'])
  })

  it('never proposes itself', () => {
    const me = thing('me')
    const vectors = new Map([['me', SELF]])
    expect(computeNeighbourhood(me, [me], vectors, []).near).toEqual([])
  })

  it('only proposes kept things', () => {
    const me = thing('me')
    const things = [me, thing('understory', { state: 'Understory', kept: null }), thing('released', { state: 'Released' })]
    const vectors = new Map([['me', SELF], ['understory', at(0.99)], ['released', at(0.99)]])
    expect(computeNeighbourhood(me, things, vectors, []).near).toEqual([])
  })

  it('respects the mycorrhiza threshold exactly', () => {
    const me = thing('me')
    const things = [me, thing('under'), thing('over')]
    const vectors = new Map([
      ['me', SELF],
      ['under', at(MYCORRHIZA_THRESHOLD - 0.05)],
      ['over', at(MYCORRHIZA_THRESHOLD + 0.05)],
    ])
    expect(computeNeighbourhood(me, things, vectors, []).near.map((n) => n.thing.id)).toEqual(['over'])
  })

  it('stays a neighbourhood — never grows into a result list', () => {
    const me = thing('me')
    const others = Array.from({ length: 30 }, (_, i) => thing(`t${i}`))
    const vectors = new Map<string, Float32Array>([['me', SELF]])
    for (const t of others) vectors.set(t.id, at(0.9))
    expect(computeNeighbourhood(me, [me, ...others], vectors, []).near).toHaveLength(NEIGHBOURHOOD_LIMIT)
  })
})

describe('computeNeighbourhood — connected (paths)', () => {
  it('finds paths in both directions', () => {
    const me = thing('me')
    const things = [me, thing('a'), thing('b')]
    const { connected } = computeNeighbourhood(me, things, new Map(), [
      path('p1', 'me', 'a'),
      path('p2', 'b', 'me'),
    ])
    expect(connected.map((c) => c.thing.id).sort()).toEqual(['a', 'b'])
  })

  it('ignores paths that touch neither end', () => {
    const me = thing('me')
    const things = [me, thing('a'), thing('b')]
    expect(computeNeighbourhood(me, things, new Map(), [path('p', 'a', 'b')]).connected).toEqual([])
  })

  it('carries the path itself, so the why can be shown', () => {
    const me = thing('me')
    const { connected } = computeNeighbourhood(me, [me, thing('a')], new Map(), [path('p1', 'me', 'a')])
    expect(connected[0].path.why).toBe('because')
  })

  it('survives a path pointing at a thing that is no longer here', () => {
    const me = thing('me')
    const { connected } = computeNeighbourhood(me, [me], new Map(), [path('p', 'me', 'gone')])
    expect(connected).toEqual([])
  })
})

describe('layoutEgoGraph', () => {
  it('always puts the thing itself at the centre', () => {
    const nodes = layoutEgoGraph({ near: [], connected: [] })
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({ role: 'self', x: EGO_SIZE / 2, y: EGO_SIZE / 2 })
  })

  it('rings every neighbour around it', () => {
    const near = [{ thing: thing('n1'), similarity: 0.8 }, { thing: thing('n2'), similarity: 0.7 }]
    const connected = [{ thing: thing('c1'), path: path('p', 'me', 'c1') }]
    const nodes = layoutEgoGraph({ near, connected })
    expect(nodes).toHaveLength(4)
    expect(nodes.filter((n) => n.role === 'near')).toHaveLength(2)
    expect(nodes.filter((n) => n.role === 'connected')).toHaveLength(1)
  })

  it('places a lone neighbour above the centre, not beside it', () => {
    const nodes = layoutEgoGraph({ near: [{ thing: thing('n'), similarity: 0.9 }], connected: [] })
    const neighbour = nodes[1]
    expect(neighbour.x).toBeCloseTo(EGO_SIZE / 2, 5)
    expect(neighbour.y).toBeLessThan(EGO_SIZE / 2)
  })

  it('keeps every node inside the canvas, whatever the neighbourhood size', () => {
    const near = Array.from({ length: 4 }, (_, i) => ({ thing: thing(`n${i}`), similarity: 0.9 }))
    const connected = Array.from({ length: 6 }, (_, i) => ({ thing: thing(`c${i}`), path: path(`p${i}`, 'me', `c${i}`) }))
    for (const node of layoutEgoGraph({ near, connected })) {
      expect(node.x).toBeGreaterThanOrEqual(0)
      expect(node.x).toBeLessThanOrEqual(EGO_SIZE)
      expect(node.y).toBeGreaterThanOrEqual(0)
      expect(node.y).toBeLessThanOrEqual(EGO_SIZE)
    }
  })
})

describe('egoViewBox', () => {
  it('crops to the content, so one neighbour does not float in an empty square', () => {
    const nodes = layoutEgoGraph({ near: [{ thing: thing('n'), similarity: 0.9 }], connected: [] })
    const box = egoViewBox(nodes)
    expect(box.height).toBeLessThan(EGO_SIZE)
    expect(box.width).toBeLessThan(EGO_SIZE)
  })

  it('contains every node it was given', () => {
    const near = Array.from({ length: 4 }, (_, i) => ({ thing: thing(`n${i}`), similarity: 0.9 }))
    const nodes = layoutEgoGraph({ near, connected: [] })
    const box = egoViewBox(nodes)
    for (const node of nodes) {
      expect(node.x).toBeGreaterThanOrEqual(box.minX)
      expect(node.x).toBeLessThanOrEqual(box.minX + box.width)
      expect(node.y).toBeGreaterThanOrEqual(box.minY)
      expect(node.y).toBeLessThanOrEqual(box.minY + box.height)
    }
  })

  it('falls back to the full canvas when there is nothing to draw', () => {
    expect(egoViewBox([])).toEqual({ minX: 0, minY: 0, width: EGO_SIZE, height: EGO_SIZE })
  })
})
