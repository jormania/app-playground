import { describe, expect, it } from 'vitest'
import { buildDemo } from '../data/demo'
import type { IncomeRecord } from '../domain/types'
import { costFindings, incomeErrors, incomeFindings } from './guards'

const today = '2026-11-25'
const demo = buildDemo(today)
const ioana = demo.records.find((r) => r.clientId === 'demo_c_ioana' && r.status === 'received')!
const ids = (xs: { id: string }[]) => xs.map((x) => x.id)
const ctx = { records: demo.records, today }
const fresh = (patch: Partial<IncomeRecord>): IncomeRecord => ({ ...ioana, id: '', date: today, ...patch })

describe('payments: what gets a second look', () => {
  it('nothing for an ordinary payment', () => {
    expect(incomeFindings(fresh({ date: '2026-11-20', amount: 1000, amountRon: 1000 }), ctx)).toEqual([])
  })
  it('an extra zero, with the fix', () => {
    const f = incomeFindings(fresh({ amount: 10000, amountRon: 10000 }), ctx).find((x) => x.id === 'amount-high')!
    expect(f.text).toMatch(/extra zero/)
    expect(f.fix?.apply).toEqual({ kind: 'amount', value: 1000 })
  })
  it('a missing zero or a decimal point', () => {
    expect(ids(incomeFindings(fresh({ amount: 100, amountRon: 100 }), ctx))).toContain('amount-low')
  })
  it('received in the future, offering expected', () => {
    const f = incomeFindings(fresh({ date: '2026-12-10' }), ctx).find((x) => x.id === 'future')!
    expect(f.fix?.apply).toEqual({ kind: 'status', value: 'expected' })
    expect(ids(incomeFindings(fresh({ date: '2026-12-10', status: 'expected' }), ctx))).not.toContain('future')
  })
  it('a wrong year', () => {
    expect(ids(incomeFindings(fresh({ date: '2024-11-20' }), ctx))).toContain('old')
  })
  it('the same payment twice', () => {
    expect(ids(incomeFindings(fresh({ date: ioana.date, amount: ioana.amount, amountRon: ioana.amountRon }), ctx))).toContain('duplicate')
  })
  it('a rate typed the wrong way round', () => {
    const eur = demo.records.find((r) => r.currency === 'EUR')!
    const f = incomeFindings({ ...eur, id: '', date: '2026-11-20', fxRate: 0.2, amountRon: eur.amount * 0.2 }, ctx).find((x) => x.id === 'fx')!
    expect(f.fix?.apply.kind).toBe('fxRate')
  })
  it('a stored reserve under a changed amount: kept, but said, with the new suggestion one tap away', () => {
    const before = { ...ioana, taxReserve: 150 }
    const after = { ...before, amount: 3000, amountRon: 3000 }
    const f = incomeFindings(after, { ...ctx, before, suggestedReserve: 460 }).find((x) => x.id === 'reserve-stale')!
    expect(f.text).toMatch(/was for/)
    expect(f.fix?.apply).toEqual({ kind: 'reserve', value: 460 })
    // Unchanged amount: nothing to say.
    expect(ids(incomeFindings(before, { ...ctx, before, suggestedReserve: 460 }))).not.toContain('reserve-stale')
  })
  it('refuses more tax than the payment', () => {
    expect(incomeErrors({ amountRon: 1000, taxReserve: 1500, taxWithheld: 0 })).toMatch(/more than the payment/)
    expect(incomeErrors({ amountRon: 1000, taxReserve: null, taxWithheld: 1200 })).toMatch(/withheld/)
    expect(incomeErrors({ amountRon: 1000, taxReserve: 150, taxWithheld: 100 })).toBeNull()
  })
})

describe('costs', () => {
  const rent = demo.costs.find((c) => c.category === 'accounting' && c.status === 'paid')!
  it('an extra zero on the accountant, a paid cost in the future, and the same bill twice', () => {
    const c = { ...rent, id: '', date: '2026-11-20', amount: rent.amount * 10, amountRon: rent.amountRon * 10 }
    expect(ids(costFindings(c, { costs: demo.costs, today }))).toContain('amount-high')
    expect(ids(costFindings({ ...rent, id: '', date: '2026-12-20' }, { costs: demo.costs, today }))).toContain('future')
    expect(ids(costFindings({ ...rent, id: '' }, { costs: demo.costs, today }))).toContain('duplicate')
  })
})
