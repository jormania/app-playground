import { describe, test, expect } from 'vitest'
import { fold, tokens, titleSimilarity, venueSimilarity, dateOverlap, similarity, isSameEvent, dedupe, mergeCluster, dedupeSources } from './dedupe.js'
import { normalizeEvent } from './model.js'

const ev = (over) => normalizeEvent({ name: 'x', ...over })

describe('fold', () => {
  test('strips Romanian diacritics in both encodings', () => {
    // `ș` U+0219 (comma below) and `ş` U+015F (cedilla) both occur in the wild.
    expect(fold('Șoseaua')).toBe('soseaua')
    expect(fold('Şoseaua')).toBe('soseaua')
    expect(fold('Târgul de Crăciun')).toBe('targul de craciun')
    expect(fold('Piața Unirii')).toBe('piata unirii')
  })

  test('normalises quotes, punctuation and case', () => {
    expect(fold('Expoziția „Lumină difuză"')).toBe('expozitia lumina difuza')
    expect(fold('  A  --  B  ')).toBe('a b')
  })

  test('never throws on empty input', () => {
    expect(fold(null)).toBe('')
    expect(fold(undefined)).toBe('')
  })
})

describe('tokens', () => {
  test('drops Romanian filler that carries no identity', () => {
    expect(tokens('Expoziția de grup la Combinat')).toEqual(['grup', 'combinat'])
  })
})

describe('titleSimilarity', () => {
  test('matches a bare event name inside a longer editorial headline', () => {
    const a = 'Lumină difuză'
    const b = 'Expoziția „Lumină difuză" la Combinatul Fondului Plastic'
    expect(titleSimilarity(a, b)).toBe(1)
  })

  test('scores unrelated titles at zero', () => {
    expect(titleSimilarity('Jazz in the Park', 'Street Delivery')).toBe(0)
  })

  test('is symmetric', () => {
    expect(titleSimilarity('a b c', 'b c d')).toBe(titleSimilarity('b c d', 'a b c'))
  })
})

describe('venueSimilarity', () => {
  test('containment counts — venue names vary in length', () => {
    expect(venueSimilarity('ARCUB', 'ARCUB — Hanul Gabroveni')).toBe(1)
  })

  test('an unknown venue is no evidence, not a disagreement', () => {
    expect(venueSimilarity(null, 'Control')).toBeNull()
    expect(venueSimilarity('Control', '')).toBeNull()
  })
})

describe('dateOverlap', () => {
  test('single-day events overlap only on the same day', () => {
    expect(dateOverlap(ev({ start: '2026-08-21' }), ev({ start: '2026-08-21' }))).toBe(true)
    expect(dateOverlap(ev({ start: '2026-08-21' }), ev({ start: '2026-08-22' }))).toBe(false)
  })

  test('a day inside a long run overlaps it', () => {
    const run = ev({ start: '2026-08-01', end: '2026-11-01' })
    expect(dateOverlap(run, ev({ start: '2026-09-15' }))).toBe(true)
  })

  test('undated is null, not false', () => {
    expect(dateOverlap(ev({ start: null }), ev({ start: '2026-08-21' }))).toBeNull()
  })
})

describe('similarity', () => {
  test('a shared dedupe key short-circuits to a certain match', () => {
    const a = ev({ key: 'cfp:lumina', name: 'Totally different name' })
    const b = ev({ key: 'cfp:lumina', name: 'Something else again' })
    expect(similarity(a, b)).toBe(1)
  })

  test('a different title can never be rescued by venue and date', () => {
    // The critical guard: two genuinely different events at one venue on one night.
    const a = ev({ name: 'Jazz in the Park', venue: 'Control', start: '2026-08-21' })
    const b = ev({ name: 'Street Delivery', venue: 'Control', start: '2026-08-21' })
    expect(similarity(a, b)).toBe(0)
    expect(isSameEvent(a, b)).toBe(false)
  })

  test('same title at different venues is a touring show, not one event', () => {
    const a = ev({ name: 'Lumină difuză', venue: 'Combinatul Fondului Plastic', start: '2026-08-21' })
    const b = ev({ name: 'Lumină difuză', venue: 'Muzeul Național de Artă', start: '2026-08-21' })
    expect(isSameEvent(a, b)).toBe(false)
  })

  test('same title on non-overlapping dates is a repeat run', () => {
    const a = ev({ name: 'Retrospectivă Varda', venue: 'Elvire Popesco', start: '2026-08-21' })
    const b = ev({ name: 'Retrospectivă Varda', venue: 'Elvire Popesco', start: '2026-09-30' })
    expect(isSameEvent(a, b)).toBe(false)
  })

  test('the same event written up two different ways matches', () => {
    const a = ev({ name: 'Lumină difuză', venue: 'Combinatul Fondului Plastic', start: '2026-08-21', end: '2026-11-01' })
    const b = ev({ name: 'Expoziția „Lumina difuza" la Combinatul Fondului Plastic', venue: 'Combinatul Fondului Plastic', start: '2026-09-01' })
    expect(isSameEvent(a, b)).toBe(true)
  })
})

