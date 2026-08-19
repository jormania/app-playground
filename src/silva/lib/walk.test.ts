import { describe, it, expect } from 'vitest'
import { chooseWalk, walkIsWorthwhile, WALK_SIZE } from './walk'
import type { Thing } from './notion'

function thing(id: string, patch: Partial<Thing> = {}): Thing {
  return {
    id, handle: id, body: `body ${id}`, kind: null, state: 'Kept', sourceId: null,
    locator: '', encountered: '2026-01-01', kept: '2026-01-01', note: '',
    lociIds: [], image: null, link: null, koboBookmarkId: null, ...patch,
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
