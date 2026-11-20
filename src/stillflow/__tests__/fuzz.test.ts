// Property checks with a seeded generator: many small random cases, the same
// ones every run, so a failure is reproducible.
import { describe, expect, it } from 'vitest'
import { DEMO_SESSIONS } from '../data/demo'
import { DEFAULT_PREFERENCES, type Session, type UserSessionData } from '../domain/types'
import { PHYSICAL_FOCUS, STYLES } from '../domain/vocabulary'
import { parseCsv, toCsv } from '../lib/csv'
import { EMPTY_FILTERS, activeFilterCount, applyFilters, type Filters } from '../lib/filter'
import { exportCsv, exportJson, previewImport } from '../lib/importExport'
import { DEFAULT_CONSTRAINTS, MODES, passesConstraints, buildProfile, surprise, type Constraints } from '../lib/recommend'
import { seededRandom } from '../lib/seeded'

const rand = seededRandom(20261120)
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]
const some = <T,>(xs: readonly T[], max = 3) => [...new Set(Array.from({ length: Math.floor(rand() * (max + 1)) }, () => pick(xs)))]
const nasty = ['', ' ', ',', '"', '""', '\n', '\r\n', 'a,b', 'say "hi"', 'é', 'ș', '🧘', '|', ';', '  lead', 'trail  ', '=1+1', '\t']
const text = () => Array.from({ length: 1 + Math.floor(rand() * 4) }, () => pick(nasty)).join(pick(['', 'x', ' ']))

describe('csv', () => {
  it('round-trips 300 random tables of hostile cells', () => {
    for (let n = 0; n < 300; n++) {
      const cols = 1 + Math.floor(rand() * 5)
      const header = Array.from({ length: cols }, (_, i) => `c${i}`)
      const rows = Array.from({ length: 1 + Math.floor(rand() * 4) }, () => Array.from({ length: cols }, text))
      // A row of only blank cells is skipped by design, so give each a marker.
      rows.forEach((r) => { r[0] = `r${r[0]}` })
      expect(parseCsv(toCsv(header, rows))).toEqual([header, ...rows])
    }
  })
})

describe('import/export', () => {
  it('JSON and CSV exports of random catalogues re-import without loss', () => {
    for (let n = 0; n < 40; n++) {
      const sessions: Session[] = Array.from({ length: 1 + Math.floor(rand() * 6) }, (_, i) => {
        const id = `${String(n).padStart(3, '0')}${String(i).padStart(2, '0')}abcdef`.slice(0, 11)
        return {
          id: `yt-${id}`, title: `t${i} ${text()}`.trim(), instructor: 'Yoga With Adriene',
          youtubeUrl: `https://www.youtube.com/watch?v=${id}`, youtubeVideoId: id, thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          durationMinutes: 1 + Math.floor(rand() * 90), styles: some(STYLES), intensity: Math.floor(rand() * 6),
          physicalFocus: some(PHYSICAL_FOCUS), objectives: [], energy: [], experienceLevel: [], timeOfDay: [], equipment: [],
          tags: some(['a', 'b c', 'd']), classificationConfidence: pick(['high', 'medium', 'low'] as const),
          classificationSource: pick(['manual', 'verified', 'inferred'] as const), dateAdded: '2026-01-01T00:00:00.000Z',
        }
      })
      const fromJson = previewImport(exportJson(sessions), 'json', [], 'now').rows.map((r) => r.session)
      expect(fromJson).toEqual(sessions)
      const fromCsv = previewImport(exportCsv(sessions), 'csv', [], 'now').rows.map((r) => r.session)
      fromCsv.forEach((s, i) => expect({ ...s, title: s!.title.trim() }).toMatchObject({ ...sessions[i], title: sessions[i].title.trim() }))
    }
  })
})