describe('mergeCluster', () => {
  const confirmed = ev({
    id: 'a', name: 'Lumină difuză', venue: 'Combinat', address: 'Str. Băiculești 29',
    start: '2026-08-21T19:00:00+03:00', hasTime: true, summary: 'The good summary.',
    link: 'https://venue.example/event', signals: ['recommended'], confidence: 'confirmed', checked: '2026-08-20',
    sources: [{ name: 'Combinat', url: 'https://venue.example/event', date: '2026-08-20' }],
  })
  const reported = ev({
    id: 'b', name: 'Expoziția Lumină difuză', venue: 'Combinatul Fondului Plastic',
    start: '2026-08-21', hasTime: false, summary: 'A thinner summary.', cost: 0,
    signals: ['free'], confidence: 'reported', checked: '2026-08-18',
    sources: [{ name: 'Curatorial', url: 'https://curatorial.example/x', date: '2026-08-18', kind: 'recommendation' }],
  })

  test('takes each field from the highest-confidence source that has it', () => {
    const merged = mergeCluster([reported, confirmed])
    expect(merged.summary).toBe('The good summary.')
    expect(merged.address).toBe('Str. Băiculești 29')
    expect(merged.link).toBe('https://venue.example/event')
  })

  test('records which source won each field, so a merge stays inspectable', () => {
    const merged = mergeCluster([reported, confirmed])
    expect(merged.fieldOrigins.summary).toBe('Combinat')
    expect(merged.fieldOrigins.address).toBe('Combinat')
  })

  test('keeps the union of sources, never the intersection', () => {
    const merged = mergeCluster([reported, confirmed])
    expect(merged.sources.map((s) => s.name).sort()).toEqual(['Combinat', 'Curatorial'])
  })

  test('keeps the union of signals — a merge must not lose "recommended"', () => {
    const merged = mergeCluster([reported, confirmed])
    expect(merged.signals).toContain('recommended')
    expect(merged.signals).toContain('free')
  })

  test('start and hasTime move together, so no time is invented on a bare date', () => {
    const merged = mergeCluster([reported, confirmed])
    expect(merged.hasTime).toBe(true)
    expect(merged.start).toBe('2026-08-21T19:00:00+03:00')

    const noTime = mergeCluster([reported, ev({ ...confirmed, start: '2026-08-21', hasTime: false })])
    expect(noTime.hasTime).toBe(false)
  })

  test('the merged confidence is the best of the cluster, freshness the newest', () => {
    const merged = mergeCluster([reported, confirmed])
    expect(merged.confidence).toBe('confirmed')
    expect(merged.checked).toBe('2026-08-20')
  })

  test('a free event never keeps a price', () => {
    expect(mergeCluster([reported, confirmed]).cost).toBeNull()
  })

  test('saved-ness survives a merge', () => {
    const merged = mergeCluster([confirmed, ev({ ...reported, saved: true })])
    expect(merged.saved).toBe(true)
  })
})

describe('dedupeSources', () => {
  test('one article linked from two rows is one mention', () => {
    const out = dedupeSources([
      { name: 'B365', url: 'https://b365.ro/x?utm=1', date: '2026-08-01' },
      { name: 'B365', url: 'https://b365.ro/x', date: '2026-08-02' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].date).toBe('2026-08-02') // the newer mention wins
  })

  test('sources without urls are distinguished by name', () => {
    expect(dedupeSources([{ name: 'Buletin' }, { name: 'Curatorial' }])).toHaveLength(2)
  })
})

describe('dedupe (whole pool)', () => {
  test('four mentions of one exhibition collapse to one event with four sources', () => {
    const pool = [
      ev({ id: '1', name: 'Lumină difuză', venue: 'Combinat', start: '2026-08-21', end: '2026-11-01', sources: [{ name: 'B365' }] }),
      ev({ id: '2', name: 'Expoziția Lumina difuza', venue: 'Combinatul Fondului Plastic', start: '2026-09-01', sources: [{ name: 'Curatorial' }] }),
      ev({ id: '3', name: 'Lumina difuza', venue: 'Combinat', start: '2026-08-25', sources: [{ name: 'Facebook' }] }),
      ev({ id: '4', name: 'Lumină difuză — expoziție de grup', venue: 'Combinat', start: '2026-08-21', end: '2026-11-01', sources: [{ name: 'Buletin' }] }),
    ]
    const out = dedupe(pool)
    expect(out).toHaveLength(1)
    expect(out[0].sources.map((s) => s.name).sort()).toEqual(['B365', 'Buletin', 'Curatorial', 'Facebook'])
  })

  test('distinct events are left alone', () => {
    const pool = [
      ev({ id: '1', name: 'Jazz in the Park', venue: 'Control', start: '2026-08-21' }),
      ev({ id: '2', name: 'Street Delivery', venue: 'Control', start: '2026-08-21' }),
      ev({ id: '3', name: 'Retrospectivă Varda', venue: 'Elvire Popesco', start: '2026-08-22' }),
    ]
    expect(dedupe(pool)).toHaveLength(3)
  })

  test('is order-independent — the same pool shuffled yields the same count', () => {
    const pool = [
      ev({ id: '1', name: 'Lumină difuză', venue: 'Combinat', start: '2026-08-21', end: '2026-11-01' }),
      ev({ id: '2', name: 'Lumina difuza', venue: 'Combinat', start: '2026-09-01' }),
      ev({ id: '3', name: 'Trio Nocturn', venue: 'Control', start: '2026-08-21' }),
    ]
    expect(dedupe(pool)).toHaveLength(2)
    expect(dedupe([...pool].reverse())).toHaveLength(2)
  })

  test('an empty pool is fine', () => {
    expect(dedupe([])).toEqual([])
  })
})
