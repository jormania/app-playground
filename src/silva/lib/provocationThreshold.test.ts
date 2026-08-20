// @vitest-environment happy-dom
import { beforeEach, describe, it, expect } from 'vitest'
import {
  collectionFingerprint,
  thresholdCrossed,
  recordProvocationOffered,
  readThresholdState,
  QUIET_DAYS,
} from './provocationThreshold'
import type { Thing } from './notion'

function thing(patch: Partial<Thing>): Thing {
  return {
    id: 'x', handle: 'x', body: 'x', kind: null, state: 'Kept', sourceId: null,
    locator: '', encountered: '2026-01-01', kept: '2026-01-01', note: '',
    lociIds: [], image: null, link: null, koboBookmarkId: null, arrived: null, ...patch,
  }
}

beforeEach(() => localStorage.clear())

describe('collectionFingerprint', () => {
  it('ignores edits to a thing that leave the collection the same shape', () => {
    const a = collectionFingerprint([thing({ id: '1', note: 'first' })], [], [])
    const b = collectionFingerprint([thing({ id: '1', note: 'rewritten' })], [], [])
    expect(a).toBe(b)
  })

  it('changes when something is kept', () => {
    const before = collectionFingerprint([thing({ id: '1' })], [], [])
    const after = collectionFingerprint(
      [thing({ id: '1' }), thing({ id: '2', kept: '2026-02-02' })],
      [],
      [],
    )
    expect(after).not.toBe(before)
  })

  it('changes when a thing moves out of the understory', () => {
    const before = collectionFingerprint([thing({ id: '1', state: 'Understory', kept: null })], [], [])
    const after = collectionFingerprint([thing({ id: '1', state: 'Kept', kept: '2026-03-03' })], [], [])
    expect(after).not.toBe(before)
  })

  it('changes when a path is walked', () => {
    const things = [thing({ id: '1' })]
    const before = collectionFingerprint(things, [], [])
    const after = collectionFingerprint(things, [], [
      { id: 'p', label: 'a', fromId: '1', toId: '2', why: 'w', made: '2026-01-01', origin: 'Yours' },
    ])
    expect(after).not.toBe(before)
  })
})

describe('thresholdCrossed', () => {
  it('is crossed on a first run, with nothing to compare against', () => {
    expect(thresholdCrossed('a', null)).toBe(true)
  })

  it('is NOT crossed when nothing changed and no time has passed — the anti-feed rule', () => {
    expect(thresholdCrossed('a', { fingerprint: 'a', offered: '2026-06-01' }, new Date('2026-06-01T12:00:00'))).toBe(false)
  })

  it('is crossed when the collection changed', () => {
    expect(thresholdCrossed('b', { fingerprint: 'a', offered: '2026-06-01' }, new Date('2026-06-01T12:00:00'))).toBe(true)
  })

  it('stays silent through the whole quiet period, then speaks', () => {
    const previous = { fingerprint: 'a', offered: '2026-06-01' }
    const dayBefore = new Date('2026-06-01T12:00:00')
    dayBefore.setDate(dayBefore.getDate() + QUIET_DAYS - 1)
    expect(thresholdCrossed('a', previous, dayBefore)).toBe(false)

    const dayOf = new Date('2026-06-01T12:00:00')
    dayOf.setDate(dayOf.getDate() + QUIET_DAYS)
    expect(thresholdCrossed('a', previous, dayOf)).toBe(true)
  })
})

describe('recordProvocationOffered', () => {
  it('round-trips through storage', () => {
    recordProvocationOffered('fingerprint-1', new Date('2026-07-04T09:00:00'))
    expect(readThresholdState()).toEqual({ fingerprint: 'fingerprint-1', offered: '2026-07-04' })
  })

  it('reads back null when nothing was ever recorded', () => {
    expect(readThresholdState()).toBeNull()
  })
})
