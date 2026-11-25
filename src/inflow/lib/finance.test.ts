import { describe, expect, it } from 'vitest'
import type { CostRecord, IncomeRecord } from '../domain/types'
import { buildDemo } from '../data/demo'
import { balanceAt, breakEven, buildCashFlow, buildPnl, deductibleCosts, monthColumns } from './finance'

const inc = (p: Partial<IncomeRecord>): IncomeRecord => ({
  id: Math.random().toString(36), description: '', amount: 0, currency: 'RON', fxRate: 1, amountRon: 0, date: '2026-03-10',
  status: 'received', clientId: null, sourceId: null, venueId: null, category: null, recurring: false, notes: '', attendees: null, sessions: 1, hours: null,
  taxability: 'taxable', taxHandling: 'self_declared', vat: 'exempt', classification: 'confirmed', taxReserve: null,
  reserveSource: null, taxWithheld: 0, taxRules: 'RO-2026', ...p,
})
const cost = (p: Partial<CostRecord>): CostRecord => ({
  id: Math.random().toString(36), description: '', amount: 0, currency: 'RON', fxRate: 1, amountRon: 0, date: '2026-03-10',
  status: 'paid', group: 'operating', category: 'rent', venueId: null, clientId: null, activity: null, recurring: false,
  deductible: true, notes: '', ...p,
})

describe('the P&L follows the note: revenue − COGS − SG&A − D&A − interest − tax', () => {
  // The numbers from the handwritten P&L, as one month.
  const records = [inc({ amountRon: 1_000_000 })]
  const costs = [
    cost({ group: 'direct', category: 'facilitator', amountRon: 600_000 }),
    cost({ group: 'operating', category: 'rent', amountRon: 200_000 }),
    cost({ group: 'depreciation', category: 'depreciation', amountRon: 30_000 }),
    cost({ group: 'interest', category: 'loan_interest', amountRon: 40_000 }),
    cost({ group: 'tax', category: 'income_tax', amountRon: 13_000 }),
    cost({ group: 'financing', category: 'owner_drawings', amountRon: 50_000 }),
    cost({ group: 'direct', category: 'materials', amountRon: 999, status: 'due' }),
  ]
  const p = buildPnl(records, costs, monthColumns({ from: '2026-03-01', to: '2026-03-31' }))
  const v = (k: string) => p.lines.find((l) => l.key === k)!.total
  it('computes every subtotal', () => {
    expect(v('revenue')).toBe(1_000_000)
    expect(v('gross')).toBe(400_000)
    expect(v('ebitda')).toBe(200_000)
    expect(v('ebit')).toBe(170_000)
    expect(v('ebt')).toBe(130_000)
    expect(v('net')).toBe(117_000)
  })
  it('keeps drawings and unpaid costs out', () => {
    expect(v('direct')).toBe(600_000)
  })
  it('itemises cost categories under their group', () => {
    expect(p.lines.find((l) => l.key === 'direct:facilitator')?.total).toBe(600_000)
  })
})

describe('cash flow', () => {
  const records = [inc({ amountRon: 5_000, date: '2026-01-15' }), inc({ amountRon: 3_000, date: '2026-02-15' })]
  const costs = [
    cost({ amountRon: 1_000, date: '2026-01-20' }),
    cost({ amountRon: 500, date: '2026-02-01', group: 'depreciation', category: 'depreciation' }),
    cost({ amountRon: 2_000, date: '2026-02-10', group: 'investment', category: 'equipment' }),
  ]
  it('rolls the balance forward and never counts depreciation as cash', () => {
    const cf = buildCashFlow(records, costs, monthColumns({ from: '2026-01-01', to: '2026-02-28' }), 10_000, '2026-01-01')
    expect(cf.closing).toEqual([14_000, 15_000])
    expect(cf.rows.find((r) => r.key === 'inv')!.values).toEqual([0, 2_000])
  })
  it('works backwards from an opening balance dated later', () => {
    expect(balanceAt('2026-01-01', records, costs, 15_000, '2026-03-01')).toBe(10_000)
  })
  it('is relative without an opening balance', () => {
    const cf = buildCashFlow(records, costs, monthColumns({ from: '2026-01-01', to: '2026-01-31' }), 0, '')
    expect(cf.relative).toBe(true)
    expect(cf.closing).toEqual([4_000])
  })
})

