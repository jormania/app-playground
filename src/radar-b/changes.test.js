import { describe, expect, it } from 'vitest'
import { CHANGE, toSnapshot, diff, sortChanges, changeSignature, undismissedChanges } from './changes.js'

function ev(id, over = {}) {
  return { id, name: `Event ${id}`, venue: 'Control Club', start: '2026-09-20', end: null, hasTime: false, signals: [], dismissed: false, ...over }
}

describe('toSnapshot', () => {
  it('keeps only the fields the diff needs, keyed by id', () => {
    const snap = toSnapshot([ev('a', { signals: ['free'] })], '2026-09-01T00:00:00Z')
    expect(snap).toEqual({
      scannedAt: '2026-09-01T00:00:00Z',
      events: { a: { name: 'Event a', venue: 'Control Club', start: '2026-09-20', end: null, hasTime: false, signals: ['free'], dismissed: false } },
    })
  })

  it('defaults scannedAt to now and tolerates an empty pool', () => {
    expect(toSnapshot(undefined).events).toEqual({})
    expect(toSnapshot([]).scannedAt).toBeTruthy()
  })
})

describe('diff', () => {
  const now = new Date('2026-09-01T12:00:00Z')

  it('reports no changes with no previous snapshot — the baseline', () => {
    const current = toSnapshot([ev('a')])
    expect(diff(null, current, { now })).toEqual({ hadSnapshot: false, changes: [] })
  })

  it('flags a genuinely new event', () => {
    const previous = toSnapshot([ev('a')])
    const current = toSnapshot([ev('a'), ev('b')])
    const result = diff(previous, current, { now })
    expect(result.hadSnapshot).toBe(true)
    expect(result.changes).toEqual([{ kind: CHANGE.NEW, key: 'b', ...current.events.b }])
  })

  it('does not report a new event that arrived already dismissed', () => {
    const previous = toSnapshot([ev('a')])
    const current = toSnapshot([ev('a'), ev('b', { dismissed: true })])
    expect(diff(previous, current, { now }).changes).toEqual([])
  })

  it('flags a signal newly gained: recommended, ticketed, sold-out', () => {
    const previous = toSnapshot([ev('a'), ev('b'), ev('c')])
    const current = toSnapshot([
      ev('a', { signals: ['recommended'] }),
      ev('b', { signals: ['ticketed'] }),
      ev('c', { signals: ['sold-out'] }),
    ])
    const kinds = diff(previous, current, { now }).changes.map((c) => c.kind)
    expect(kinds).toEqual(expect.arrayContaining([CHANGE.RECOMMENDED, CHANGE.TICKETS_OPENED, CHANGE.SOLD_OUT]))
  })

  it('does not re-flag a signal already present last time', () => {
    const previous = toSnapshot([ev('a', { signals: ['recommended'] })])
    const current = toSnapshot([ev('a', { signals: ['recommended'] })])
    expect(diff(previous, current, { now }).changes).toEqual([])
  })

  it('flags a future event dropping out of the pool as gone', () => {
    const previous = toSnapshot([ev('a', { start: '2026-09-20' })])
    const current = toSnapshot([])
    expect(diff(previous, current, { now }).changes).toEqual([{ kind: CHANGE.GONE, key: 'a', ...previous.events.a }])
  })

  it('does not flag a past event dropping out — it simply happened', () => {
    const previous = toSnapshot([ev('a', { start: '2026-08-01' })])
    const current = toSnapshot([])
    expect(diff(previous, current, { now }).changes).toEqual([])
  })

  it('does not flag a dismissed event dropping out — it was hidden on purpose', () => {
    const previous = toSnapshot([ev('a', { start: '2026-09-20', dismissed: true })])
    const current = toSnapshot([])
    expect(diff(previous, current, { now }).changes).toEqual([])
  })
})

describe('sortChanges', () => {
  it('orders recommended, tickets-opened, new, sold-out, gone, then by soonest date', () => {
    const changes = [
      { kind: CHANGE.GONE, key: 'g', start: '2026-09-05' },
      { kind: CHANGE.NEW, key: 'n2', start: '2026-09-10' },
      { kind: CHANGE.NEW, key: 'n1', start: '2026-09-02' },
      { kind: CHANGE.RECOMMENDED, key: 'r', start: '2026-09-01' },
    ]
    expect(sortChanges(changes).map((c) => c.key)).toEqual(['r', 'n1', 'n2', 'g'])
  })
})

describe('changeSignature / undismissedChanges', () => {
  it('signs a change by kind and key', () => {
    expect(changeSignature({ kind: CHANGE.NEW, key: 'a' })).toBe('new-event:a')
  })

  it('filters out changes already dismissed, keeps the rest', () => {
    const changes = [{ kind: CHANGE.NEW, key: 'a' }, { kind: CHANGE.NEW, key: 'b' }]
    expect(undismissedChanges(changes, ['new-event:a'])).toEqual([{ kind: CHANGE.NEW, key: 'b' }])
  })

  it('tolerates missing dismissed keys', () => {
    const changes = [{ kind: CHANGE.NEW, key: 'a' }]
    expect(undismissedChanges(changes)).toEqual(changes)
  })
})
