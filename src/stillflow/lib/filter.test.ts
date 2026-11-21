import { describe, expect, it } from 'vitest'
import type { Session } from '../domain/types'
import {
  EMPTY_FILTERS, activeFilterCount, applyFilters, inDurationBucket, lastPractisedMap, sortSessions,
  type Filters, type PersonalContext,
} from './filter'

function session(id: string, over: Partial<Session> = {}): Session {
  return {
    id, title: id, instructor: 'Yoga With Adriene', youtubeUrl: '', youtubeVideoId: '', durationMinutes: 20,
    styles: [], intensity: 3, physicalFocus: [], objectives: [], energy: [], experienceLevel: [], timeOfDay: [],
    equipment: [], tags: [], classificationConfidence: 'low', classificationSource: 'inferred',
    dateAdded: '2026-01-01T00:00:00Z', ...over,
  }
}

const hips = session('hips', { title: 'Yoga for Hips', durationMinutes: 22, styles: ['Hatha'], intensity: 2, physicalFocus: ['Hips', 'Lower back'], description: 'A grounding practice' })
const core = session('core', { title: 'Core Power', durationMinutes: 35, styles: ['Power Yoga', 'Vinyasa'], intensity: 5, physicalFocus: ['Core'], tags: ['abs'] })
const back = session('back', { title: 'Lower Back Love', durationMinutes: 12, styles: ['Gentle Yoga'], intensity: 1, physicalFocus: ['Lower back'], series: 'Back series' })
const nidra = session('nidra', { title: 'Énergie nidra', durationMinutes: 61, styles: ['Yoga Nidra'], intensity: 1, instructor: 'Someone Else' })
const all = [hips, core, back, nidra]

const ctx: PersonalContext = { userData: {}, lastPractised: {} }
const f = (over: Partial<Filters>): Filters => ({ ...EMPTY_FILTERS, ...over })
const ids = (list: Session[]) => list.map((s) => s.id)

describe('search', () => {
  it('matches title, description, instructor, tags, style, focus and series', () => {
    expect(ids(applyFilters(all, f({ query: 'hips' }), 'shortest', ctx))).toEqual(['hips'])
    expect(ids(applyFilters(all, f({ query: 'grounding' }), 'shortest', ctx))).toEqual(['hips'])
    expect(ids(applyFilters(all, f({ query: 'someone' }), 'shortest', ctx))).toEqual(['nidra'])
    expect(ids(applyFilters(all, f({ query: 'abs' }), 'shortest', ctx))).toEqual(['core'])
    expect(ids(applyFilters(all, f({ query: 'vinyasa' }), 'shortest', ctx))).toEqual(['core'])
    expect(ids(applyFilters(all, f({ query: 'back series' }), 'shortest', ctx))).toEqual(['back'])
  })

  it('requires every word and ignores case and diacritics', () => {
    expect(ids(applyFilters(all, f({ query: 'LOWER back' }), 'shortest', ctx))).toEqual(['back', 'hips'])
    expect(ids(applyFilters(all, f({ query: 'energie' }), 'shortest', ctx))).toEqual(['nidra'])
  })
})

describe('filters', () => {
  it('buckets durations with exclusive upper bounds', () => {
    expect(inDurationBucket(10, 'lt10')).toBe(false)
    expect(inDurationBucket(10, '10-15')).toBe(true)
    expect(inDurationBucket(60, 'gt60')).toBe(true)
    expect(inDurationBucket(59, 'gt60')).toBe(false)
  })

  it('ORs values within a category', () => {
    expect(ids(applyFilters(all, f({ durations: ['10-15', '30-45'] }), 'shortest', ctx))).toEqual(['back', 'core'])
    expect(ids(applyFilters(all, f({ focus: ['Hips', 'Core'] }), 'shortest', ctx))).toEqual(['hips', 'core'])
  })

  it('ANDs across categories', () => {
    expect(ids(applyFilters(all, f({ focus: ['Lower back'], intensities: [1] }), 'shortest', ctx))).toEqual(['back'])
    expect(ids(applyFilters(all, f({ styles: ['Power Yoga'], durations: ['lt10'] }), 'shortest', ctx))).toEqual([])
  })

  it('applies a custom duration range inclusively', () => {
    expect(ids(applyFilters(all, f({ customMin: 12, customMax: 22 }), 'shortest', ctx))).toEqual(['back', 'hips'])
  })

  it('filters favourites, and keeps sessions hidden from suggestions browsable', () => {
    const c: PersonalContext = {
      userData: { core: { sessionId: 'core', favourite: true }, back: { sessionId: 'back', favourite: false, excluded: true } },
      lastPractised: {},
    }
    expect(ids(applyFilters(all, f({ favouritesOnly: true }), 'shortest', c))).toEqual(['core'])
    expect(ids(applyFilters(all, EMPTY_FILTERS, 'shortest', c))).toContain('back')
  })

  it('counts active filters', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0)
    expect(activeFilterCount(f({ query: ' x ', styles: ['Hatha', 'Yin Yoga'], favouritesOnly: true, customMax: 10 }))).toBe(5)
  })
})

