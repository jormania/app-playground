import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFERENCES, type PracticeEntry, type Session } from '../domain/types'
import { DEFAULT_CONSTRAINTS, buildProfile, daysBetween, surprise, type RecommendContext } from './recommend'

function s(id: string, over: Partial<Session>): Session {
  return {
    id, title: id, instructor: 'YWA', youtubeUrl: '', youtubeVideoId: '', durationMinutes: 20, styles: [], intensity: 3,
    physicalFocus: [], objectives: [], energy: [], experienceLevel: [], timeOfDay: [], equipment: [], tags: [],
    classificationConfidence: 'low', classificationSource: 'inferred', dateAdded: '', ...over,
  }
}

const power = s('power', { styles: ['Power Yoga'], intensity: 5, objectives: ['Strength'], physicalFocus: ['Core'], durationMinutes: 40 })
const core = s('core', { styles: ['Vinyasa'], intensity: 4, objectives: ['Strength'], physicalFocus: ['Core'], durationMinutes: 25 })
const yin = s('yin', { styles: ['Yin Yoga'], intensity: 1, objectives: ['Flexibility', 'Recovery'], physicalFocus: ['Hips'], durationMinutes: 45 })
const breath = s('breath', { styles: ['Breathwork'], intensity: 1, objectives: ['Mindfulness'], physicalFocus: ['Chest'], durationMinutes: 8 })
const hips = s('hips', { styles: ['Hatha'], intensity: 2, objectives: ['Mobility'], physicalFocus: ['Hips'], durationMinutes: 12 })
const sessions = [power, core, yin, breath, hips]

const entry = (sessionId: string, date: string): PracticeEntry => ({ id: `${sessionId}-${date}`, sessionId, date, minutes: 20, createdAt: date })
const ctx = (over: Partial<RecommendContext> = {}): RecommendContext => ({
  sessions, userData: {}, history: [], preferences: DEFAULT_PREFERENCES, shown: [], today: '2026-11-20', ...over,
})

/** Runs many draws and returns how often each id came up. */
function tally(run: (r: () => number) => string | undefined, n = 200) {
  const out: Record<string, number> = {}
  for (let i = 0; i < n; i++) {
    const id = run(() => (i + 0.5) / n)
    if (id) out[id] = (out[id] ?? 0) + 1
  }
  return out
}

describe('profile', () => {
  it('counts the last 30 days and all-time style use', () => {
    const p = buildProfile(sessions, [entry('power', '2026-11-18'), entry('core', '2026-11-10'), entry('yin', '2026-08-01')], '2026-11-20')
    expect(p.recentCount).toBe(2)
    expect(p.focusCounts).toEqual({ Core: 2 })
    expect(p.allStyleCounts['Yin Yoga']).toBe(1)
    expect(p.averageIntensity).toBe(4.5)
    expect(daysBetween('2026-11-18', '2026-11-20')).toBe(2)
  })
})

describe('modes', () => {
  it('challenge only picks strong sessions', () => {
    const t = tally((r) => surprise('challenge', DEFAULT_CONSTRAINTS, ctx(), r)?.session.id)
    expect(Object.keys(t).sort()).toEqual(['core', 'power'])
  })

  it('recovery only picks gentle sessions', () => {
    const t = tally((r) => surprise('recovery', DEFAULT_CONSTRAINTS, ctx(), r)?.session.id)
    expect(Object.keys(t).every((id) => ['yin', 'breath', 'hips'].includes(id))).toBe(true)
  })

  it('short respects the duration constraint and says so', () => {
    const pick = surprise('short', { ...DEFAULT_CONSTRAINTS, maxDuration: 10 }, ctx(), () => 0.5)
    expect(pick?.session.id).toBe('breath')
    expect(pick?.reason).toMatch(/10-minute/)
  })

  it('rediscover needs a favourite or past practice not revisited for three weeks', () => {
    const c = ctx({
      history: [entry('yin', '2026-09-01'), entry('core', '2026-11-15')],
      userData: { hips: { sessionId: 'hips', favourite: true } },
    })
    const t = tally((r) => surprise('rediscover', DEFAULT_CONSTRAINTS, c, r)?.session.id)
    expect(Object.keys(t).sort()).toEqual(['hips', 'yin'])
    expect(surprise('rediscover', DEFAULT_CONSTRAINTS, ctx(), () => 0.5)).toBeNull()
  })

  it('something different leans to styles never practised', () => {
    const c = ctx({ history: [entry('power', '2026-11-01'), entry('power', '2026-11-05'), entry('core', '2026-11-08')] })
    const t = tally((r) => surprise('different', DEFAULT_CONSTRAINTS, c, r)?.session.id)
    expect((t.power ?? 0) + (t.core ?? 0)).toBeLessThan((t.yin ?? 0) + (t.breath ?? 0) + (t.hips ?? 0))
  })

  it('perfect match explains variety after a strength-heavy month', () => {
    const c = ctx({ history: ['2026-11-01', '2026-11-05', '2026-11-12', '2026-11-15'].map((d) => entry('core', d)) })
    const t: Record<string, string> = {}
    for (let i = 0; i < 50; i++) {
      const p = surprise('match', DEFAULT_CONSTRAINTS, c, () => i / 50)!
      t[p.session.id] = p.reason
    }
    const varied = Object.entries(t).find(([id]) => id === 'hips' || id === 'yin')
    expect(varied?.[1]).toMatch(/focusing on strength and core recently/)
  })
})

