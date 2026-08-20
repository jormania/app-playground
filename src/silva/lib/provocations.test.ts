import { describe, it, expect } from 'vitest'
import { pickProvocation, provocationKey, LONG_UNVISITED_DAYS, CLEARING_FORMING_MIN_SIZE } from './provocations'
import type { Thing } from './notion'
import type { Locus } from './loci'
import type { Path } from './paths'

const TODAY = new Date('2026-08-19T12:00:00')

// Recently kept by default, so a test that isn't specifically about
// long-unvisited doesn't accidentally make every fixture eligible for it
// too (180 days back from TODAY lands in mid-February).
function thing(overrides: Partial<Thing>): Thing {
  return {
    id: 'thing-1',
    handle: 'A thing',
    body: 'A thing worth keeping.',
    kind: 'Passage',
    state: 'Kept',
    sourceId: null,
    locator: '',
    encountered: '2026-08-10',
    kept: '2026-08-10',
    note: '',
    lociIds: [],
    image: null,
    link: null,
    koboBookmarkId: null,
    arrived: null,
    ...overrides,
  }
}

function locus(overrides: Partial<Locus>): Locus {
  return { id: 'locus-1', name: 'A clearing', meaning: '', coined: '2026-01-01', ...overrides }
}

function path(overrides: Partial<Path>): Path {
  return { id: 'path-1', label: '', fromId: null, toId: null, why: 'why', made: '2026-01-01', origin: 'Yours', ...overrides }
}

describe('provocationKey', () => {
  it('is order-independent for pairwise kinds', () => {
    const a = thing({ id: 'a' })
    const b = thing({ id: 'b' })
    expect(provocationKey({ kind: 'blind-pairing', a, b })).toBe(
      provocationKey({ kind: 'blind-pairing', a: b, b: a }),
    )
  })

  it('differs between kinds for the same thing', () => {
    const t = thing({ id: 't1' })
    expect(provocationKey({ kind: 'shuffle', thing: t })).not.toBe(
      provocationKey({ kind: 'long-unvisited', thing: t }),
    )
  })

  it('is order-independent for tension', () => {
    const a = thing({ id: 'a' })
    const b = thing({ id: 'b' })
    expect(provocationKey({ kind: 'tension', a, b })).toBe(
      provocationKey({ kind: 'tension', a: b, b: a }),
    )
  })
})

describe('pickProvocation — silence and basic eligibility', () => {
  it('returns null when nothing is eligible at all', () => {
    const result = pickProvocation({
      things: [], loci: [], paths: [], vectorsById: new Map(), dismissed: new Set(), today: TODAY,
    })
    expect(result).toBeNull()
  })

  it('never proposes an Understory or Released thing', () => {
    const understory = thing({ id: 't1', state: 'Understory' })
    const released = thing({ id: 't2', state: 'Released' })
    const result = pickProvocation({
      things: [understory, released], loci: [], paths: [], vectorsById: new Map(), dismissed: new Set(), today: TODAY,
    })
    expect(result).toBeNull()
  })

  it('shuffle: the only eligible kind for a single Kept thing with no locus/history/pair', () => {
    const t = thing({ id: 't1' })
    const result = pickProvocation({
      things: [t], loci: [], paths: [], vectorsById: new Map(), dismissed: new Set(), today: TODAY,
    })
    expect(result).toEqual({ kind: 'shuffle', thing: t })
  })
})

describe('pickProvocation — random-clearing', () => {
  it('is eligible only for a locus with at least one Kept member', () => {
    const t = thing({ id: 't1', lociIds: ['locus-populated'] })
    const emptyLocus = locus({ id: 'locus-empty' })
    const populatedLocus = locus({ id: 'locus-populated' })
    // Bias selection toward the last eligible kind: [shuffle, random-clearing]
    const result = pickProvocation({
      things: [t], loci: [emptyLocus, populatedLocus], paths: [], vectorsById: new Map(), dismissed: new Set(),
      today: TODAY, random: () => 0.99,
    })
    expect(result?.kind).toBe('random-clearing')
    if (result?.kind === 'random-clearing') {
      expect(result.locus.id).toBe('locus-populated')
      expect(result.things.map((x) => x.id)).toEqual(['t1'])
    }
  })

  it('never surfaces the empty locus', () => {
    const emptyLocus = locus({ id: 'locus-empty' })
    const result = pickProvocation({
      things: [], loci: [emptyLocus], paths: [], vectorsById: new Map(), dismissed: new Set(), today: TODAY,
    })
    expect(result).toBeNull()
  })
})