describe('sorting', () => {
  it('sorts by duration and intensity', () => {
    expect(ids(sortSessions(all, 'longest', ctx))).toEqual(['nidra', 'core', 'hips', 'back'])
    expect(ids(sortSessions(all, 'intensityHigh', ctx))[0]).toBe('core')
  })

  it('sorts by practice recency, with never-practised last or first', () => {
    const lp = lastPractisedMap([
      { id: '1', sessionId: 'hips', date: '2026-11-01', minutes: 20, createdAt: '' },
      { id: '2', sessionId: 'hips', date: '2026-11-10', minutes: 20, createdAt: '' },
      { id: '3', sessionId: 'core', date: '2026-11-05', minutes: 20, createdAt: '' },
    ])
    expect(lp.hips).toBe('2026-11-10')
    const c = { userData: {}, lastPractised: lp }
    expect(ids(sortSessions(all, 'practisedRecent', c)).slice(0, 2)).toEqual(['hips', 'core'])
    expect(ids(sortSessions(all, 'practisedLeast', c)).slice(-2)).toEqual(['core', 'hips'])
  })

  it('shuffles deterministically for a given seed', () => {
    expect(ids(sortSessions(all, 'random', ctx, 7))).toEqual(ids(sortSessions(all, 'random', ctx, 7)))
    expect(sortSessions(all, 'random', ctx, 7)).toHaveLength(4)
  })
})

describe('posted on YouTube', () => {
  it('sorts newest and oldest by publish date, undated last both ways', () => {
    const a = session('a', { publishedDate: '2015-01-02' })
    const b = session('b', { publishedDate: '2024-01-22' })
    const c = session('c')
    const ctx2 = { userData: {}, lastPractised: {} }
    expect(sortSessions([a, b, c], 'postedNew', ctx2).map((s) => s.id)).toEqual(['b', 'a', 'c'])
    expect(sortSessions([a, b, c], 'postedOld', ctx2).map((s) => s.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('Practise for', () => {
  const t = (title: string, over: Partial<Session> = {}) => ({ ...session('x'), title, durationMinutes: 20, ...over }) as Session
  it('matches by title words when a session carries no classification', async () => {
    const { matchesIntention } = await import('./filter')
    expect(matchesIntention(t('Yoga For Tired Legs'), 'restore')).toBe(true)
    expect(matchesIntention(t('Morning Yoga - Energizing Morning Sequence'), 'energise')).toBe(true)
    expect(matchesIntention(t('Bedtime Yoga Sequence'), 'relax')).toBe(true)
    expect(matchesIntention(t('Lower Back Mobility'), 'area:Lower back')).toBe(true)
    expect(matchesIntention(t('Power Yoga - with Adriene'), 'relax')).toBe(false)
    // The series name isn't a theme: "BREATH" days aren't all relaxation.
    expect(matchesIntention(t('Day 6 - Burn |  BREATH - A 30 Day Yoga Journey'), 'relax')).toBe(false)
  })
  it('matches by classification too', async () => {
    const { matchesIntention } = await import('./filter')
    expect(matchesIntention(t('Untitled flow', { objectives: ['Recovery'] }), 'restore')).toBe(true)
  })
  it('never offers vlogs, trailers, tips or pose tutorials', async () => {
    const { isExtra, matchesIntention } = await import('./filter')
    for (const title of ['FWFG Austin Roadshow VLOG', 'CENTER - A 30 Day Yoga Journey', 'Yoga Tips: Engage Your Warrior',
      'Welcome to MOVE - A 30 Day Yoga Journey  |  Yoga With Adriene', 'Foundations of Salad - with Hilah Cooking', 'What is Vinyasa?']) {
      expect(isExtra({ title, durationMinutes: 8 })).toBe(true)
    }
    expect(isExtra({ title: 'Side Plank Pose |  Vasisthasana', durationMinutes: 8 })).toBe(true)
    expect(isExtra({ title: 'Yoga for Beginners - Foundations of Flow', durationMinutes: 20 })).toBe(false)
    expect(isExtra({ title: 'Yoga For Hips | Yoga With Adriene', durationMinutes: 8 })).toBe(false)
    expect(matchesIntention(t('Yoga Tips For Relaxation'), 'relax')).toBe(false)
  })
  it('counts as one filter, named', async () => {
    const { activeFilterCount, EMPTY_FILTERS } = await import('./filter')
    expect(activeFilterCount({ ...EMPTY_FILTERS, intention: 'restore' })).toBe(1)
  })
})
