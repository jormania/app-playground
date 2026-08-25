import { describe, test, expect } from 'vitest'
import { passesIntake, intakeRejection, DEFAULT_INTAKE, buildStream, emptyFilters, facets } from './search.js'
import { isIdea, isNonEvent, normalizeEvent } from './model.js'
import { mergeCluster } from './dedupe.js'

const ev = (over) => normalizeEvent({ name: 'x', ...over })
const WED = new Date(2026, 7, 19, 15, 0)

describe('isIdea', () => {
  test('a Wanderlist row with no planned date and no deadline is an idea', () => {
    expect(isIdea(ev({ origin: 'wanderlist', saved: true }))).toBe(true)
  })

  test('a date at either end makes it a real plan, not an idea', () => {
    expect(isIdea(ev({ origin: 'wanderlist', plannedDate: '2026-08-21' }))).toBe(false)
    expect(isIdea(ev({ origin: 'wanderlist', dateExpiring: '2026-08-21' }))).toBe(false)
  })

  test('an attended thing is never an idea — it already happened', () => {
    expect(isIdea(ev({ origin: 'wanderlist', attended: true }))).toBe(false)
  })

  test('a Radar row is never an idea, whatever its dates', () => {
    // Ideas are a Wanderlist concept; the skill never writes one into Radar.
    expect(isIdea(ev({ origin: 'radar' }))).toBe(false)
  })
})

describe('isNonEvent', () => {
  test('venue, idea and discovery describe places and notions, not happenings', () => {
    expect(isNonEvent(ev({ category: 'venue' }))).toBe(true)
    expect(isNonEvent(ev({ category: 'discovery' }))).toBe(true)
    expect(isNonEvent(ev({ category: 'idea' }))).toBe(true)
    expect(isNonEvent(ev({ category: 'concert' }))).toBe(false)
  })
})

describe('intake rules', () => {
  test('an attended event never reaches the stream', () => {
    expect(passesIntake(ev({ attended: true }))).toBe(false)
    expect(intakeRejection(ev({ attended: true }))).toBe('attended')
  })

  test('a dismissed event never reaches the stream', () => {
    expect(intakeRejection(ev({ dismissed: true }))).toBe('dismissed')
  })

  test('every rule can be switched off — nothing is permanently unreachable', () => {
    const attended = ev({ attended: true })
    expect(passesIntake(attended, { ...DEFAULT_INTAKE, hideAttended: false })).toBe(true)
  })

  test('all four rules default on', () => {
    expect(DEFAULT_INTAKE).toEqual({
      hideAttended: true, hideIdeas: true, hideNonEvents: true, hideDismissed: true,
    })
  })

  test('buildStream applies intake before anything else', () => {
    const pool = [
      ev({ id: 'ok', name: 'Concert', start: '2026-08-20', category: 'concert' }),
      ev({ id: 'done', name: 'Been there', start: '2026-08-20', attended: true }),
      ev({ id: 'hidden', name: 'Hidden', start: '2026-08-20', dismissed: true }),
      ev({ id: 'place', name: 'A café', start: '2026-08-20', category: 'venue' }),
    ]
    const out = buildStream(pool, { view: 'week', filters: emptyFilters(), now: WED })
    expect(out.days.flatMap((d) => d.events.map((e) => e.id))).toEqual(['ok'])
  })

  test('facets are counted over the post-intake pool, so filters never offer nothing', () => {
    const pool = [
      ev({ name: 'a', category: 'concert', start: '2026-08-20' }),
      ev({ name: 'b', category: 'venue', start: '2026-08-20' }),
    ]
    expect(facets(pool, WED).categories).toEqual([['concert', 1]])
  })
})

describe('merge keeps both identities and the Wanderlist decisions', () => {
  const radar = ev({
    id: 'radar-1', origin: 'radar', name: 'Trio Nocturn', venue: 'Control',
    start: '2026-08-21', confidence: 'confirmed', summary: 'Jazz.',
  })
  const findings = ev({
    id: 'findings-1', origin: 'wanderlist', name: 'Trio Nocturn', venue: 'Control',
    start: '2026-08-21', saved: true, going: true, plannedDate: '2026-08-21',
    plannedTime: '21:00', hasTickets: true, dateExpiring: '2026-08-21',
  })

  test('both row ids survive, because each is written to for a different reason', () => {
    const merged = mergeCluster([radar, findings])
    expect(merged.radarId).toBe('radar-1')
    expect(merged.findingsId).toBe('findings-1')
  })

  test('the Wanderlist decisions come from the Findings row, never invented', () => {
    const merged = mergeCluster([radar, findings])
    expect(merged.going).toBe(true)
    expect(merged.plannedDate).toBe('2026-08-21')
    expect(merged.plannedTime).toBe('21:00')
    expect(merged.hasTickets).toBe(true)
  })

  test('with no Findings row there is no opinion about going', () => {
    const merged = mergeCluster([radar])
    expect(merged.going).toBe(false)
    expect(merged.plannedDate).toBeNull()
    expect(merged.findingsId).toBeNull()
  })

  test('a merge can never resurrect something dismissed', () => {
    const merged = mergeCluster([{ ...radar, dismissed: true }, findings])
    expect(merged.dismissed).toBe(true)
  })

  test('attended on the Findings row wins, so the merged event is filtered out', () => {
    const merged = mergeCluster([radar, { ...findings, attended: true }])
    expect(merged.attended).toBe(true)
    expect(passesIntake(merged)).toBe(false)
  })
})
