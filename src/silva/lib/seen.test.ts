import { describe, it, expect } from 'vitest'
import { withSeen, daysSinceSeen, prunedSeen, type SeenMap } from './seen'
import type { Thing } from './notion'

function thing(patch: Partial<Thing>): Thing {
  return {
    id: 'x', handle: 'x', body: 'body', kind: null, state: 'Kept', sourceId: null,
    locator: '', encountered: '2026-01-01', kept: '2026-01-01', note: '',
    lociIds: [], image: null, link: null, koboBookmarkId: null, ...patch,
  }
}

describe('withSeen', () => {
  it('records today against each id', () => {
    const next = withSeen({}, ['a', 'b'], new Date('2026-08-19T10:00:00'))
    expect(next).toEqual({ a: '2026-08-19', b: '2026-08-19' })
  })

  it('returns the SAME object when nothing changed, so callers can skip the write', () => {
    const seen: SeenMap = { a: '2026-08-19' }
    expect(withSeen(seen, ['a'], new Date('2026-08-19T23:00:00'))).toBe(seen)
  })

  it('returns a new object when at least one id is new', () => {
    const seen: SeenMap = { a: '2026-08-19' }
    const next = withSeen(seen, ['a', 'b'], new Date('2026-08-19T10:00:00'))
    expect(next).not.toBe(seen)
    expect(next.b).toBe('2026-08-19')
  })

  it('moves an older date forward to today', () => {
    const next = withSeen({ a: '2026-01-01' }, ['a'], new Date('2026-08-19T10:00:00'))
    expect(next.a).toBe('2026-08-19')
  })

  it('never mutates the map it was given', () => {
    const seen: SeenMap = { a: '2026-01-01' }
    withSeen(seen, ['b'], new Date('2026-08-19T10:00:00'))
    expect(seen).toEqual({ a: '2026-01-01' })
  })
})

describe('daysSinceSeen', () => {
  const today = new Date('2026-08-19T10:00:00')

  it('uses the seen date when there is one', () => {
    expect(daysSinceSeen(thing({ id: 'a', kept: '2026-01-01' }), { a: '2026-08-09' }, today)).toBe(10)
  })

  it('falls back to `kept` with no history — something kept and never opened HAS been unvisited since then', () => {
    expect(daysSinceSeen(thing({ id: 'a', kept: '2026-08-09' }), {}, today)).toBe(10)
  })

  it('falls back to `encountered` when a thing was never kept', () => {
    expect(daysSinceSeen(thing({ id: 'a', kept: null, encountered: '2026-08-14' }), {}, today)).toBe(5)
  })

  it('distinguishes a thing reread today from one kept long ago — the whole point', () => {
    const old = thing({ id: 'a', kept: '2026-01-01' })
    const reread = daysSinceSeen(old, { a: '2026-08-19' }, today)
    const untouched = daysSinceSeen(old, {}, today)
    expect(reread).toBe(0)
    expect(untouched).toBeGreaterThan(200)
  })
})

describe('prunedSeen', () => {
  it('drops history for things that are gone', () => {
    expect(prunedSeen({ a: '2026-01-01', b: '2026-01-02' }, ['a'])).toEqual({ a: '2026-01-01' })
  })

  it('returns the same object when everything is still live', () => {
    const seen: SeenMap = { a: '2026-01-01' }
    expect(prunedSeen(seen, ['a', 'b'])).toBe(seen)
  })
})
