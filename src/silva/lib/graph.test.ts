import { describe, it, expect } from 'vitest'
import { computeGraphLayout, computeRootstockLayout, clusterLabelY, clusterLabelText, clusterLabelHalfWidth, clusterLabelFontSize, pathsToEdges, computeMycorrhiza, computeViewBox, MYCORRHIZA_THRESHOLD, CANVAS_SIZE } from './graph'
import type { Thing } from './notion'
import type { Locus } from './loci'
import type { Path } from './paths'

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
    ...overrides,
  }
}

function locus(overrides: Partial<Locus>): Locus {
  return { id: 'locus-1', name: 'A clearing', meaning: '', coined: '2026-01-01', ...overrides }
}

function path(overrides: Partial<Path>): Path {
  return { id: 'path-1', label: '', fromId: null, toId: null, why: 'why', made: '2026-01-01', origin: 'Yours', ...overrides }
}

describe('computeGraphLayout', () => {
  it('only includes Kept things', () => {
    const kept = thing({ id: 'k', state: 'Kept' })
    const understory = thing({ id: 'u', state: 'Understory' })
    const layout = computeGraphLayout([kept, understory], [])
    expect(layout.nodes.map((n) => n.thing.id)).toEqual(['k'])
  })

  it('places a thing with no locus in the Unclustered bucket', () => {
    const t = thing({ id: 't1', lociIds: [] })
    const layout = computeGraphLayout([t], [])
    expect(layout.clusters).toHaveLength(1)
    expect(layout.clusters[0].label).toBe('Unclustered')
    expect(layout.nodes[0].clusterId).toBe('unclustered')
  })

  it('groups things by locus and labels the cluster with the locus name', () => {
    const l = locus({ id: 'locus-solitude', name: 'Solitude' })
    const a = thing({ id: 'a', lociIds: ['locus-solitude'] })
    const b = thing({ id: 'b', lociIds: ['locus-solitude'] })
    const layout = computeGraphLayout([a, b], [l])
    expect(layout.clusters).toHaveLength(1)
    expect(layout.clusters[0].label).toBe('Solitude')
    expect(layout.nodes.map((n) => n.thing.id).sort()).toEqual(['a', 'b'])
    expect(layout.nodes.every((n) => n.clusterId === 'locus-solitude')).toBe(true)
  })

  it('a thing in multiple loci clusters under its FIRST locus id', () => {
    const l1 = locus({ id: 'locus-a', name: 'A' })
    const l2 = locus({ id: 'locus-b', name: 'B' })
    const t = thing({ id: 't1', lociIds: ['locus-b', 'locus-a'] })
    const layout = computeGraphLayout([t], [l1, l2])
    expect(layout.nodes[0].clusterId).toBe('locus-b')
    expect(layout.clusters.map((c) => c.label)).toEqual(['B'])
  })

  it('gives every node finite, distinct-enough coordinates (no NaN, no total overlap within a cluster)', () => {
    const things = Array.from({ length: 5 }, (_, i) => thing({ id: `t${i}` }))
    const layout = computeGraphLayout(things, [])
    for (const node of layout.nodes) {
      expect(Number.isFinite(node.x)).toBe(true)
      expect(Number.isFinite(node.y)).toBe(true)
    }
    const positions = layout.nodes.map((n) => `${n.x.toFixed(2)},${n.y.toFixed(2)}`)
    expect(new Set(positions).size).toBe(positions.length)
  })

  it('handles an empty collection', () => {
    const layout = computeGraphLayout([], [])
    expect(layout.clusters).toEqual([])
    expect(layout.nodes).toEqual([])
  })
})

describe('pathsToEdges', () => {
  it('maps Paths with both ends to edges', () => {
    const p = path({ fromId: 'a', toId: 'b' })
    expect(pathsToEdges([p])).toEqual([{ fromId: 'a', toId: 'b' }])
  })

  it('drops a Path missing either end', () => {
    const p = path({ fromId: 'a', toId: null })
    expect(pathsToEdges([p])).toEqual([])
  })
})

