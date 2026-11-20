import { describe, expect, it } from 'vitest'
import { BUILT_IN_SERIES } from '../data/series'
import type { PracticeEntry, SeriesProgress, Session } from '../domain/types'
import { rereadChannelSeries, runMigrations, SERIES_READER_VERSION, ticksToPractice } from './migrations'

const move = BUILT_IN_SERIES.find((d) => d.id === 'move-2022')!
function s(id: string, title: string, over: Partial<Session> = {}): Session {
  return {
    id, title, instructor: 'Yoga With Adriene', youtubeUrl: '', youtubeVideoId: id, durationMinutes: 22, styles: [], intensity: 0,
    physicalFocus: [], objectives: [], energy: [], experienceLevel: [], timeOfDay: [], equipment: [], tags: ['from-channel'],
    classificationConfidence: 'low', classificationSource: 'inferred', dateAdded: '', ...over,
  }
}
const active = (manualDays: Record<string, string>): SeriesProgress => ({ seriesId: move.id, status: 'active', startedAt: '2026-11-20', manualDays, links: {}, runs: [] })

describe('re-reading series from channel titles', () => {
  it('fixes what the first reader got wrong, and leaves your own sessions alone', () => {
    const sessions = [
      s('a', 'Flow - Day 21 - Curious'),
      s('b', 'TRUE - Day 12 - CENTER  |  Yoga With Adriene', { series: 'CENTER', seriesDay: 12 }),
      s('c', 'Day 5 - FEEL ALIVE FLOW- 30 Days of Yoga', { series: 'FLOW', seriesDay: 5 }),
      s('d', 'Yoga for Hips', { series: 'MOVE', seriesDay: 3 }),
      s('e', 'Flow - Day 2 - Notice', { tags: [] }),
      s('f', 'Move - Day 29 - Trust', { series: 'MOVE', seriesDay: 29 }),
    ]
    const changed = Object.fromEntries(rereadChannelSeries(sessions).map((x) => [x.id, x]))
    expect(changed.a).toMatchObject({ series: 'FLOW', seriesDay: 21 })
    expect(changed.b).toMatchObject({ series: 'TRUE', seriesDay: 12 })
    expect(changed.c).toMatchObject({ series: '30 Days of Yoga', seriesDay: 5 })
    expect(changed.d.series).toBeUndefined()
    expect('seriesDay' in changed.d).toBe(false)
    expect(changed.e).toBeUndefined() // not from the channel
    expect(changed.f).toBeUndefined() // already right
  })
})

describe('series ticks become practice', () => {
  const sessions = [s('d1', 'Day 1 - Here  |  MOVE - A 30 Day Yoga Journey', { series: 'MOVE', seriesDay: 1 }),
    s('d2', 'Day 2 - Open  |  MOVE - A 30 Day Yoga Journey', { series: 'MOVE', seriesDay: 2 })]

  it('turns ticks on days with a session into entries on the tick date, keeps the rest', () => {
    const r = ticksToPractice(move, active({ 1: '2026-11-20', 2: '2026-11-20', 9: '2026-11-20' }), sessions, [])!
    expect(r.entries.map((e) => [e.sessionId, e.date, e.minutes])).toEqual([['d1', '2026-11-20', 22], ['d2', '2026-11-20', 22]])
    expect(r.progress.manualDays).toEqual({ 9: '2026-11-20' })
  })

  it('does not double-log a tick already in history, and is a no-op the second time', () => {
    const history: PracticeEntry[] = [{ id: 'x', sessionId: 'd1', date: '2026-11-20', minutes: 20, createdAt: '' }]
    const r = ticksToPractice(move, active({ 1: '2026-11-20' }), sessions, history)!
    expect(r.entries).toEqual([])
    expect(r.progress.manualDays).toEqual({})
    expect(ticksToPractice(move, r.progress, sessions, history)).toBeNull()
  })

  it('runs the whole set once, in order: re-read first, then convert ticks against the corrected library', () => {
    const lib = [s('m28', 'Move - Day 28 - TLC')] // the old reader missed this one entirely
    const snap = { sessions: lib, history: [], seriesProgress: { [move.id]: active({ 28: '2026-11-19' }) }, customSeries: [] }
    const m = runMigrations(snap, undefined, new Date('2026-11-20T00:00:00Z'))
    expect(m.sessionUpdates[0]).toMatchObject({ series: 'MOVE', seriesDay: 28 })
    expect(m.newEntries).toEqual([expect.objectContaining({ sessionId: 'm28', date: '2026-11-19' })])
    expect(runMigrations({ ...snap, sessions: m.sessionUpdates, history: m.newEntries, seriesProgress: { [move.id]: m.progressUpdates[0] } }, SERIES_READER_VERSION))
      .toEqual({ sessionUpdates: [], progressUpdates: [], newEntries: [] })
  })
})
