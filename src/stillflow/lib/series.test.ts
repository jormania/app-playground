import { describe, expect, it } from 'vitest'
import { BUILT_IN_SERIES } from '../data/series'
import type { PracticeEntry, SeriesDef, SeriesProgress, Session } from '../domain/types'
import {
  belongsTo, customSeries, dayTheme, dayOf, daySearchUrl, doneDays, finishProgress, linkedSessions, nextDay, pace,
  seriesOfSession, startProgress, toggleDay,
} from './series'

const move = BUILT_IN_SERIES.find((d) => d.id === 'move-2022')!
const ret = BUILT_IN_SERIES.find((d) => d.id === 'return-2026')!

function s(id: string, over: Partial<Session> = {}): Session {
  return {
    id, title: id, instructor: 'Yoga With Adriene', youtubeUrl: '', youtubeVideoId: '', durationMinutes: 20,
    styles: [], intensity: 2, physicalFocus: [], objectives: [], energy: [], experienceLevel: [], timeOfDay: [],
    equipment: [], tags: [], classificationConfidence: 'low', classificationSource: 'inferred', dateAdded: '', ...over,
  }
}
const entry = (sessionId: string, date: string): PracticeEntry => ({ id: `${sessionId}@${date}`, sessionId, date, minutes: 20, createdAt: date })

describe('which session is which day', () => {
  it('reads the day from seriesDay first, then "Day n" or "Week n" in the title', () => {
    expect(dayOf(s('a', { seriesDay: 8, title: 'Day 3' }))).toBe(8)
    expect(dayOf(s('a', { title: 'Day 12 - Ground' }))).toBe(12)
    expect(dayOf(s('a', { title: 'RETURN | Week 2' }))).toBe(2)
    expect(dayOf(s('a', { title: 'Yoga for Today' }))).toBeNull()
    expect(dayOf(s('a', { title: 'Holiday 5 stretch' }))).toBeNull()
  })

  it('matches the series name exactly or as a prefix, case- and accent-insensitive, but not inside another word', () => {
    expect(belongsTo(s('a', { series: 'MOVE' }), move)).toBe(true)
    expect(belongsTo(s('a', { series: 'Move - A 30 Day Yoga Journey' }), move)).toBe(true)
    expect(belongsTo(s('a', { series: 'MOVEMENT basics' }), move)).toBe(false)
    expect(belongsTo(s('a', { series: 'Remove' }), move)).toBe(false)
    expect(belongsTo(s('a'), move)).toBe(false)
  })

  it('links by series + day, ignores days out of range, and lets your own links win', () => {
    const d8 = s('d8', { series: 'MOVE', title: 'Day 8' })
    const d8b = s('d8b', { series: 'MOVE', title: 'Day 8 (again)' })
    const d40 = s('d40', { series: 'MOVE', seriesDay: 40 })
    const mine = s('mine', { title: 'Something I chose' })
    const p: SeriesProgress = { seriesId: move.id, status: 'active', startedAt: '2026-11-01', manualDays: {}, links: { 9: 'mine', 10: 'gone' }, runs: [] }
    const linked = linkedSessions(move, [d8, d8b, d40, mine], p)
    expect(linked.get(8)?.id).toBe('d8')
    expect(linked.has(40)).toBe(false)
    expect(linked.get(9)?.id).toBe('mine')
    expect(linked.has(10)).toBe(false)
    expect(seriesOfSession(mine, [move], { [move.id]: p })).toEqual([{ def: move, day: 9 }])
  })
})

