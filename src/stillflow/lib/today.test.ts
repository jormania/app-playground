import { describe, expect, it } from 'vitest'
import type { PracticeEntry, Session } from '../domain/types'
import { BUILT_IN_SERIES } from '../data/series'
import { applyAvailability, backupNudge, dueForRepeat, shortTitle, sinceBackup, weekRing } from './today'
import { demosToRemove } from './migrations'

const sess = (id: string, over: Partial<Session> = {}): Session => ({
  id, title: `Session ${id}`, instructor: 'Yoga With Adriene', youtubeUrl: '', youtubeVideoId: `${id}`.padEnd(11, 'x'),
  durationMinutes: 20, styles: [], intensity: 2, physicalFocus: [], objectives: [], energy: [], experienceLevel: [],
  timeOfDay: [], equipment: [], tags: [], classificationConfidence: 'high', classificationSource: 'manual', dateAdded: 'x', ...over,
})
const entry = (sessionId: string, date: string, createdAt = `${date}T10:00:00Z`): PracticeEntry => ({ id: `${sessionId}-${date}`, sessionId, date, minutes: 20, createdAt })

describe('due for a repeat', () => {
  const sessions = [sess('staple'), sess('want'), sess('happy'), sess('meh'), sess('recent'), sess('never'), sess('gone', { tags: ['unavailable'] }), sess('hidden')]
  const userData = {
    staple: { sessionId: 'staple', favourite: false, rating: 5 },
    want: { sessionId: 'want', favourite: false, rating: 4 },
    happy: { sessionId: 'happy', favourite: false, rating: 3 },
    meh: { sessionId: 'meh', favourite: false, rating: 2 },
    recent: { sessionId: 'recent', favourite: false, rating: 5 },
    never: { sessionId: 'never', favourite: false, rating: 5 },
    gone: { sessionId: 'gone', favourite: false, rating: 5 },
    hidden: { sessionId: 'hidden', favourite: false, rating: 5, excluded: true },
  }
  const last = {
    staple: '2026-09-01', want: '2026-08-01', happy: '2026-07-01', meh: '2025-01-01', recent: '2026-11-10', gone: '2026-01-01', hidden: '2026-01-01',
  }

  it('brings back what you want to repeat after six weeks, "happy to repeat" after three months, staples first', () => {
    const due = dueForRepeat(sessions, userData, last, '2026-11-21')
    expect(due.map((d) => d.session.id)).toEqual(['staple', 'want', 'happy'])
    expect(due[0].since).toBe(81)
  })

  it('never nags about low ratings, recent practice, unpractised, hidden or vanished videos', () => {
    const ids = dueForRepeat(sessions, userData, last, '2026-11-21').map((d) => d.session.id)
    for (const id of ['meh', 'recent', 'never', 'gone', 'hidden']) expect(ids).not.toContain(id)
  })

  it('"happy to repeat" is not due at 60 days', () => {
    expect(dueForRepeat([sess('happy')], userData, { happy: '2026-09-22' }, '2026-11-21')).toEqual([])
  })
})

describe('card titles', () => {
  it('a series day shows its theme, with the series and day as the label', () => {
    expect(shortTitle(sess('a', { title: 'Day 2 - Open  |  MOVE - A 30 Day Yoga Journey', series: 'MOVE', seriesDay: 2 }), BUILT_IN_SERIES))
      .toEqual({ title: 'Open', label: 'MOVE · Day 2' })
    expect(shortTitle(sess('b', { title: 'Center - Day 17 - Move', series: 'CENTER', seriesDay: 17 }), BUILT_IN_SERIES).title).toBe('Move')
  })

  it('other titles lose a trailing "| Yoga With Adriene" and keep everything else', () => {
    expect(shortTitle(sess('c', { title: 'Yoga For Hips  |  Yoga With Adriene' }), BUILT_IN_SERIES)).toEqual({ title: 'Yoga For Hips', label: undefined })
    expect(shortTitle(sess('d', { title: 'Yoga With Adriene' }), BUILT_IN_SERIES).title).toBe('Yoga With Adriene')
  })

  it('a series day with no theme of its own keeps its title', () => {
    expect(shortTitle(sess('e', { title: 'Prana - Day 3', series: 'PRANA', seriesDay: 3 }), BUILT_IN_SERIES))
      .toEqual({ title: 'Prana - Day 3', label: 'PRANA · Day 3' })
  })
})

describe('backup nudge', () => {
  const many = (n: number, createdAt = '2026-11-01T10:00:00Z') => Array.from({ length: n }, (_, i) => entry(`s${i}`, '2026-11-01', createdAt))

  it('stays quiet with no new practice, or under ten with no backup at all', () => {
    expect(backupNudge([], {}, '2026-11-21')).toBeNull()
    expect(backupNudge(many(9), {}, '2026-11-21')).toBeNull()
    expect(backupNudge(many(10), {}, '2026-11-21')).toBe(10)
  })

  it('asks after twenty since the last backup, or a month on with anything new', () => {
    const at = '2026-10-31T00:00:00Z'
    expect(backupNudge(many(19), { lastBackupAt: at }, '2026-11-21')).toBeNull()
    expect(backupNudge(many(20), { lastBackupAt: at }, '2026-11-21')).toBe(20)
    expect(backupNudge(many(1), { lastBackupAt: '2026-10-01T00:00:00Z' }, '2026-11-21')).toBe(1)
    expect(backupNudge(many(20, '2026-10-01T00:00:00Z'), { lastBackupAt: at }, '2026-11-21')).toBeNull()
  })

  it('"Not now" quiets it for a week', () => {
    expect(backupNudge(many(30), { backupNudgeDismissedAt: '2026-11-18T09:00:00Z' }, '2026-11-21')).toBeNull()
    expect(backupNudge(many(30), { backupNudgeDismissedAt: '2026-11-10T09:00:00Z' }, '2026-11-21')).toBe(30)
  })

  it('counts practices recorded after the backup', () => {
    expect(sinceBackup([entry('a', '2026-11-01', '2026-11-01T10:00:00Z'), entry('b', '2026-11-02', '2026-11-02T10:00:00Z')], '2026-11-01T12:00:00Z')).toBe(1)
  })
})

