import { describe, it, expect } from 'vitest'
import { chooseWalk, walkIsWorthwhile, WALK_SIZE } from './walk'
import type { Thing } from './notion'

function thing(id: string, patch: Partial<Thing> = {}): Thing {
  return {
    id, handle: id, body: `body ${id}`, kind: null, state: 'Kept', sourceId: null,
    locator: '', encountered: '2026-01-01', kept: '2026-01-01', note: '',
    lociIds: [], image: null, link: null, koboBookmarkId: null, arrived: null, ...patch,
  }
}

const today = new Date('2026-08-19T10:00:00')

describe('chooseWalk', () => {
  it('prefers what you have gone longest without looking at', () => {
    const things = [thing('recent'), thing('ancient'), thing('middling')]
    const seen = { recent: '2026-08-18', middling: '2026-06-01', ancient: '2026-01-01' }
    expect(chooseWalk(things, seen, { size: 3, today }).map((t) => t.id))
      .toEqual(['ancient', 'middling', 'recent'])
  })

  it('never includes anything not kept', () => {
    const things = [
      thing('kept'),
      thing('understory', { state: 'Understory', kept: null }),
      thing('released', { state: 'Released' }),
    ]
    expect(chooseWalk(things, {}, { today }).map((t) => t.id)).toEqual(['kept'])
  })

  it('ends — it never returns more than its size', () => {
    const things = Array.from({ length: 40 }, (_, i) => thing(`t${i}`))
    expect(chooseWalk(things, {}, { today })).toHaveLength(WALK_SIZE)
  })

  it('is the SAME walk all day — opening Silva twice in an hour must not reshuffle it', () => {
    const things = Array.from({ length: 20 }, (_, i) => thing(`t${i}`))
    const morning = chooseWalk(things, {}, { today: new Date('2026-08-19T08:00:00') })
    const evening = chooseWalk(things, {}, { today: new Date('2026-08-19T21:30:00') })
    expect(evening.map((t) => t.id)).toEqual(morning.map((t) => t.id))
  })

  it('changes with the calendar, not with your attention', () => {
    const things = Array.from({ length: 20 }, (_, i) => thing(`t${i}`))
    const monday = chooseWalk(things, {}, { today: new Date('2026-08-19T08:00:00') })
    const tuesday = chooseWalk(things, {}, { today: new Date('2026-08-20T08:00:00') })
    expect(tuesday.map((t) => t.id)).not.toEqual(monday.map((t) => t.id))
  })

  it('tie-breaks deterministically rather than by array order', () => {
    // Every thing has identical history, so only the jitter separates them.
    const things = Array.from({ length: 12 }, (_, i) => thing(`t${i}`))
    const walk = chooseWalk(things, {}, { today })
    const reversed = chooseWalk([...things].reverse(), {}, { today })
    expect(new Set(reversed.map((t) => t.id))).toEqual(new Set(walk.map((t) => t.id)))
  })

  it('lets a real difference in days outweigh the tie-break jitter', () => {
    const things = Array.from({ length: 12 }, (_, i) => thing(`t${i}`))
    // One thing seen a year ago must win regardless of how the jitter falls.
    const seen: Record<string, string> = {}
    for (const t of things) seen[t.id] = '2026-08-18'
    seen.t7 = '2025-08-19'
    expect(chooseWalk(things, seen, { today })[0].id).toBe('t7')
  })

  it('reading something drops it out of tomorrow\'s walk', () => {
    const things = Array.from({ length: 12 }, (_, i) => thing(`t${i}`))
    const before = chooseWalk(things, {}, { today })
    const seen = Object.fromEntries(before.map((t) => [t.id, '2026-08-19']))
    const after = chooseWalk(things, seen, { today: new Date('2026-08-20T08:00:00') })
    for (const walked of before) {
      expect(after.map((t) => t.id)).not.toContain(walked.id)
    }
  })
})

