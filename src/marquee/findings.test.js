import { describe, it, expect } from 'vitest'
import {
  fold,
  placeMatches,
  buildFindingsIndex,
  savedShowing,
  savedForProduction,
  annotateSaved,
  EMPTY_INDEX,
} from './findings.js'
import { toProductions } from './programme.js'

const finding = (over = {}) => ({
  id: 'f1',
  name: 'Marile speranțe',
  place: 'Teatrul Excelsior, Str. Academiei 28, București',
  plannedDate: '2026-09-05',
  dateExpiring: '2026-09-05',
  attended: false,
  going: false,
  ...over,
})

const showing = (over = {}) => ({
  key: 'k',
  venue: 'Teatrul Excelsior',
  title: 'Marile speranțe',
  date: '2026-09-05',
  time: '19:00',
  ticketState: 'open',
  hall: null,
  link: null,
  image: null,
  price: null,
  ...over,
})

describe('fold', () => {
  it('makes diacritics, case and punctuation irrelevant', () => {
    expect(fold('Marile speranțe')).toBe(fold('MARILE SPERANTE'))
    expect(fold('Ana Coman • Hidden Gems')).toBe('ana coman hidden gems')
    expect(fold('Cinema Muzeul Țăranului')).toBe('cinema muzeul taranului')
  })
})

describe('placeMatches', () => {
  it('finds the venue inside a Findings Place, which also carries street and city', () => {
    expect(placeMatches('Expirat Halele Carol, Strada Istrati 1, București', 'Expirat Halele Carol')).toBe(true)
  })

  it('is one-directional — a Place of just the city matches nothing', () => {
    // The failure this prevents: every venue in Bucharest matching a row whose
    // Place is "București", and the whole programme showing as already saved.
    expect(placeMatches('București', 'Teatrul Excelsior')).toBe(false)
  })

  it('keeps different venues apart', () => {
    expect(placeMatches('Teatrul Excelsior, București', 'Club Control')).toBe(false)
  })

  it('does not match on empty values', () => {
    expect(placeMatches('', 'Teatrul Excelsior')).toBe(false)
    expect(placeMatches('Teatrul Excelsior', '')).toBe(false)
  })
})

describe('savedShowing', () => {
  const index = buildFindingsIndex([finding()])

  it('matches the same night, however the title is accented', () => {
    expect(savedShowing(index, showing())?.id).toBe('f1')
    expect(savedShowing(index, showing({ title: 'MARILE SPERANTE' }))?.id).toBe('f1')
  })

  it('does not match another date of the same production', () => {
    expect(savedShowing(index, showing({ date: '2026-09-06' }))).toBeNull()
  })

  it('does not match the same title at a different venue', () => {
    expect(savedShowing(index, showing({ venue: 'Club Control' }))).toBeNull()
  })

  it('falls back to Date Expiring for a row with no Planned Date', () => {
    const noPlan = buildFindingsIndex([finding({ plannedDate: null })])
    expect(savedShowing(noPlan, showing())?.id).toBe('f1')
  })

  it('answers safely for an empty index or a dateless showing', () => {
    expect(savedShowing(EMPTY_INDEX, showing())).toBeNull()
    expect(savedShowing(index, showing({ date: null }))).toBeNull()
  })
})

describe('savedForProduction', () => {
  it('matches any date of the run, and a dated-differently row too', () => {
    const index = buildFindingsIndex([finding({ plannedDate: '2026-12-01', dateExpiring: null })])
    const production = toProductions([showing()])[0]
    expect(savedForProduction(index, production)).toHaveLength(1)
  })

  it('ignores a row with no name', () => {
    const index = buildFindingsIndex([finding({ name: '' })])
    expect(index.byProduction.size).toBe(0)
  })
})

describe('annotateSaved', () => {
  const run = toProductions([
    showing({ key: 'a', date: '2026-09-05' }),
    showing({ key: 'b', date: '2026-09-06' }),
    showing({ key: 'c', date: '2026-09-07' }),
  ])

  it('counts which dates of a run are saved, rather than flagging the whole run', () => {
    // The overstatement this replaces: keeping one night of a three-week run and
    // having the card claim the entire production was in Wanderlist.
    const [production] = annotateSaved(run, buildFindingsIndex([finding()]))
    expect(production.saved).toBe(true)
    expect(production.savedAll).toBe(false)
    expect([...production.savedDates]).toEqual(['2026-09-05'])
  })

  it('knows when the whole run is saved', () => {
    const index = buildFindingsIndex([
      finding({ id: 'a', plannedDate: '2026-09-05' }),
      finding({ id: 'b', plannedDate: '2026-09-06' }),
      finding({ id: 'c', plannedDate: '2026-09-07' }),
    ])
    const [production] = annotateSaved(run, index)
    expect(production.savedAll).toBe(true)
    expect(production.savedDates.size).toBe(3)
  })

  it('leaves everything unsaved against an empty index', () => {
    const [production] = annotateSaved(run, EMPTY_INDEX)
    expect(production.saved).toBe(false)
    expect(production.savedDates.size).toBe(0)
  })

  it('preserves the production it was given', () => {
    const [production] = annotateSaved(run, EMPTY_INDEX)
    expect(production.showings).toHaveLength(3)
    expect(production.title).toBe('Marile speranțe')
  })
})