describe('filters', () => {
  const sessions = DEMO_SESSIONS
  const userData: Record<string, UserSessionData> = Object.fromEntries(sessions.filter(() => rand() < 0.5)
    .map((s) => [s.id, { sessionId: s.id, favourite: rand() < 0.5, rating: pick([undefined, 1, 2, 3, 4, 5]) }]))
  const ctx = { userData, lastPractised: {} }
  const randomFilters = (): Filters => ({
    ...EMPTY_FILTERS,
    styles: some(STYLES, 2), focus: some(PHYSICAL_FOCUS, 2), intensities: some([1, 2, 3, 4, 5], 2),
    ratings: some([0, 1, 2, 3, 4, 5], 2), favouritesOnly: rand() < 0.2,
  })

  it('adding a filter never adds results; results always satisfy every chosen value', () => {
    for (let n = 0; n < 200; n++) {
      const f = randomFilters()
      const base = applyFilters(sessions, f, 'recent', ctx)
      const narrower = applyFilters(sessions, { ...f, durations: ['20-30'] }, 'recent', ctx)
      expect(narrower.length).toBeLessThanOrEqual(base.length)
      for (const s of base) {
        if (f.styles.length) expect(f.styles.some((x) => s.styles.includes(x))).toBe(true)
        if (f.intensities.length) expect(f.intensities).toContain(s.intensity)
        if (f.ratings.length) expect(f.ratings).toContain(userData[s.id]?.rating ?? 0)
        if (f.favouritesOnly) expect(userData[s.id]?.favourite).toBe(true)
      }
      // Every sort is a permutation of the same results.
      for (const sort of ['shortest', 'longest', 'random', 'rating', 'practisedLeast'] as const) {
        expect(applyFilters(sessions, f, sort, ctx).map((s) => s.id).sort()).toEqual(base.map((s) => s.id).sort())
      }
      expect(activeFilterCount(f)).toBe(f.styles.length + f.focus.length + f.intensities.length + f.ratings.length + (f.favouritesOnly ? 1 : 0))
    }
  })
})

describe('Surprise Me', () => {
  it('never breaks a constraint, never picks a hidden session, in any mode', () => {
    const sessions = DEMO_SESSIONS
    const today = '2026-11-20'
    for (let n = 0; n < 300; n++) {
      const userData: Record<string, UserSessionData> = Object.fromEntries(sessions.filter(() => rand() < 0.4)
        .map((s) => [s.id, { sessionId: s.id, favourite: rand() < 0.4, excluded: rand() < 0.2, rating: pick([undefined, 1, 3, 5]) }]))
      const history = sessions.filter(() => rand() < 0.3).map((s, i) => ({ id: `h${i}`, sessionId: s.id, date: `2026-11-${String(1 + Math.floor(rand() * 19)).padStart(2, '0')}`, minutes: 10, createdAt: '' }))
      const c: Constraints = {
        ...DEFAULT_CONSTRAINTS,
        maxDuration: pick([undefined, 10, 20, 45]),
        minIntensity: pick([undefined, 1, 3]),
        maxIntensity: pick([undefined, 2, 5]),
        focus: some(PHYSICAL_FOCUS, 1), excludeStyles: some(STYLES, 2), favourites: pick(['any', 'only', 'exclude'] as const),
        excludeCompleted: rand() < 0.3,
      }
      const mode = pick(MODES).id
      const ctx = { sessions, userData, history, preferences: DEFAULT_PREFERENCES, shown: [], today }
      const result = surprise(mode, c, ctx, rand)
      if (!result) continue
      expect(userData[result.session.id]?.excluded).not.toBe(true)
      expect(passesConstraints(result.session, c, ctx, buildProfile(sessions, history, today))).toBe(true)
      expect(result.reason.length).toBeGreaterThan(10)
      expect(result.reason).not.toMatch(/undefined|NaN|null/)
    }
  })

  it('rarely proposes a session rated "once was enough"', () => {
    const sessions = DEMO_SESSIONS
    const userData = Object.fromEntries(sessions.map((s, i) => [s.id, { sessionId: s.id, favourite: false, rating: i === 0 ? 1 : 3 }]))
    let hits = 0
    for (let n = 0; n < 2000; n++) {
      const r = surprise('random', DEFAULT_CONSTRAINTS, { sessions, userData, history: [], preferences: DEFAULT_PREFERENCES, shown: [], today: '2026-11-20' }, rand)
      if (r?.session.id === sessions[0].id) hits++
    }
    // Uniform would be 2000/16 = 125; the discount brings it to about a fifth of that.
    expect(hits).toBeGreaterThan(5)
    expect(hits).toBeLessThan(60)
  })
})
