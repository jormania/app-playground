import { describe, expect, it } from 'vitest'
import { buildDemo } from '../data/demo'
import type { CostRecord, IncomeRecord, InflowData, Venue } from '../domain/types'
import { breakEvenPeople, keptPerPerson } from './deals'
import { earnings } from './earnings'
import { takeHome } from './insights'

const demo = buildDemo('2026-11-25')
const base = demo.records[0]
const venue: Venue = { ...demo.venues[0], id: 'v1', name: 'Loft', deal: 'fixed', feePerSession: 300, sharePct: 0, monthlyFee: 0 }
const rec = (id: string, clientId: string, category: IncomeRecord['category'], date: string, amount: number, venueId: string | null = 'v1'): IncomeRecord =>
  ({ ...base, id, clientId, category, date, amount, amountRon: amount, currency: 'RON', fxRate: 1, venueId, status: 'received', demo: undefined })
const cost = (date: string, amount: number): CostRecord =>
  ({ ...demo.costs[0], id: `c${date}`, date, amount, amountRon: amount, currency: 'RON', fxRate: 1, status: 'paid', group: 'direct', category: 'materials', venueId: 'v1', clientId: null, activity: null, demo: undefined })

const data: InflowData = {
  clients: [{ ...demo.clients[0], id: 'ana', name: 'Ana' }, { ...demo.clients[0], id: 'bo', name: 'Bo' }],
  sources: [], venues: [venue],
  records: [
    rec('1', 'ana', 'workshop', '2026-03-02', 1000),
    rec('2', 'ana', 'workshop', '2026-03-09', 500),
    rec('3', 'bo', 'workshop', '2026-03-09', 700), // same day, same venue as #2: shares that day's direct cost
    rec('4', 'bo', 'coaching_1on1', '2026-03-20', 400, null),
    rec('5', 'bo', 'reimbursement', '2026-03-20', 90, null), // not a session
    rec('6', 'ana', 'workshop', '2025-12-01', 5000), // outside the period
    { ...rec('7', 'ana', 'workshop', '2026-03-25', 900), status: 'expected' }, // not received
  ],
  costs: [cost('2026-03-09', 100)],
}
const range = { from: '2026-01-01', to: '2026-12-31' }
const opts = { deals: true, costs: true }

describe('earnings by client', () => {
  const e = earnings(data, range, 'client', opts)
  it('takes off each session\'s venue fee and its share of same-day direct costs', () => {
    const ana = e.rows.find((r) => r.id === 'ana')!
    // 1,000 − 300; 500 − 300 − 50 (half of the 100 lei cost on the 9th)
    expect(ana).toMatchObject({ income: 1500, venueFees: 600, directCosts: 50, kept: 850, sessions: 2, keptPerSession: 425, lowest: 150, highest: 700 })
    const bo = e.rows.find((r) => r.id === 'bo')!
    // 700 − 300 − 50; 400 with no venue
    expect(bo).toMatchObject({ income: 1100, venueFees: 300, directCosts: 50, kept: 750, sessions: 2 })
  })
  it('ranks by what was kept, not by income', () => {
    expect(e.rows.map((r) => r.id)).toEqual(['ana', 'bo'])
  })
  it('keeps to the period, received payments and real sessions', () => {
    expect(e.totals).toEqual({ income: 2600, costs: 1000, kept: 1600, sessions: 4 })
  })
  it('agrees with the per-payment take-home it is built on', () => {
    const t = takeHome(data, opts)
    expect(['1', '2', '3', '4'].reduce((s, id) => s + t.get(id)!, 0)).toBe(e.totals.kept)
  })
  it('breaks each result down by venue', () => {
    const bo = e.rows.find((r) => r.id === 'bo')!
    // Most kept first.
    expect(bo.venues.map((v) => [v.name, v.sessions, v.kept])).toEqual([['No venue', 1, 400], ['Loft', 1, 350]])
  })
})

describe('earnings by type of work', () => {
  it('groups the same sessions by activity', () => {
    const e = earnings(data, range, 'activity', opts)
    expect(e.rows.map((r) => [r.id, r.sessions, r.kept])).toEqual([['workshop', 3, 1200], ['coaching_1on1', 1, 400]])
  })
  it('with deals and costs off, kept is income', () => {
    const e = earnings(data, range, 'activity', { deals: false, costs: false })
    expect(e.totals).toEqual({ income: 2600, costs: 0, kept: 2600, sessions: 4 })
  })
})

describe('break-even', () => {
  const fixed = { deal: 'fixed' as const, feePerSession: 600, sharePct: 0, monthlyFee: 0 }
  it('counts the people a fixed fee needs, rounded up', () => {
    expect(breakEvenPeople(fixed, 220)).toBe(3)
    expect(breakEvenPeople(fixed, 200)).toBe(3)
    expect(breakEvenPeople(fixed, 100)).toBe(6)
    expect(breakEvenPeople(fixed, 1000)).toBe(1)
  })
  it('allows for a share on top of a fee', () => {
    expect(breakEvenPeople({ deal: 'hybrid', feePerSession: 200, sharePct: 0.1, monthlyFee: 0 }, 100)).toBe(3)
  })
  it('has none under a revenue share, and none without a price', () => {
    expect(breakEvenPeople({ deal: 'share', feePerSession: 0, sharePct: 0.3, monthlyFee: 0 }, 200)).toBeNull()
    expect(breakEvenPeople(fixed, 0)).toBeNull()
    expect(keptPerPerson({ deal: 'share', feePerSession: 0, sharePct: 0.3, monthlyFee: 0 }, 200)).toBe(140)
  })
})

describe('reimbursements take no share of a day\'s costs', () => {
  it('puts the whole same-day cost on the session, not on the money paid back', () => {
    const d: InflowData = { ...data, records: [rec('s', 'ana', 'workshop', '2026-05-05', 1000), { ...rec('r', 'ana', 'reimbursement', '2026-05-05', 200) }], costs: [cost('2026-05-05', 100)] }
    const e = earnings(d, range, 'client', opts)
    expect(e.rows[0]).toMatchObject({ income: 1000, directCosts: 100, kept: 600, sessions: 1 })
  })
})