describe('progress through a run', () => {
  const d1 = s('d1', { series: 'MOVE', seriesDay: 1 })
  const d2 = s('d2', { series: 'MOVE', seriesDay: 2 })
  const linked = linkedSessions(move, [d1, d2])

  it('counts manual ticks and linked practice on or after the start, never before', () => {
    const p = toggleDay(startProgress(move, '2026-11-10'), 3, '2026-11-12', true)
    const history = [entry('d2', '2026-11-11'), entry('d1', '2026-11-09'), entry('d1', '2026-11-10')]
    const done = doneDays(move, p, linked, history)
    expect([...done.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3])
    expect(done.get(1)).toBe('2026-11-10')
    expect(nextDay(move, done)).toBe(4)
  })

  it('a finished run stops counting practice after its end; an idle record counts nothing', () => {
    const run = finishProgress(startProgress(move, '2026-11-01'), 'abandoned', '2026-11-05', 0)
    expect(doneDays(move, run, linked, [entry('d1', '2026-11-03'), entry('d2', '2026-11-06')]).size).toBe(1)
    const idle: SeriesProgress = { seriesId: move.id, status: 'idle', startedAt: '2026-11-01', manualDays: { 1: '2026-11-02' }, links: {}, runs: [] }
    expect(doneDays(move, idle, linked, [entry('d1', '2026-11-03')]).size).toBe(0)
  })

  it('unticking removes only the manual mark', () => {
    let p = toggleDay(startProgress(move, '2026-11-10'), 5, '2026-11-11', true)
    p = toggleDay(p, 5, '2026-11-11', false)
    expect(p.manualDays).toEqual({})
  })

  it('restarting an active run files it as abandoned; finishing files it once', () => {
    const first = startProgress(move, '2026-01-01')
    const restarted = startProgress(move, '2026-02-01', toggleDay(first, 1, '2026-01-01', true), 1)
    expect(restarted.runs).toEqual([{ startedAt: '2026-01-01', endedAt: '2026-02-01', status: 'abandoned', daysDone: 1 }])
    expect(restarted.manualDays).toEqual({})
    const finished = finishProgress(restarted, 'completed', '2026-03-02', 30)
    expect(finished.runs).toHaveLength(2)
    expect(startProgress(move, '2026-04-01', finished).runs).toHaveLength(2)
  })

  it('keeps your links across restarts', () => {
    const p = { ...startProgress(move, '2026-01-01'), links: { 4: 'x' } }
    expect(startProgress(move, '2026-02-01', p).links).toEqual({ 4: 'x' })
  })
})

describe('pace', () => {
  const p = startProgress(move, '2026-11-01')
  it('is gentle: on rhythm, one behind, several behind, all done', () => {
    expect(pace(move, p, 0, '2026-11-01').label).toBe('On your rhythm') // the first day isn't over yet
    expect(pace(move, p, 1, '2026-11-01').label).toBe('On your rhythm')
    expect(pace(move, p, 1, '2026-11-02').label).toBe('On your rhythm')
    expect(pace(move, p, 1, '2026-11-03').label).toMatch(/One day to catch up/)
    expect(pace(move, p, 2, '2026-11-08').label).toMatch(/^5 days behind/)
    expect(pace(move, p, 30, '2026-12-20').label).toBe('Every practice done')
  })

  it('caps expectation at the series length and steps weekly series by seven days', () => {
    expect(pace(move, p, 10, '2027-06-01').expected).toBe(30)
    const w = startProgress(ret, '2026-11-01')
    expect(pace(ret, w, 1, '2026-11-07').expected).toBe(1)
    expect(pace(ret, w, 1, '2026-11-08').expected).toBe(2)
    expect(pace(ret, w, 0, '2026-11-08').label).toMatch(/One week/)
  })

  it('crosses a month end and the October DST change without losing a day', () => {
    const q = startProgress(move, '2026-10-24')
    expect(pace(move, q, 0, '2026-10-26').expected).toBe(3)
  })
})

describe('day names from real titles', () => {
  const def = (name: string) => BUILT_IN_SERIES.find((d) => d.name === name)!
  it.each([
    ['Flow - Day 2 - Notice', 'FLOW', 'Notice'],
    ['Day 2 - Arrive | BREATH - A 30 Day Yoga Journey', 'BREATH', 'Arrive'],
    ['TRUE - Day 15 - BELIEVE  |  Yoga With Adriene', 'TRUE', 'BELIEVE'],
    ['Yoga Camp Day 1 - I Accept', 'Yoga Camp', 'I Accept'],
    ['Day 4 - Yoga For Your Back - 30 Days of Yoga', '30 Days of Yoga', 'Yoga For Your Back'],
    ['Return - 2 - Ground', 'RETURN', 'Ground'],
    ['Unwind  -  Home - Day 25  |  30 Days of Yoga', 'HOME', 'Unwind'],
    ['Prana - Day 3', 'PRANA', ''],
  ])('%s → %s', (title, name, theme) => {
    expect(dayTheme(title, def(name))).toBe(theme)
  })
})