describe('walkIsWorthwhile', () => {
  it('is false while the walk would just be the whole forest restated', () => {
    const things = Array.from({ length: WALK_SIZE }, (_, i) => thing(`t${i}`))
    expect(walkIsWorthwhile(things)).toBe(false)
  })

  it('is true once there is more forest than walk', () => {
    const things = Array.from({ length: WALK_SIZE + 1 }, (_, i) => thing(`t${i}`))
    expect(walkIsWorthwhile(things)).toBe(true)
  })

  it('counts only kept things', () => {
    const things = [
      ...Array.from({ length: WALK_SIZE }, (_, i) => thing(`t${i}`)),
      thing('u', { state: 'Understory', kept: null }),
    ]
    expect(walkIsWorthwhile(things)).toBe(false)
  })
})

describe('chooseWalk — routing between neighbours', () => {
  // `a` and `similar` point almost the same way; the others point elsewhere.
  const vectors = new Map<string, Float32Array>([
    ['a', new Float32Array([1, 0])],
    ['similar', new Float32Array([0.99, 0.14])],
    ['unrelated1', new Float32Array([0, 1])],
    ['unrelated2', new Float32Array([0, 1])],
  ])

  it('opens on the most neglected thing, exactly as before', () => {
    const things = [thing('a'), thing('unrelated1'), thing('similar')]
    const seen = { a: '2025-01-01', unrelated1: '2026-08-10', similar: '2026-08-15' }
    expect(chooseWalk(things, seen, { size: 3, today, vectorsById: vectors })[0].id).toBe('a')
  })

  // The improvement: step two is what sits nearest step one, so the walk
  // drifts through a region rather than counting down a ranking.
  it('follows the opening thing with its nearest neighbour, not the next in rank', () => {
    const things = [thing('a'), thing('unrelated1'), thing('similar')]
    // unrelated1 is MORE neglected than similar, yet `a` is near `similar`.
    const seen = { a: '2025-01-01', unrelated1: '2025-06-01', similar: '2026-01-01' }

    expect(chooseWalk(things, seen, { size: 3, today }).map((t) => t.id))
      .toEqual(['a', 'unrelated1', 'similar'])
    expect(chooseWalk(things, seen, { size: 3, today, vectorsById: vectors }).map((t) => t.id))
      .toEqual(['a', 'similar', 'unrelated1'])
  })

  // Neglect is the gate, not a tie-break — affinity may reorder the walk but
  // must never drag back something you have just read.
  it('never reaches outside the neglected pool for a close neighbour', () => {
    const things = [
      thing('a'),
      thing('similar'),
      ...Array.from({ length: 12 }, (_, i) => thing(`filler${i}`)),
    ]
    const seen: Record<string, string> = { a: '2025-01-01', similar: today.toISOString().slice(0, 10) }
    for (let i = 0; i < 12; i++) seen[`filler${i}`] = '2025-02-01'

    // size 1 → a pool of 4, which something seen today is nowhere near.
    const walk = chooseWalk(things, seen, { size: 1, today, vectorsById: vectors })
    expect(walk.map((t) => t.id)).not.toContain('similar')
  })

  it('never stalls on a thing that has no vector yet', () => {
    const things = [thing('a'), thing('no-vector'), thing('unrelated1')]
    const seen = { a: '2025-01-01', 'no-vector': '2025-06-01', unrelated1: '2026-01-01' }
    const walk = chooseWalk(things, seen, { size: 3, today, vectorsById: vectors })
    expect(walk).toHaveLength(3)
    expect(new Set(walk.map((t) => t.id)).size).toBe(3)
  })

  it('still ends at its size, and never repeats a thing', () => {
    const things = Array.from({ length: 60 }, (_, i) => thing(`t${i}`))
    const walk = chooseWalk(things, {}, { size: 5, today, vectorsById: vectors })
    expect(walk).toHaveLength(5)
    expect(new Set(walk.map((t) => t.id)).size).toBe(5)
  })

  it('is still the same walk all day once routing is on', () => {
    const things = Array.from({ length: 20 }, (_, i) => thing(`t${i}`))
    const morning = chooseWalk(things, {}, { today: new Date('2026-08-19T08:00:00'), vectorsById: vectors })
    const evening = chooseWalk(things, {}, { today: new Date('2026-08-19T21:30:00'), vectorsById: vectors })
    expect(morning.map((t) => t.id)).toEqual(evening.map((t) => t.id))
  })
})
