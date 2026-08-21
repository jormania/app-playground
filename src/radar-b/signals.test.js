import { describe, test, expect } from 'vitest'
import { signalsFor, cardBadges, freshness, sortForStream, recommenders } from './signals.js'
import { normalizeEvent } from './model.js'

const ev = (over) => normalizeEvent({ name: 'x', ...over })
const WED = new Date(2026, 7, 19, 15, 0)

describe('signalsFor', () => {
  test('derives long-run from the dates, not just from a tag', () => {
    expect(signalsFor(ev({ start: '2026-08-01', end: '2026-11-01' }))).toContain('long-run')
  })

  test('a zero cost is free even if nobody tagged it', () => {
    expect(signalsFor(ev({ cost: 0 }))).toContain('free')
  })

  test('a ticket link implies ticketed', () => {
    expect(signalsFor(ev({ tickets: 'https://iabilet.ro/x' }))).toContain('ticketed')
  })

  test('an already-saved event drops "recommended" — the Wanderlist chip says more', () => {
    expect(signalsFor(ev({ signals: ['recommended'], saved: true }))).not.toContain('recommended')
  })

  test('returns signals in display-priority order', () => {
    const out = signalsFor(ev({ signals: ['ticketed', 'free', 'recommended'] }))
    expect(out).toEqual(['recommended', 'free', 'ticketed'])
  })
})

describe('cardBadges', () => {
  test('shows at most two, the highest-priority ones', () => {
    const out = cardBadges(ev({ signals: ['outdoor', 'ticketed', 'free', 'recommended'] }))
    expect(out).toEqual(['recommended', 'free'])
  })

  test('no badge at all is a normal card, not an error', () => {
    expect(cardBadges(ev({}))).toEqual([])
  })
})

describe('freshness', () => {
  test('three states — never two', () => {
    expect(freshness(ev({ checked: '2026-08-19' }), WED).state).toBe('fresh')
    expect(freshness(ev({ checked: '2026-07-20' }), WED).state).toBe('stale')
    expect(freshness(ev({ checked: null }), WED).state).toBe('unknown')
  })
})

describe('rank / sortForStream', () => {
  test('a recommended event floats to the top of its day', () => {
    const plain = ev({ id: 'a', name: 'Plain', start: '2026-08-19T18:00:00', hasTime: true })
    const rec = ev({ id: 'b', name: 'Rec', start: '2026-08-19T22:00:00', hasTime: true, signals: ['recommended'] })
    expect(sortForStream([plain, rec], WED).map((e) => e.id)).toEqual(['b', 'a'])
  })

  test('within the same tier, earlier in the evening comes first', () => {
    const late = ev({ id: 'late', start: '2026-08-19T22:00:00', hasTime: true })
    const early = ev({ id: 'early', start: '2026-08-19T18:00:00', hasTime: true })
    expect(sortForStream([late, early], WED).map((e) => e.id)).toEqual(['early', 'late'])
  })

  test('an untimed event sits after timed ones on the same day', () => {
    const timed = ev({ id: 'timed', start: '2026-08-19T22:00:00', hasTime: true })
    const untimed = ev({ id: 'untimed', start: '2026-08-19', hasTime: false })
    expect(sortForStream([untimed, timed], WED).map((e) => e.id)).toEqual(['timed', 'untimed'])
  })

  test('uncertain and stale events sink', () => {
    const solid = ev({ id: 'solid', start: '2026-08-19T22:00:00', hasTime: true, confidence: 'confirmed' })
    const vague = ev({ id: 'vague', start: '2026-08-19T18:00:00', hasTime: true, confidence: 'uncertain' })
    expect(sortForStream([vague, solid], WED).map((e) => e.id)).toEqual(['solid', 'vague'])
  })
})

describe('the mainstream signal ("De știut")', () => {
  test('sinks within its own day rather than dropping out of the stream', () => {
    const mainstream = ev({ id: 'a', name: 'Mainstream', start: '2026-08-19T20:00:00', hasTime: true, signals: ['mainstream'] })
    const ordinary = ev({ id: 'b', name: 'Ordinary', start: '2026-08-19T20:00:00', hasTime: true })
    expect(sortForStream([mainstream, ordinary], WED).map((e) => e.id)).toEqual(['b', 'a'])
  })

  test('is a quieter demotion than uncertain or stale', () => {
    const mainstream = ev({ id: 'a', start: '2026-08-19T20:00:00', hasTime: true, signals: ['mainstream'] })
    const uncertain = ev({ id: 'b', start: '2026-08-19T20:00:00', hasTime: true, confidence: 'uncertain' })
    expect(sortForStream([uncertain, mainstream], WED).map((e) => e.id)).toEqual(['a', 'b'])
  })

  test('renders with the default badge styling, not a special treatment', () => {
    expect(cardBadges(ev({ signals: ['mainstream'] }))).toEqual(['mainstream'])
  })
})

describe('recommenders', () => {
  test('names only the sources that actually recommended, not every mention', () => {
    const e = ev({
      sources: [
        { name: 'B365', kind: 'editorial' },
        { name: 'Curatorial', kind: 'recommendation' },
      ],
    })
    expect(recommenders(e)).toEqual(['Curatorial'])
  })
})