describe('series definitions', () => {
  it('search URLs name the instructor, the series and the day', () => {
    expect(daySearchUrl(move, 8)).toBe('https://www.youtube.com/results?search_query=Yoga%20With%20Adriene%20MOVE%20Day%208')
    expect(daySearchUrl(ret, 2)).toContain('RETURN%20Week%202')
  })

  it('custom series clamp their length and match their own name', () => {
    const c: SeriesDef = customSeries('  Yoga for Runners ', 500, 'Day', 'Yoga With Adriene')
    expect(c.length).toBe(90)
    expect(c.kind).toBe('custom')
    expect(belongsTo(s('a', { series: 'yoga for runners' }), c)).toBe(true)
    expect(customSeries('x', 0, 'Week', 'Y').length).toBe(1)
  })
})

describe('practices logged with dates before Start', () => {
  it('count towards a first run, and the run reads as starting from the first one', async () => {
    const { BUILT_IN_SERIES } = await import('../data/series')
    const { doneDays, inRun, runStart, nextDay, pace } = await import('./series')
    const def = BUILT_IN_SERIES.find((d) => d.id === 'move-2022')!
    const mk = (n: number) => ({ id: `m${n}`, title: `Day ${n}`, series: 'MOVE', seriesDay: n } as unknown as import('../domain/types').Session)
    const linked = new Map([[1, mk(1)], [2, mk(2)]])
    const progress = { seriesId: def.id, status: 'active' as const, startedAt: '2026-11-20', manualDays: {}, links: {}, runs: [] }
    const history = [
      { id: 'b', sessionId: 'm2', date: '2026-11-19', minutes: 28, createdAt: '2026-11-21T07:00:00Z' },
      { id: 'a', sessionId: 'm1', date: '2026-11-18', minutes: 29, createdAt: '2026-11-21T07:00:00Z' },
    ]
    const done = doneDays(def, progress, linked, history)
    expect([...done.keys()].sort()).toEqual([1, 2])
    expect(nextDay(def, done)).toBe(3)
    expect(runStart(progress, done)).toBe('2026-11-18')
    expect(pace(def, { ...progress, startedAt: runStart(progress, done) }, done.size, '2026-11-21').delta).toBe(-1)
    // A second run doesn't inherit practices from before the previous one ended.
    const second = { ...progress, startedAt: '2026-12-01', runs: [{ startedAt: '2026-11-01', endedAt: '2026-11-25', status: 'abandoned' as const, daysDone: 2 }] }
    expect(inRun(second, '2026-11-19')).toBe(false)
    expect(inRun(second, '2026-11-26')).toBe(true)
    expect(inRun(second, '2026-12-02')).toBe(true)
  })
})

describe('two copies of the same day', () => {
  it('a practice of either copy counts the day', async () => {
    const { BUILT_IN_SERIES } = await import('../data/series')
    const { doneDays, linkedSessions } = await import('./series')
    const def = BUILT_IN_SERIES.find((d) => d.id === 'move-2022')!
    const mk = (id: string) => ({ id, title: 'Day 2 - Open | MOVE - A 30 Day Yoga Journey', series: 'MOVE', seriesDay: 2, tags: [] } as unknown as import('../domain/types').Session)
    const sessions = [mk('first'), mk('reupload')]
    const progress = { seriesId: def.id, status: 'active' as const, startedAt: '2026-11-20', manualDays: {}, links: {}, runs: [] }
    const linked = linkedSessions(def, sessions, progress)
    const history = [{ id: 'h', sessionId: 'reupload', date: '2026-11-20', minutes: 28, createdAt: 'x' }]
    expect(doneDays(def, progress, linked, history).has(2)).toBe(linked.get(2)!.id === 'reupload')
    expect(doneDays(def, progress, linked, history, sessions).has(2)).toBe(true)
  })
})