describe('computeMycorrhiza', () => {
  it('is empty when no vectors are available', () => {
    const a = thing({ id: 'a' })
    const b = thing({ id: 'b' })
    expect(computeMycorrhiza([a, b], new Map(), [])).toEqual([])
  })

  it('includes a pair above the threshold', () => {
    const a = thing({ id: 'a' })
    const b = thing({ id: 'b' })
    const vectors = new Map([
      ['a', new Float32Array([1, 0])],
      ['b', new Float32Array([0.99, 0.14])],
    ])
    const fibers = computeMycorrhiza([a, b], vectors, [])
    expect(fibers).toHaveLength(1)
    expect([fibers[0].aId, fibers[0].bId].sort()).toEqual(['a', 'b'])
    expect(fibers[0].similarity).toBeGreaterThanOrEqual(MYCORRHIZA_THRESHOLD)
  })

  it('excludes a pair below the threshold', () => {
    const a = thing({ id: 'a' })
    const b = thing({ id: 'b' })
    const vectors = new Map([
      ['a', new Float32Array([1, 0])],
      ['b', new Float32Array([0, 1])],
    ])
    expect(computeMycorrhiza([a, b], vectors, [])).toEqual([])
  })

  it('excludes a pair already connected by a real Path', () => {
    const a = thing({ id: 'a' })
    const b = thing({ id: 'b' })
    const vectors = new Map([
      ['a', new Float32Array([1, 0])],
      ['b', new Float32Array([0.99, 0.14])],
    ])
    const connectingPath = path({ fromId: 'a', toId: 'b' })
    expect(computeMycorrhiza([a, b], vectors, [connectingPath])).toEqual([])
  })

  it('never includes an Understory or Released thing', () => {
    const a = thing({ id: 'a', state: 'Understory' })
    const b = thing({ id: 'b', state: 'Released' })
    const vectors = new Map([
      ['a', new Float32Array([1, 0])],
      ['b', new Float32Array([0.99, 0.14])],
    ])
    expect(computeMycorrhiza([a, b], vectors, [])).toEqual([])
  })
})

describe('computeViewBox', () => {
  it('falls back to the full canvas for an empty layout', () => {
    const viewBox = computeViewBox({ clusters: [], nodes: [] })
    expect(viewBox).toEqual({ minX: 0, minY: 0, width: CANVAS_SIZE, height: CANVAS_SIZE })
  })

  it('tightly bounds a small layout instead of using the full canvas', () => {
    const layout = computeGraphLayout([thing({ id: 'a' })], [])
    const viewBox = computeViewBox(layout)
    expect(viewBox.width).toBeLessThan(CANVAS_SIZE)
    expect(viewBox.height).toBeLessThan(CANVAS_SIZE)
  })

  it('centers the box on the content', () => {
    const layout = computeGraphLayout([thing({ id: 'a' })], [])
    const viewBox = computeViewBox(layout)
    const node = layout.nodes[0]
    expect(node.x).toBeGreaterThanOrEqual(viewBox.minX)
    expect(node.x).toBeLessThanOrEqual(viewBox.minX + viewBox.width)
    expect(node.y).toBeGreaterThanOrEqual(viewBox.minY)
    expect(node.y).toBeLessThanOrEqual(viewBox.minY + viewBox.height)
  })

  it('includes cluster label space when there are multiple clusters', () => {
    const a = thing({ id: 'a', lociIds: ['locus-1'] })
    const b = thing({ id: 'b', lociIds: ['locus-2'] })
    const layout = computeGraphLayout([a, b], [locus({ id: 'locus-1' }), locus({ id: 'locus-2', name: 'Other' })])
    const viewBox = computeViewBox(layout)
    for (const c of layout.clusters) {
      expect(clusterLabelY(c)).toBeGreaterThanOrEqual(viewBox.minY)
    }
  })
})

describe('clusterLabelY', () => {
  // The bug: a fixed 70px rise put the caption inside a busy cluster's own
  // ring, which reaches 90 — so the topmost node sat right on the label.
  it('always clears the cluster\'s own ring of members', () => {
    const crowded = Array.from({ length: 30 }, (_, i) => thing({ id: `t${i}`, lociIds: ['locus-1'] }))
    const layout = computeGraphLayout(crowded, [locus({ id: 'locus-1' })])
    const cluster = layout.clusters[0]

    expect(cluster.nodeRadius).toBeGreaterThan(70)
    const topmostNodeY = Math.min(...layout.nodes.map((n) => n.y))
    expect(clusterLabelY(cluster)).toBeLessThan(topmostNodeY)
  })

  it('sits close in for a cluster holding a single thing', () => {
    const layout = computeGraphLayout([thing({ id: 'a', lociIds: ['locus-1'] })], [locus({ id: 'locus-1' })])
    const cluster = layout.clusters[0]
    expect(cluster.nodeRadius).toBe(0)
    expect(clusterLabelY(cluster)).toBeLessThan(cluster.y)
  })
})