describe('pickProvocation — long-unvisited', () => {
  it('is not eligible for a thing kept well within the threshold', () => {
    const t = thing({ id: 't1', kept: '2026-08-01' }) // ~18 days before TODAY
    const result = pickProvocation({
      things: [t], loci: [], paths: [], vectorsById: new Map(), dismissed: new Set(), today: TODAY,
    })
    expect(result?.kind).not.toBe('long-unvisited')
  })

  it('is eligible once past the threshold, alongside shuffle', () => {
    const t = thing({ id: 't1', kept: '2026-01-01' }) // well past 180 days
    const result = pickProvocation({
      things: [t], loci: [], paths: [], vectorsById: new Map(), dismissed: new Set(),
      today: TODAY, random: () => 0.99, // bias toward the last eligible kind
    })
    expect(result?.kind).toBe('long-unvisited')
    if (result?.kind === 'long-unvisited') expect(result.thing.id).toBe('t1')
    expect(LONG_UNVISITED_DAYS).toBe(180)
  })

  // Before lib/seen.ts existed this filtered on `daysSince(thing.kept)`, so a
  // thing you reread every week became "long unvisited" on day 181 regardless,
  // and stayed eligible forever after. These two cover the fix.
  it('is NOT eligible for an old thing you actually looked at recently', () => {
    const t = thing({ id: 't1', kept: '2026-01-01' })
    const result = pickProvocation({
      things: [t], loci: [], paths: [], vectorsById: new Map(), dismissed: new Set(),
      seen: { t1: '2026-08-15' },
      today: TODAY, random: () => 0.99,
    })
    expect(result?.kind).not.toBe('long-unvisited')
  })

  it('IS eligible for a recently-kept thing you have not opened since', () => {
    // Kept inside the threshold, but last actually seen well outside it —
    // impossible to express before the history existed.
    const t = thing({ id: 't1', kept: '2026-08-01' })
    const result = pickProvocation({
      things: [t], loci: [], paths: [], vectorsById: new Map(), dismissed: new Set(),
      seen: { t1: '2025-06-01' },
      today: TODAY, random: () => 0.99,
    })
    expect(result?.kind).toBe('long-unvisited')
  })
})

describe('pickProvocation — blind-pairing', () => {
  it('is eligible for two unconnected Kept things', () => {
    const a = thing({ id: 'a' })
    const b = thing({ id: 'b' })
    const result = pickProvocation({
      things: [a, b], loci: [], paths: [], vectorsById: new Map(), dismissed: new Set(),
      today: TODAY, random: () => 0.99, // byKind = [shuffle, blind-pairing] — last slot
    })
    expect(result?.kind).toBe('blind-pairing')
    if (result?.kind === 'blind-pairing') {
      expect([result.a.id, result.b.id].sort()).toEqual(['a', 'b'])
    }
  })

  it('is excluded once the pair is already connected by a real Path', () => {
    const a = thing({ id: 'a' })
    const b = thing({ id: 'b' })
    const connectingPath = path({ fromId: 'a', toId: 'b' })
    for (let i = 0; i < 10; i++) {
      const result = pickProvocation({
        things: [a, b], loci: [], paths: [connectingPath], vectorsById: new Map(), dismissed: new Set(),
        today: TODAY, random: () => i / 10,
      })
      expect(result?.kind).not.toBe('blind-pairing')
    }
  })
})