describe('margins and break-even on the demo', () => {
  const today = '2026-11-25'
  const demo = buildDemo(today)
  it('takes a retreat\'s costs off it even when they were paid days before (materials, flights, co-facilitator)', async () => {
    const { earnings } = await import('./earnings')
    const e = earnings(demo, { from: '2026-01-01', to: '2026-12-31' }, 'activity', { deals: true, costs: true })
    const retreat = e.rows.find((r) => r.id === 'retreat')!
    // Co-facilitators (same day), materials (three days before) and flights (nine days before) all count.
    const linked = demo.costs.filter((c) => c.activity === 'retreat' && c.status === 'paid' && c.date >= '2026-01-01').reduce((a, c) => a + c.amountRon, 0)
    expect(retreat.directCosts).toBeCloseTo(linked, 0)
    expect(retreat.kept).toBeLessThan(retreat.income)
  })
  it('finds a break-even revenue from the last three months', () => {
    const be = breakEven(demo.records, demo.costs, today)!
    expect(be.fixedPerMonth).toBeGreaterThan(500)
    expect(be.revenueNeeded).toBeGreaterThan(be.fixedPerMonth)
  })
  it('counts deductible costs only, never drawings, equipment or tax', () => {
    const d = deductibleCosts(demo.costs, 2026)
    const all = demo.costs.filter((c) => c.status === 'paid' && c.date.startsWith('2026')).reduce((s, c) => s + c.amountRon, 0)
    expect(d).toBeGreaterThan(0)
    expect(d).toBeLessThan(all)
  })
})

describe('monthColumns', () => {
  it('clips to the range and labels across years', () => {
    const cols = monthColumns({ from: '2025-12-15', to: '2026-02-10' })
    expect(cols.map((c) => [c.from, c.to, c.label])).toEqual([
      ['2025-12-15', '2025-12-31', '15–31 Dec 25'], ['2026-01-01', '2026-01-31', 'Jan 26'], ['2026-02-01', '2026-02-10', '1–10 Feb 26'],
    ])
  })
  it('names the days when a column is only part of a month, so a week never reads as the month', () => {
    expect(monthColumns({ from: '2026-11-23', to: '2026-11-29' }).map((c) => c.label)).toEqual(['23–29 Nov'])
    expect(monthColumns({ from: '2026-11-01', to: '2026-11-30' }).map((c) => c.label)).toEqual(['Nov'])
  })
})

describe('recurring costs not yet recorded this month', () => {
  const base = { id: '', description: 'Coworking desk', amount: 850, currency: 'RON' as const, fxRate: 1, amountRon: 850, status: 'paid' as const, group: 'operating' as const, category: 'rent' as const, venueId: null, clientId: null, activity: null, recurring: true, deductible: true, notes: '' }
  it('offers last month\'s rent once its day has passed, and not after it is in', async () => {
    const { recurringCostsMissing } = await import('./finance')
    const october = { ...base, id: 'oct', date: '2026-10-02' }
    expect(recurringCostsMissing([october], '2026-11-01')).toEqual([])
    expect(recurringCostsMissing([october], '2026-11-03').map((c) => c.id)).toEqual(['oct'])
    expect(recurringCostsMissing([october, { ...base, id: 'nov', date: '2026-11-02' }], '2026-11-25')).toEqual([])
    expect(recurringCostsMissing([{ ...october, recurring: false }], '2026-11-25')).toEqual([])
  })
})
