// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  usableStats, effectiveMinutes, walkPhrase, walkLine, readWalk,
  needsBackfill, walkWindow, applyBackfill, BACKFILL_WINDOW_MS, BACKFILL_GIVE_UP_MS,
} from './walkStats.js'
import { setHealthKey } from '../shared/googleHealth'

const stats = { steps: 4211, distanceKm: 3.14, floors: 2, heart: { avg: 96, max: 131, min: 70 } }

describe('the tier roll', () => {
  it('can only be raised by steps, never lowered', () => {
    expect(effectiveMinutes(45, { steps: 2000 })).toBe(45) // a slow wander keeps its time
    expect(effectiveMinutes(25, { steps: 4000 })).toBe(40) // a brisk one counts for more
    expect(effectiveMinutes(25, null)).toBe(25)
  })
})

describe('words', () => {
  it('tells the oracle the shape of the walk', () => {
    expect(walkPhrase(stats)).toBe(' On the way they took 4,211 steps, covered 3.1 km, climbed 2 flights of stairs or hill and their heart rose to 131 beats a minute.')
    expect(walkPhrase({ steps: 900 })).toBe(' On the way they took 900 steps.')
    expect(walkPhrase(null)).toBe('')
  })

  it('writes the short line for the find and its relic', () => {
    expect(walkLine(stats)).toBe('4,211 steps · 3.1 km · 2 ↑ · ♥ 96–131')
    expect(walkLine(null)).toBe('')
  })

  it('treats an all-empty window as no reading', () => {
    expect(usableStats({ steps: 0, heart: null })).toBeNull()
    expect(usableStats({ steps: 120, heart: null, floors: 0 })).toEqual({ steps: 120, distanceKm: null, floors: null, heart: null })
  })
})

describe('readWalk', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('does nothing at all without a key', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    expect(await readWalk(0, 60000)).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })

  it('returns the reading, or null on any failure', async () => {
    setHealthKey('k')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ steps: 3000, heart: { avg: 90, max: 120 } }) })))
    expect(await readWalk(0, 60000)).toMatchObject({ steps: 3000, heart: { avg: 90 } })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))
    expect(await readWalk(0, 60000)).toBeNull()
  })
})

describe('late syncs', () => {
  const now = Date.parse('2026-11-04T18:00:00Z')
  const walk = (agoMs, extra = {}) => ({ ts: now - agoMs, durationMinutes: 40, ...extra })

  it('asks again for recent unread or empty relics only', () => {
    expect(needsBackfill(walk(3600000), now)).toBe(true)
    expect(needsBackfill(walk(3600000, { stats: null }), now)).toBe(true)
    expect(needsBackfill(walk(3600000, { stats }), now)).toBe(false)
    expect(needsBackfill(walk(3600000, { stats: null, statsFinal: true }), now)).toBe(false)
    expect(needsBackfill(walk(BACKFILL_WINDOW_MS + 1), now)).toBe(false)
  })

  it('covers the walk that ended at ts', () => {
    expect(walkWindow({ ts: 10_000_000, durationMinutes: 40 })).toEqual([10_000_000 - 2_400_000, 10_000_000])
  })

  it('gives up on an empty relic after a few hours', () => {
    expect(applyBackfill(walk(3600000), null, now)).toMatchObject({ stats: null, statsFinal: false })
    expect(applyBackfill(walk(BACKFILL_GIVE_UP_MS + 1), null, now)).toMatchObject({ stats: null, statsFinal: true })
    expect(applyBackfill(walk(3600000), stats, now)).toMatchObject({ stats, statsFinal: true })
  })
})