describe('pickProvocation — near-neighbours (embeddings-only, no model)', () => {
  it('is eligible for two Kept things with close cached vectors', () => {
    const a = thing({ id: 'a' })
    const b = thing({ id: 'b' })
    const vectors = new Map([
      ['a', new Float32Array([1, 0])],
      ['b', new Float32Array([0.99, 0.14])], // cosine ~0.99, well above threshold
    ])
    const result = pickProvocation({
      things: [a, b], loci: [], paths: [], vectorsById: vectors, dismissed: new Set(),
      today: TODAY, random: () => 0.99, // byKind = [shuffle, blind-pairing, near-neighbours] — last slot
    })
    expect(result?.kind).toBe('near-neighbours')
    if (result?.kind === 'near-neighbours') {
      expect([result.a.id, result.b.id].sort()).toEqual(['a', 'b'])
    }
  })

  it('is never proposed below the similarity threshold', () => {
    const a = thing({ id: 'a' })
    const b = thing({ id: 'b' })
    const vectors = new Map([
      ['a', new Float32Array([1, 0])],
      ['b', new Float32Array([0, 1])], // orthogonal
    ])
    for (let i = 0; i < 10; i++) {
      const result = pickProvocation({
        things: [a, b], loci: [], paths: [], vectorsById: vectors, dismissed: new Set(),
        today: TODAY, random: () => i / 10,
      })
      expect(result?.kind).not.toBe('near-neighbours')
    }
  })

  it('is never proposed for a thing with no cached vector', () => {
    const a = thing({ id: 'a' })
    const b = thing({ id: 'b' }) // no entry in vectorsById
    const vectors = new Map([['a', new Float32Array([1, 0])]])
    for (let i = 0; i < 10; i++) {
      const result = pickProvocation({
        things: [a, b], loci: [], paths: [], vectorsById: vectors, dismissed: new Set(),
        today: TODAY, random: () => i / 10,
      })
      expect(result?.kind).not.toBe('near-neighbours')
    }
  })

  it('is excluded once the pair is already connected by a real Path', () => {
    const a = thing({ id: 'a' })
    const b = thing({ id: 'b' })
    const vectors = new Map([
      ['a', new Float32Array([1, 0])],
      ['b', new Float32Array([0.99, 0.14])],
    ])
    const connectingPath = path({ fromId: 'a', toId: 'b' })
    for (let i = 0; i < 10; i++) {
      const result = pickProvocation({
        things: [a, b], loci: [], paths: [connectingPath], vectorsById: vectors, dismissed: new Set(),
        today: TODAY, random: () => i / 10,
      })
      expect(result?.kind).not.toBe('near-neighbours')
    }
  })
})

describe('pickProvocation — tension (only eligible with tensionEnabled)', () => {
  // cosine ≈ 0.37 — inside the tension band, below the near-neighbours bar.
  const bandVectors = new Map([
    ['a', new Float32Array([1, 0])],
    ['b', new Float32Array([0.4, 1])],
  ])

  it('is never proposed when tensionEnabled is left at its default (false)', () => {
    const a = thing({ id: 'a' })
    const b = thing({ id: 'b' })
    for (let i = 0; i < 10; i++) {
      const result = pickProvocation({
        things: [a, b], loci: [], paths: [], vectorsById: bandVectors, dismissed: new Set(),
        today: TODAY, random: () => i / 10,
      })
      expect(result?.kind).not.toBe('tension')
    }
  })

  it('is eligible once tensionEnabled is true and similarity is in-band', () => {
    const a = thing({ id: 'a' })
    const b = thing({ id: 'b' })
    const result = pickProvocation({
      things: [a, b], loci: [], paths: [], vectorsById: bandVectors, dismissed: new Set(),
      today: TODAY, random: () => 0.99, tensionEnabled: true,
      // byKind = [shuffle, blind-pairing, tension] — last slot
    })
    expect(result?.kind).toBe('tension')
    if (result?.kind === 'tension') {
      expect([result.a.id, result.b.id].sort()).toEqual(['a', 'b'])
    }
  })

  it('is never proposed above the near-neighbours bar even with tensionEnabled', () => {
    const a = thing({ id: 'a' })
    const b = thing({ id: 'b' })
    const closeVectors = new Map([
      ['a', new Float32Array([1, 0])],
      ['b', new Float32Array([0.99, 0.14])],
    ])
    for (let i = 0; i < 10; i++) {
      const result = pickProvocation({
        things: [a, b], loci: [], paths: [], vectorsById: closeVectors, dismissed: new Set(),
        today: TODAY, random: () => i / 10, tensionEnabled: true,
      })
      expect(result?.kind).not.toBe('tension')
    }
  })

  it('is excluded once the pair is already connected by a real Path', () => {
    const a = thing({ id: 'a' })
    const b = thing({ id: 'b' })
    const connectingPath = path({ fromId: 'a', toId: 'b' })
    for (let i = 0; i < 10; i++) {
      const result = pickProvocation({
        things: [a, b], loci: [], paths: [connectingPath], vectorsById: bandVectors, dismissed: new Set(),
        today: TODAY, random: () => i / 10, tensionEnabled: true,
      })
      expect(result?.kind).not.toBe('tension')
    }
  })
})

