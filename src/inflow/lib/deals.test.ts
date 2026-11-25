import { describe, expect, it } from 'vitest'
import { buildDemo } from '../data/demo'
import type { IncomeRecord, Venue } from '../domain/types'
import { dealTotals, defaultAlternative, feeCoveredAt, sameDayRepeats, scenario, venueCostOf, venueDeal, venueDeals } from './deals'
import { heatMap, insights, takeHome } from './insights'

const today = '2026-11-25'
const demo = buildDemo(today)
const year = { from: '2025-10-01', to: '2026-11-30' }
const venue = (id: string) => demo.venues.find((v) => v.id === `demo_v_${id}`)!

const fixed = { deal: 'fixed' as const, feePerSession: 600, sharePct: 0, monthlyFee: 0 }
const share = { deal: 'share' as const, feePerSession: 0, sharePct: 0.3, monthlyFee: 0 }

describe('venue cost under each deal', () => {
  it('charges a fixed fee whoever comes, and a share in proportion', () => {
    expect(venueCostOf(0, fixed)).toBe(600)
    expect(venueCostOf(2000, fixed)).toBe(600)
    expect(venueCostOf(0, share)).toBe(0)
    expect(venueCostOf(2000, share)).toBe(600)
    expect(venueCostOf(2000, { deal: 'hybrid', feePerSession: 200, sharePct: 0.1, monthlyFee: 0 })).toBe(400)
    expect(venueCostOf(2000, { deal: 'monthly', feePerSession: 0, sharePct: 0, monthlyFee: 900 }, 3)).toBe(300)
    expect(venueCostOf(2000, { deal: 'none', feePerSession: 0, sharePct: 0, monthlyFee: 0 })).toBe(0)
  })

})

describe('the demo loft (fixed 600 lei, 220 lei a seat)', () => {
  const d = venueDeal(venue('loft'), demo.records, year)
  it('needs 3 people to cover the room, and has evenings that lost money', () => {
    expect(d.breakEvenAttendees).toBe(3)
    expect(d.losing.length).toBeGreaterThan(0)
    expect(d.losing.every((s) => (s.attendees ?? 0) < 3)).toBe(true)
    expect(d.lost).toBeGreaterThan(0)
  })
  it('offers a share deal at the equivalent rate as the alternative', () => {
    const alt = defaultAlternative(d)
    expect(alt.deal).toBe('share')
    expect(alt.sharePct).toBeGreaterThan(0)
  })
})

describe('the demo coworking (30% share)', () => {
  const d = venueDeal(venue('cowork'), demo.records, year)
  it('never loses a session, and costs about 30%', () => {
    expect(d.losing).toEqual([])
    expect(d.effectiveShare).toBeCloseTo(0.3, 2)
    expect(defaultAlternative(d).deal).toBe('fixed')
  })
})

describe('insights on the demo', () => {
  const list = insights(demo, year, today, { deals: true, costs: true, expected: true })
  const ids = list.map((i) => i.id)
  it('names the loft losses, the overdue money and the one-off clients', () => {
    expect(ids).toContain('losing-demo_v_loft')
    expect(ids).toContain('overdue')
    expect(ids).toContain('retention')
    expect(ids).toContain('best-activity')
  })
  it('leaves out what is switched off', () => {
    const lean = insights(demo, year, today, { deals: false, costs: false, expected: false }).map((i) => i.id)
    expect(lean.some((id) => id.startsWith('losing-') || id.startsWith('share-') || id.startsWith('thin-'))).toBe(false)
    expect(lean).not.toContain('overdue')
  })
  it('orders by what is at stake', () => {
    for (let i = 1; i < list.length; i++) expect(list[i - 1].weight).toBeGreaterThanOrEqual(list[i].weight)
  })
})

describe('take-home and the heat map', () => {
  it('takes the venue deal off each payment, never a room twice', () => {
    const t = takeHome(demo, { deals: true, costs: true })
    const evening = demo.records.find((r) => r.venueId === 'demo_v_loft' && r.status === 'received')!
    // 600 rent (deal) + 60 materials (linked cost); the recorded room hire is skipped.
    expect(t.get(evening.id)).toBe(evening.amountRon - 660)
  })
  it('builds activity × venue cells from the records', () => {
    const t = takeHome(demo, { deals: true, costs: true })
    const h = heatMap(demo, year, 'activity', 'venue', 'takePerSession', t, 20, 20)
    expect(h.rows.length).toBeGreaterThan(3)
    expect(h.cols.length).toBeGreaterThan(3)
    expect(h.min).toBeLessThan(h.max)
    const workshop = h.rows.findIndex((r) => r.id === 'workshop')
    const loft = h.cols.findIndex((c) => c.id === 'demo_v_loft')
    expect(h.cells[workshop][loft]?.count).toBeGreaterThan(0)
  })
  it('can run by month', () => {
    const h = heatMap(demo, year, 'client', 'month', 'income', new Map())
    expect(h.cols.length).toBe(12)
  })
})


