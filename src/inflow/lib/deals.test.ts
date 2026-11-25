import { describe, expect, it } from 'vitest'
import { buildDemo } from '../data/demo'
import { crossover, dealCurve, defaultAlternative, venueCostOf, venueDeal } from './deals'
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

  it('finds where fixed and share cross: 600 lei ÷ (220 × 30%) ≈ 9 people', () => {
    const points = dealCurve(220, fixed, share, 15)
    expect(points[0]).toEqual({ attendees: 0, current: -600, alternative: 0 })
    const x = crossover(points)!
    expect(x).toBeGreaterThan(9)
    expect(x).toBeLessThan(9.2)
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