describe('pickProvocation — clearing-forming', () => {
  it('is eligible for a tight cluster at least the minimum size', () => {
    const things = Array.from({ length: CLEARING_FORMING_MIN_SIZE }, (_, i) => thing({ id: `t${i}` }))
    const vectors = new Map(things.map((t) => [t.id, new Float32Array([1, 0])])) // identical, similarity 1
    const result = pickProvocation({
      things, loci: [], paths: [], vectorsById: vectors, dismissed: new Set(),
      today: TODAY, random: () => 0.99, // last eligible kind slot
    })
    expect(result?.kind).toBe('clearing-forming')
    if (result?.kind === 'clearing-forming') {
      expect(result.things.length).toBeGreaterThanOrEqual(CLEARING_FORMING_MIN_SIZE)
    }
  })

  it('is not eligible below the minimum cluster size', () => {
    const things = Array.from({ length: CLEARING_FORMING_MIN_SIZE - 1 }, (_, i) => thing({ id: `t${i}` }))
    const vectors = new Map(things.map((t) => [t.id, new Float32Array([1, 0])]))
    for (let i = 0; i < 10; i++) {
      const result = pickProvocation({
        things, loci: [], paths: [], vectorsById: vectors, dismissed: new Set(),
        today: TODAY, random: () => i / 10,
      })
      expect(result?.kind).not.toBe('clearing-forming')
    }
  })

  it('skips a group already entirely gathered under one shared locus', () => {
    const things = Array.from({ length: CLEARING_FORMING_MIN_SIZE }, (_, i) =>
      thing({ id: `t${i}`, lociIds: ['locus-shared'] }))
    const vectors = new Map(things.map((t) => [t.id, new Float32Array([1, 0])]))
    for (let i = 0; i < 10; i++) {
      const result = pickProvocation({
        things, loci: [locus({ id: 'locus-shared' })], paths: [], vectorsById: vectors, dismissed: new Set(),
        today: TODAY, random: () => i / 10,
      })
      expect(result?.kind).not.toBe('clearing-forming')
    }
  })
})

describe('pickProvocation — dismissal', () => {
  it('never re-offers a dismissed provocation, even when nothing else is eligible', () => {
    const t = thing({ id: 't1' })
    const shuffleP = { kind: 'shuffle' as const, thing: t }
    const dismissed = new Set([provocationKey(shuffleP)])
    const result = pickProvocation({
      things: [t], loci: [], paths: [], vectorsById: new Map(), dismissed, today: TODAY,
    })
    expect(result).toBeNull()
  })

  it('dismissing one candidate leaves other eligible candidates untouched', () => {
    const a = thing({ id: 'a' })
    const b = thing({ id: 'b' })
    const dismissed = new Set([provocationKey({ kind: 'shuffle', thing: a })])
    const result = pickProvocation({
      things: [a, b], loci: [], paths: [], vectorsById: new Map(), dismissed,
      today: TODAY, random: () => 0, // first eligible kind (shuffle), first remaining candidate
    })
    expect(result).toEqual({ kind: 'shuffle', thing: b })
  })
})