describe('videos that no longer play', () => {
  it('marks the missing, clears ones that came back, and leaves unchecked ones alone', () => {
    const lib = [
      sess('a', { youtubeVideoId: 'aaaaaaaaaaa' }),
      sess('b', { youtubeVideoId: 'bbbbbbbbbbb', tags: ['unavailable', 'x'] }),
      sess('c', { youtubeVideoId: 'ccccccccccc', tags: ['unavailable'] }),
      sess('d', { youtubeVideoId: 'ddddddddddd' }),
    ]
    const changed = applyAvailability(lib, ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ddddddddddd'], ['bbbbbbbbbbb', 'ddddddddddd'])
    expect(changed.map((s) => [s.id, s.tags])).toEqual([['a', ['unavailable']], ['b', ['x']]])
  })
})

describe('week ring', () => {
  it('fills towards the goal and stops at full', () => {
    expect(weekRing(60, 120)).toEqual({ frac: 0.5, label: '60 of 120 min' })
    expect(weekRing(200, 120).frac).toBe(1)
    expect(weekRing(45)).toEqual({ frac: 0, label: '45 min' })
  })
})

describe('demo records', () => {
  const base = { history: [] as PracticeEntry[], seriesProgress: {}, customSeries: [] }
  const real = Array.from({ length: 10 }, (_, i) => sess(`r${i}`))
  const demos = [sess('demo-a', { isDemo: true }), sess('demo-b', { isDemo: true }), sess('demo-c', { isDemo: true })]

  it('stay while the library is mostly demos', () => {
    expect(demosToRemove({ ...base, sessions: [...real.slice(0, 9), ...demos] })).toEqual([])
  })

  it('go once a real library is in place, except ones you practised, rated or collected', () => {
    const out = demosToRemove({
      ...base, sessions: [...real, ...demos], history: [entry('demo-a', '2026-11-01')],
      userData: { 'demo-b': { sessionId: 'demo-b', favourite: true } }, collections: [],
    })
    expect(out).toEqual(['demo-c'])
  })
})

describe('Release 7: the hour, time away, and learning from practice', async () => {
  const { momentOf, daysAway, gentleReturn, learnFromPractice } = await import('./today')

  it('mornings lean to waking up, evenings to winding down, midday is open', () => {
    expect(momentOf(7).suits?.(sess('m', { title: 'Wake Up Yoga' }))).toBe(true)
    expect(momentOf(7).suits?.(sess('m', { title: 'Bedtime Yoga' }))).toBe(false)
    expect(momentOf(13).suits).toBeUndefined()
    expect(momentOf(19).suits?.(sess('e', { title: 'Yoga For Stress Relief' }))).toBe(true)
    expect(momentOf(23).suits?.(sess('n', { title: 'Bedtime Yoga', durationMinutes: 45 }))).toBe(false)
    expect(momentOf(2).id).toBe('night')
  })

  it('counts days since the latest practice, whatever order history is in', () => {
    expect(daysAway([], '2026-11-21')).toBeNull()
    expect(daysAway([entry('a', '2026-11-10'), entry('b', '2026-11-15')], '2026-11-21')).toBe(6)
  })

  it('a gentle return is short and soft', () => {
    expect(gentleReturn(sess('g', { title: 'Gentle Yoga For Tired Bodies', durationMinutes: 15 }))).toBe(true)
    expect(gentleReturn(sess('g', { title: 'Gentle Yoga', durationMinutes: 40 }))).toBe(false)
    expect(gentleReturn(sess('p', { title: 'Power Yoga', durationMinutes: 15 }))).toBe(false)
  })

  it('fills in intensity only where none is set, and only adds goals and areas', () => {
    const blank = sess('b', { intensity: 0, objectives: [], physicalFocus: [] })
    expect(learnFromPractice(blank, 2, ['Relaxation'], ['Hips'])).toMatchObject({ intensity: 2, objectives: ['Relaxation'], physicalFocus: ['Hips'] })
    const mine = sess('m', { intensity: 4, objectives: ['Strength'], classificationSource: 'manual' })
    expect(learnFromPractice(mine, 2, ['Core' as never], [])?.intensity).toBe(4)
    expect(learnFromPractice(mine, 2, ['Strength'], [])).toBeNull()
    expect(learnFromPractice(sess('g', { intensity: 3, classificationSource: 'inferred' }), 2, [], [])?.intensity).toBe(2)
  })
})
