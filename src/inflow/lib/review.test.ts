import { describe, expect, it } from 'vitest'
import { buildDemo } from '../data/demo'
import type { IncomeRecord } from '../domain/types'
import { received } from './analytics'
import { movers, reviewSummary, reviewTitle } from './review'

const demo = buildDemo('2026-11-25')
const r0 = demo.records[0]
const rec = (clientId: string, amount: number, date: string): IncomeRecord =>
  ({ ...r0, id: `${clientId}-${date}`, clientId, venueId: null, sourceId: null, category: null, amountRon: amount, amount, currency: 'RON', status: 'received', date, demo: undefined })

describe('movers', () => {
  const data = { clients: [{ ...demo.clients[0], id: 'a', name: 'Ana' }, { ...demo.clients[0], id: 'b', name: 'Bogdan' }, { ...demo.clients[0], id: 'c', name: 'Cora' }], sources: [], venues: [] }
  const before = [rec('a', 1000, '2026-10-02'), rec('b', 3000, '2026-10-03')]
  const cur = [rec('a', 2500, '2026-11-02'), rec('c', 400, '2026-11-03')]
  const m = movers(data, cur, before, ['client'])

  it('ranks by the size of the change, and counts a client who stopped', () => {
    expect(m.map((x) => [x.name, x.change])).toEqual([['Bogdan', -3000], ['Ana', 1500], ['Cora', 400]])
    expect(m[0].current).toBe(0)
  })

  it('caps how many come from one dimension', () => {
    expect(movers(data, cur, before, ['client'], 6, 2)).toHaveLength(2)
  })

  it('reads them in the summary', () => {
    const text = reviewSummary({ data, cur, before, prevLabel: 'the month before', insights: [], periodLabel: 'This month' })
    expect(text).toMatch(/^2,900 lei came in, down 28% on the month before/)
    expect(text).toContain('Biggest rise: Ana (client), +1,500 lei.')
    expect(text).toContain('Biggest drop: Bogdan, −3,000 lei, nothing this time.')
  })
})

describe('review titles', () => {
  it('names the period', () => {
    expect(reviewTitle({ from: '2026-11-01', to: '2026-11-30', label: 'This month' })).toBe('November 2026 in review')
    expect(reviewTitle({ from: '2026-01-01', to: '2026-12-31', label: 'This year' })).toBe('2026 in review')
    expect(reviewTitle({ from: '2026-11-23', to: '2026-11-29', label: 'This week' })).toBe('This week in review')
  })
})

describe('the demo, reviewed', () => {
  it('has movers and a summary with the top client', () => {
    const cur = received(demo.records, { from: '2026-01-01', to: '2026-11-25' })
    const before = received(demo.records, { from: '2025-01-01', to: '2025-11-25' })
    expect(movers(demo, cur, before).length).toBeGreaterThan(2)
    expect(reviewSummary({ data: demo, cur, before, prevLabel: 'last year', insights: [], periodLabel: 'This year' })).toMatch(/brought the most/)
  })
})

describe('a comparison reaching before the first record', () => {
  it('says it is partial instead of quoting a runaway percentage', () => {
    const data = { clients: [{ ...demo.clients[0], id: 'a', name: 'Ana' }], sources: [], venues: [] }
    const text = reviewSummary({ data, cur: [rec('a', 9000, '2026-03-01')], before: [rec('a', 500, '2025-11-10')], prevLabel: 'last year',
      insights: [], periodLabel: 'This year', prevFrom: '2025-01-01', firstRecord: '2025-10-04' })
    expect(text).toContain('Your records start in October 2025, so there is only part of last year to compare with (500 lei).')
    expect(text).not.toMatch(/(up|down) \d+%/)
  })
})

describe('movers keep the biggest drops', () => {
  it('lists a client who stopped even when larger rises fill the list', () => {
    const data = { clients: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'x'].map((id) => ({ ...demo.clients[0], id, name: id.toUpperCase() })), sources: [], venues: [] }
    const before = [rec('x', 3000, '2025-03-01')]
    const cur = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, i) => rec(id, 10_000 + i * 1000, '2026-03-01'))
    const m = movers(data, cur, before, ['client'], 6, 10)
    expect(m).toHaveLength(6)
    expect(m.map((x) => x.name)).toContain('X')
    expect(m.find((x) => x.name === 'X')!.change).toBe(-3000)
  })
})

describe('the demo year keeps its biggest drop', () => {
  it('names the contract that ended among the movers', () => {
    const cur = received(demo.records, { from: '2026-01-01', to: '2026-11-25' })
    const before = received(demo.records, { from: '2025-01-01', to: '2025-11-25' })
    const m = movers(demo, cur, before)
    expect(m.some((x) => x.name === 'Orion Pharma SRL' && x.change < 0)).toBe(true)
  })
})