/** Three sessions at one venue: 1,000, 400 and 2,000 lei; 5, 2 and 10 people. */
const room = (terms: Partial<Venue>): Venue => ({ ...venue('loft'), id: 'v_room', ...terms })
const session = (id: string, date: string, amountRon: number, attendees: number): IncomeRecord =>
  ({ ...demo.records[0], id, date, amount: amountRon, amountRon, currency: 'RON', fxRate: 1, venueId: 'v_room', status: 'received', category: 'workshop', attendees, demo: undefined })
const three = [session('a', '2026-03-02', 1000, 5), session('b', '2026-03-09', 400, 2), session('c', '2026-03-16', 2000, 10)]
const all = { from: '2026-01-01', to: '2026-12-31' }

describe('a fixed-fee venue (500 lei a session)', () => {
  const d = venueDeal(room({ deal: 'fixed', feePerSession: 500, sharePct: 0 }), three, all)
  it('pays the fee on every session and keeps the rest', () => {
    expect(d.sessions).toHaveLength(3)
    expect(d.revenue).toBe(3400)
    expect(d.venueCost).toBe(1500)
    expect(d.takeHome).toBe(1900)
    expect(d.takePerSession).toBeCloseTo(633.33, 2)
    expect(d.losing.map((x) => x.id)).toEqual(['b'])
  })
  it('is covered once a session brings in the fee: 500 lei, about 3 people at 200 lei a head', () => {
    expect(feeCoveredAt(d)).toEqual({ revenue: 500, people: 3 })
  })
  it('what if it took 25% instead: same sessions, 850 lei to the venue', () => {
    const s = scenario(d, { deal: 'share', feePerSession: 0, sharePct: 0.25, monthlyFee: 0 })
    expect(s).toEqual({ current: 1900, hypothetical: 2550, difference: 650, differencePct: 650 / 1900 })
  })
  it('what if the fee were 700: 600 lei less', () => {
    const s = scenario(d, { deal: 'fixed', feePerSession: 700, sharePct: 0, monthlyFee: 0 })
    expect(s.hypothetical).toBe(1300)
    expect(s.difference).toBe(-600)
    expect(s.differencePct).toBeCloseTo(-600 / 1900)
  })
})

describe('a revenue-share venue (30%)', () => {
  const v = room({ deal: 'share', feePerSession: 0, sharePct: 0.3 })
  const d = venueDeal(v, three, all)
  it('pays the venue its share of each session', () => {
    expect(d.venueCost).toBe(1020)
    expect(d.takeHome).toBe(2380)
    expect(d.losing).toEqual([])
    expect(feeCoveredAt(d)).toBeNull()
  })
  it('what if it were 20%, or a 300 lei fee', () => {
    expect(scenario(d, { deal: 'share', feePerSession: 0, sharePct: 0.2, monthlyFee: 0 })).toMatchObject({ hypothetical: 2720, difference: 340 })
    expect(scenario(d, { deal: 'fixed', feePerSession: 300, sharePct: 0, monthlyFee: 0 })).toMatchObject({ hypothetical: 2500, difference: 120 })
  })
  it('the same terms give no difference, and nothing is changed by asking', () => {
    const before = JSON.stringify([v, three])
    expect(scenario(d, v)).toMatchObject({ difference: 0, differencePct: 0 })
    expect(JSON.stringify([v, three])).toBe(before)
  })
  it('has no percentage when nothing was kept', () => {
    const none = venueDeal(room({ deal: 'fixed', feePerSession: 5000, sharePct: 0 }), three, all)
    expect(scenario(none, v).differencePct).toBeNull()
  })
})

describe('totals and data questions', () => {
  it('adds up revenue, venue costs and what was kept across venues', () => {
    const a = venueDeal(room({ deal: 'fixed', feePerSession: 500 }), three, all)
    const b = venueDeal(room({ deal: 'share', sharePct: 0.3 }), three, all)
    expect(dealTotals([a, b])).toEqual({ sessions: 6, revenue: 6800, venueCost: 2520, retained: 4280 })
  })
  it('counts payments that share a day at one venue', () => {
    const d = venueDeal(room({ deal: 'fixed', feePerSession: 500 }), [...three, session('d', '2026-03-16', 300, 2)], all)
    expect(sameDayRepeats(d)).toBe(1)
  })
  it('lists the demo venues that have a deal', () => {
    expect(venueDeals(demo.venues, demo.records, year).filter((d) => d.venue.deal !== 'none').length).toBeGreaterThan(2)
  })
})