describe('constraints and repetition', () => {
  it('applies intensity, focus, style and favourite constraints', () => {
    const c = ctx({ userData: { hips: { sessionId: 'hips', favourite: true } } })
    const t = tally((r) => surprise('random', { ...DEFAULT_CONSTRAINTS, maxIntensity: 2, focus: ['Hips'], excludeStyles: ['Yin Yoga'] }, c, r)?.session.id)
    expect(Object.keys(t)).toEqual(['hips'])
    expect(surprise('random', { ...DEFAULT_CONSTRAINTS, favourites: 'only' }, c, () => 0.9)?.session.id).toBe('hips')
    expect(surprise('random', { ...DEFAULT_CONSTRAINTS, minIntensity: 5, maxDuration: 10 }, c, () => 0.5)).toBeNull()
  })

  it('can exclude completed sessions', () => {
    const c = ctx({ history: sessions.filter((x) => x.id !== 'breath').map((x) => entry(x.id, '2026-10-01')) })
    expect(surprise('random', { ...DEFAULT_CONSTRAINTS, excludeCompleted: true }, c, () => 0.3)?.session.id).toBe('breath')
  })

  it('Try Another never repeats until every candidate has been shown', () => {
    const shown: string[] = []
    for (let i = 0; i < sessions.length; i++) {
      const pick = surprise('random', DEFAULT_CONSTRAINTS, ctx({ shown }), () => 0.42)!
      expect(shown).not.toContain(pick.session.id)
      shown.push(pick.session.id)
    }
    expect(surprise('random', DEFAULT_CONSTRAINTS, ctx({ shown }), () => 0.42)).not.toBeNull()
  })

  it('discounts sessions practised in the last three days', () => {
    const c = ctx({ history: [entry('yin', '2026-11-19')] })
    const t = tally((r) => surprise('recovery', DEFAULT_CONSTRAINTS, c, r)?.session.id, 400)
    expect(t.yin ?? 0).toBeLessThan(t.hips ?? 0)
  })
})

describe('women-specific practices in suggestions', () => {
  const prenatal = s('prenatal', { title: 'Prenatal Yoga | 22-Minute Home Yoga Practice', intensity: 2 })
  const draws = (prefs = DEFAULT_PREFERENCES) =>
    tally((r) => surprise('random', DEFAULT_CONSTRAINTS, ctx({ sessions: [...sessions, prenatal], preferences: prefs }), r)?.session.id)

  it('are never proposed by default', () => {
    expect(draws().prenatal).toBeUndefined()
  })

  it('come back if you turn the setting off', () => {
    expect(draws({ ...DEFAULT_PREFERENCES, skipWomenSpecific: false }).prenatal).toBeGreaterThan(0)
  })
})

describe('reasons read as sentences', () => {
  it('never leave a gap where nothing is known, and use "an" before a vowel', () => {
    const blank = (id: string, over: Partial<Session> = {}) => s(id, { intensity: 0, styles: [], objectives: [], physicalFocus: [], ...over })
    const lib = [blank('a'), blank('b'), blank('c'), blank('d', { physicalFocus: ['Upper back'] }), blank('e', { objectives: ['Flexibility'] })]
    const history = ['a', 'b', 'c'].map((id, i) => entry(id, `2026-11-1${i}`))
    for (const mode of ['match', 'recovery', 'challenge', 'comfort', 'different', 'random', 'short', 'rediscover'] as const) {
      for (let i = 0; i < 20; i++) {
        const p = surprise(mode, DEFAULT_CONSTRAINTS, ctx({ sessions: lib, history, today: '2026-11-20' }), () => (i + 0.5) / 20)
        if (!p) continue
        expect(p.reason).not.toMatch(/ {2}|on {1,2}recently|\ba (upper|ankle|arm|easy)|\ba practice, for/)
        expect(p.reason).toMatch(/^[A-Z]/)
      }
    }
  })
})
