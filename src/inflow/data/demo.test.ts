import { describe, expect, it } from 'vitest'
import { breakdown, concentration, largeRecordIds, outstanding, received, summarise } from '../lib/analytics'
import { resolvePeriod } from '../lib/period'
import { buildDemo, DEMO_SETTINGS_TAX } from './demo'
import { estimateYear, taxableGross } from '../tax/estimate'

const today = '2026-11-25'
const demo = buildDemo(today)

describe('demo data', () => {
  it('is deterministic for a date', () => {
    expect(buildDemo(today)).toEqual(demo)
  })

  it('covers what the brief asks the demo to show', () => {
    const rs = demo.records
    expect(new Set(rs.map((r) => r.currency))).toEqual(new Set(['RON', 'EUR', 'USD', 'GBP']))
    expect(rs.some((r) => r.taxability === 'non_taxable')).toBe(true)
    expect(rs.some((r) => r.taxability === 'review')).toBe(true)
    expect(rs.some((r) => r.taxHandling === 'withheld' && r.taxWithheld > 0)).toBe(true)
    expect(rs.some((r) => r.taxHandling === 'self_declared')).toBe(true)
    expect(rs.some((r) => r.vat === 'reverse_charge')).toBe(true)
    expect(rs.filter((r) => r.status === 'expected')).toHaveLength(3)
    expect(new Set(rs.map((r) => r.date.slice(0, 7))).size).toBeGreaterThanOrEqual(14)
    expect(rs.length).toBeGreaterThan(150)
    // Several cities, not just Bucharest.
    expect(new Set(demo.venues.map((v) => v.location.split(', ').pop())).size).toBeGreaterThanOrEqual(4)
    expect(new Set(rs.map((r) => r.venueId)).size).toBe(demo.venues.length)
    expect(new Set(rs.map((r) => r.clientId)).size).toBe(demo.clients.length)
    expect(rs.every((r) => r.demo)).toBe(true)
  })

  it('is seasonal: August dips below the months around it', () => {
    const byMonth = new Map<string, number>()
    for (const r of demo.records) if (r.status === 'received' && r.date.startsWith('2026')) byMonth.set(r.date.slice(5, 7), (byMonth.get(r.date.slice(5, 7)) ?? 0) + r.amountRon)
    const aug = byMonth.get('08')!
    expect(aug).toBeLessThan(byMonth.get('07')!)
    expect(aug).toBeLessThan(byMonth.get('09')!)
  })

  it('does not flag a big monthly retainer as unusual', () => {
    const large = largeRecordIds(demo.records, 4)
    expect(demo.records.filter((r) => large.has(r.id) && r.clientId === 'demo_c_nordwind')).toEqual([])
  })

  it('never puts a received payment in the future', () => {
    expect(demo.records.filter((r) => r.status === 'received' && r.date > today)).toEqual([])
  })

  it('links every record to entities that exist', () => {
    const ids = new Set([...demo.clients, ...demo.sources, ...demo.venues].map((x) => x.id))
    for (const r of demo.records) for (const id of [r.clientId, r.sourceId, r.venueId]) expect(ids.has(id!)).toBe(true)
  })

  it('stores a reserve on received taxable records only, from the 2026 ruleset this year', () => {
    for (const r of demo.records) {
      if (r.taxability === 'taxable' && r.status === 'received') expect(r.taxReserve).toBeGreaterThanOrEqual(0)
      else expect(r.taxReserve).toBeNull()
    }
    expect(demo.records.filter((r) => r.date.startsWith('2026')).every((r) => r.taxRules === 'RO-2026')).toBe(true)
  })
})

describe('dashboard figures come from the records', () => {
  const month = resolvePeriod({ preset: 'month' }, today)
  const rs = received(demo.records, month)
  const s = summarise(rs)

  it('adds up', () => {
    expect(s.total).toBeCloseTo(rs.reduce((a, r) => a + r.amountRon, 0), 2)
    expect(s.taxable + s.nonTaxable + s.review).toBeCloseTo(s.total, 2)
    expect(s.net).toBeCloseTo(s.total - s.reserve - s.taxWithheld, 2)
    expect(rs.every((r) => r.status === 'received')).toBe(true)
  })

  it('breaks down by client with shares summing to one', () => {
    const rows = breakdown(demo, rs, [], 'client')
    expect(rows.reduce((a, r) => a + r.share, 0)).toBeCloseTo(1, 6)
    expect(rows[0].total).toBeGreaterThanOrEqual(rows[rows.length - 1].total)
    expect(concentration(rows)?.name).toBe(rows[0].name)
  })

  it('flags the retreat as unusually large and lists outstanding payments, the overdue one first', () => {
    const large = largeRecordIds(demo.records, 4)
    expect(demo.records.filter((r) => large.has(r.id)).map((r) => r.description).join()).toMatch(/retreat/i)
    const o = outstanding(demo.records, today)
    expect(o.count).toBe(3)
    expect(o.overdue).toBe(1)
  })

  it('produces a plausible annual estimate (between 10% and 40% of taxable income)', () => {
    const gross = taxableGross(demo.records, 2026)
    const e = estimateYear(DEMO_SETTINGS_TAX, 2026, gross)
    expect(e.total / gross).toBeGreaterThan(0.1)
    expect(e.total / gross).toBeLessThan(0.4)
  })
})