describe('computeRootstockLayout', () => {
  const sources = [{ id: 'src-1', title: 'Meditations' }, { id: 'src-2', title: 'The Civil War' }]

  it('gathers kept things under the source each came from', () => {
    const layout = computeRootstockLayout(
      [
        thing({ id: 'a', sourceId: 'src-1' }),
        thing({ id: 'b', sourceId: 'src-1' }),
        thing({ id: 'c', sourceId: 'src-2' }),
      ],
      sources,
    )
    expect(layout.clusters.map((c) => c.label).sort()).toEqual(['Meditations', 'The Civil War'])
    expect(layout.nodes).toHaveLength(3)
  })

  // Deliberately unlike the crossing's 'Unclustered' ring: most things never
  // get a source, so a "No source" bucket would be the biggest cluster in
  // the drawing and would squash the actual roots into the margin — and a
  // thing with no source has no root to draw it under in the first place.
  it('leaves things with no source out entirely rather than bucketing them', () => {
    const layout = computeRootstockLayout(
      [thing({ id: 'a', sourceId: 'src-1' }), thing({ id: 'b', sourceId: null })],
      sources,
    )
    expect(layout.nodes.map((n) => n.thing.id)).toEqual(['a'])
    expect(layout.clusters).toHaveLength(1)
  })

  it('drops a thing whose source was deleted straight out of Notion', () => {
    const layout = computeRootstockLayout([thing({ id: 'a', sourceId: 'src-gone' })], sources)
    expect(layout.nodes).toHaveLength(0)
    expect(layout.clusters).toHaveLength(0)
  })

  it('draws only kept things — released and unkept are not roots', () => {
    const layout = computeRootstockLayout(
      [
        thing({ id: 'kept', sourceId: 'src-1' }),
        thing({ id: 'released', sourceId: 'src-1', state: 'Released' }),
        thing({ id: 'unkept', sourceId: 'src-1', state: 'Understory' }),
      ],
      sources,
    )
    expect(layout.nodes.map((n) => n.thing.id)).toEqual(['kept'])
  })

  // The two drawings are the same picture under a different grouping, so a
  // layout from either must be usable by the same view-box maths.
  it('produces a layout the shared view-box maths accepts', () => {
    const layout = computeRootstockLayout([thing({ id: 'a', sourceId: 'src-1' })], sources)
    const viewBox = computeViewBox(layout)
    expect(viewBox.width).toBeGreaterThan(0)
    expect(viewBox.height).toBeGreaterThan(0)
  })

  it('is empty when nothing kept has a source', () => {
    expect(computeRootstockLayout([thing({ id: 'a', sourceId: null })], sources).nodes).toHaveLength(0)
  })
})

describe('cluster captions and the view box', () => {
  const longTitle = 'Meditations, and Other Writings of Marcus Aurelius Antoninus'

  it('elides a caption too long to be a label', () => {
    const layout = computeRootstockLayout(
      [thing({ id: 'a', sourceId: 'src-1' })],
      [{ id: 'src-1', title: longTitle }],
    )
    const text = clusterLabelText(layout.clusters[0])
    expect(text.length).toBeLessThan(longTitle.length)
    expect(text.endsWith('…')).toBe(true)
  })

  it('leaves a caption that already fits exactly as it is', () => {
    const layout = computeRootstockLayout(
      [thing({ id: 'a', sourceId: 'src-1' })],
      [{ id: 'src-1', title: 'Meditations' }],
    )
    expect(clusterLabelText(layout.clusters[0])).toBe('Meditations')
  })

  // The bug: captions are centred, so one on an edge cluster reaches
  // sideways past its nodes — and the view box only ever measured `c.x`,
  // slicing the label off at the SVG boundary.
  it('makes room for the full width of every caption, not just its centre', () => {
    const layout = computeRootstockLayout(
      [thing({ id: 'a', sourceId: 'src-1' }), thing({ id: 'b', sourceId: 'src-2' })],
      [{ id: 'src-1', title: longTitle }, { id: 'src-2', title: 'The Civil War' }],
    )
    const viewBox = computeViewBox(layout)

    for (const c of layout.clusters) {
      const half = clusterLabelHalfWidth(c, clusterLabelFontSize(viewBox.width))
      expect(c.x - half).toBeGreaterThanOrEqual(viewBox.minX)
      expect(c.x + half).toBeLessThanOrEqual(viewBox.minX + viewBox.width)
    }
  })

  it('holds for the crossing too — both drawings share the maths', () => {
    const layout = computeGraphLayout(
      [thing({ id: 'a', lociIds: ['locus-1'] }), thing({ id: 'b', lociIds: ['locus-2'] })],
      [locus({ id: 'locus-1', name: longTitle }), locus({ id: 'locus-2', name: 'Waiting' })],
    )
    const viewBox = computeViewBox(layout)

    for (const c of layout.clusters) {
      const half = clusterLabelHalfWidth(c, clusterLabelFontSize(viewBox.width))
      expect(c.x - half).toBeGreaterThanOrEqual(viewBox.minX)
      expect(c.x + half).toBeLessThanOrEqual(viewBox.minX + viewBox.width)
    }
  })
})
