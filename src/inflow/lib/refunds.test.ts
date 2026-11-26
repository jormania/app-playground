/**
 * Refunds as their own transactions (lib/refunds.ts), and venue-deal snapshots (lib/deals.ts):
 * every figure moves in the refund's own period, the original payment never changes, and a
 * venue's later deal never reaches back.
 */
import { describe, expect, it } from 'vitest'
import { buildDemo, DEMO_SETTINGS_TAX } from '../data/demo'
import type { IncomeRecord, InflowData, Refund, Venue } from '../domain/types'
import { recordsCsv } from '../store/backup'
import { normalise, SCHEMA } from '../store/repo'
import { gapLabel, taxableGross, taxPosition } from '../tax/estimate'
import { breakdown, received, summarise } from './analytics'
import { refundsWithoutSessions, stampTerms, termsOf, venueDeal, venueDeals } from './deals'
import { earnings } from './earnings'
import { buildCashFlow, buildPnl, monthColumns } from './finance'
import { adjustments, defaultRefund, paymentEditError, refundable, refundError, refundState, withRefunds } from './refunds'

const demo = buildDemo('2026-11-25')
const room: Venue = { ...demo.venues[0], id: 'v1', name: 'Loft', deal: 'share', feePerSession: 0, sharePct: 0.3, monthlyFee: 0, demo: undefined }
const pay = (id: string, date: string, amount: number, extra: Partial<IncomeRecord> = {}): IncomeRecord => ({
  ...demo.records[0], id, date, amount, amountRon: amount, currency: 'RON', fxRate: 1, status: 'received', clientId: 'ana', sourceId: null,
  venueId: 'v1', category: 'workshop', taxability: 'taxable', taxReserve: 200, reserveSource: 'suggested', taxWithheld: 0, recurring: false,
  sessions: 1, hours: null, attendees: 10, dealTerms: undefined, demo: undefined, ...extra,
})
const refund = (id: string, paymentId: string, date: string, amount: number): Refund =>
  ({ id, paymentId, date, amount, currency: 'RON', fxRate: 1, amountRon: amount, notes: '' })
const base: InflowData = {
  records: [pay('p1', '2026-03-10', 1000), pay('p2', '2026-03-20', 500)],
  costs: [], clients: [{ ...demo.clients[0], id: 'ana', name: 'Ana', demo: undefined }], sources: [], venues: [room], refunds: [],
}
const march = { from: '2026-03-01', to: '2026-03-31' }
const april = { from: '2026-04-01', to: '2026-04-30' }

describe('what can be refunded', () => {
  const p1 = base.records[0]
  it('allows partial and several refunds, up to the payment and not beyond', () => {
    const fs = [refund('f1', 'p1', '2026-04-05', 400)]
    expect(refundable(p1, fs)).toBe(600)
    expect(refundState(p1, fs)).toBe('partial')
    expect(refundError(refund('', 'p1', '2026-04-10', 600), p1, fs)).toBeNull()
    expect(refundError(refund('', 'p1', '2026-04-10', 600.5), p1, fs)).toMatch(/more than the 600/)
    const all = [...fs, refund('f2', 'p1', '2026-04-10', 600)]
    expect(refundState(p1, all)).toBe('full')
    expect(refundError(refund('', 'p1', '2026-04-11', 1), p1, all)).toMatch(/already been refunded in full/)
  })
  it('editing a refund counts the others, not itself', () => {
    const fs = [refund('f1', 'p1', '2026-04-05', 400), refund('f2', 'p1', '2026-04-06', 600)]
    expect(refundError({ ...fs[1], amount: 600 }, p1, fs)).toBeNull()
  })
  it('refuses a refund of an expected payment, of nothing, or dated before the payment', () => {
    expect(refundError(refund('', 'p1', '2026-04-05', 100), { ...p1, status: 'expected' }, [])).toMatch(/already received/)
    expect(refundError(refund('', 'p1', '2026-04-05', 0), p1, [])).toMatch(/amount/)
    expect(refundError(refund('', 'p1', '2026-03-01', 100), p1, [])).toMatch(/before the payment/)
    expect(refundError(refund('', 'gone', '2026-04-05', 100), undefined, [])).toMatch(/gone/)
  })
})

describe('a refund is counted in its own period, everywhere', () => {
  const data = withRefunds({ ...base, refunds: [refund('f1', 'p1', '2026-04-05', 400)] })
  const recs = data.records

  it('leaves the payment itself as it was', () => {
    expect(recs.find((r) => r.id === 'p1')).toEqual(base.records[0])
    expect(adjustments(base.records, [refund('f1', 'p1', '2026-04-05', 400)])[0]).toMatchObject({ amountRon: -400, sessions: 0, taxReserve: null, taxWithheld: 0, recurring: false, refundOf: 'p1' })
  })

  it('revenue: March keeps the payment, April is less the refund; counts stay payments', () => {
    expect(summarise(received(recs, march)).total).toBe(1500)
    const apr = summarise(received(recs, april))
    expect(apr.total).toBe(-400)
    expect(apr.count).toBe(0)
    expect(breakdown(data, received(recs, { from: '2026-03-01', to: '2026-04-30' }), [], 'client')[0]).toMatchObject({ total: 1100, count: 2 })
  })

  it('P&L and cash flow: revenue less refunds on its own line, money out on its own line', () => {
    const cols = monthColumns({ from: '2026-03-01', to: '2026-04-30' })
    const pnl = buildPnl(recs, [], cols)
    expect(pnl.lines.find((l) => l.key === 'revenue')!.values).toEqual([1500, -400])
    expect(pnl.lines.find((l) => l.key === 'revenue:refunds')!.values).toEqual([0, -400])
    const cf = buildCashFlow(recs, [], cols, 0, '')
    expect(cf.rows.find((r) => r.key === 'in')!.values).toEqual([1500, 0])
    expect(cf.rows.find((r) => r.key === 'refunds')!.values).toEqual([0, 400])
    expect(cf.rows.find((r) => r.key === 'net')!.values).toEqual([1500, -400])
  })

  it('client earnings and venue profitability fall by the refund; the venue keeps its share', () => {
    const range = { from: '2026-03-01', to: '2026-04-30' }
    expect(earnings(data, range, 'client', { deals: true, costs: false }).totals.income).toBe(1100)
    const d = venueDeal(room, recs, range)
    expect(d.revenue).toBe(1100)
    expect(d.venueCost).toBe(450) // 30% of 1,500, paid on the sessions
    expect(d.sessionCount).toBe(2)
    expect(d.losing).toHaveLength(0)
  })

  it('the CSV has the refund as its own negative row', () => {
    const csv = recordsCsv(received(recs, april), data)
    expect(csv).toContain('Refund')
    expect(csv).toMatch(/2026-04-05,Refund,Refund: [^,]*,-400/)
  })
})

describe('a refund in a later tax year', () => {
  const data = withRefunds({
    ...base,
    records: [pay('dec', '2025-12-15', 1000), pay('jan', '2026-01-20', 5000)],
    refunds: [refund('f1', 'dec', '2026-01-10', 300)],
  })
  it('reduces the year it was paid back in, not the year of the payment', () => {
    expect(taxableGross(data.records, 2025)).toBe(1000)
    expect(taxableGross(data.records, 2026)).toBe(4700)
  })
  it('never rewrites the reserve stored on the original payment', () => {
    expect(data.records.find((r) => r.id === 'dec')!.taxReserve).toBe(200)
    expect(data.records.filter((r) => r.refundOf).every((r) => r.taxReserve === null)).toBe(true)
  })
})

describe('venue deal snapshots', () => {
  const fixed: Venue = { ...room, deal: 'fixed', feePerSession: 300, sharePct: 0 }
  it('a payment keeps its deal when the venue’s deal changes later', () => {
    const r = stampTerms(pay('p', '2026-03-10', 1000), undefined, [fixed])
    expect(r.dealTerms).toEqual(termsOf(fixed))
    const range = { from: '2026-03-01', to: '2026-03-31' }
    const now: Venue = { ...fixed, feePerSession: 500 }
    expect(venueDeal(now, [r], range).venueCost).toBe(300)
    expect(venueDeal(now, [r], range).underEarlierDeal).toBe(1)
    // A new payment there takes the deal as it is now.
    expect(stampTerms(pay('q', '2026-03-12', 1000, { id: '' }), undefined, [now]).dealTerms).toEqual(termsOf(now))
  })
  it('stays put on edit, follows a change of venue, and clears with no venue', () => {
    const other: Venue = { ...room, id: 'v2', deal: 'none' }
    const stored = { ...pay('p', '2026-03-10', 1000), dealTerms: termsOf(fixed) }
    const now: Venue = { ...fixed, feePerSession: 500 }
    expect(stampTerms({ ...stored, amount: 1100, dealTerms: undefined }, stored, [now, other]).dealTerms).toEqual(termsOf(fixed))
    expect(stampTerms({ ...stored, venueId: 'v2', dealTerms: undefined }, stored, [now, other]).dealTerms).toEqual(termsOf(other))
    expect(stampTerms({ ...stored, venueId: null }, stored, [now]).dealTerms).toBeNull()
  })

  it('migration 2: old payments take the venue’s terms as stored then, once, changing no figure', () => {
    const old = { records: [pay('p', '2026-03-10', 1000), pay('n', '2026-03-11', 200, { venueId: null })], costs: [], clients: [], sources: [], venues: [fixed] }
    const before = venueDeal(fixed, old.records, march).venueCost
    const m = normalise(old as unknown as InflowData)
    expect(m.schema).toBe(SCHEMA)
    expect(m.refunds).toEqual([])
    expect(m.records[0].dealTerms).toEqual(termsOf(fixed))
    expect(m.records[1].dealTerms).toBeNull()
    expect(venueDeal(fixed, m.records, march).venueCost).toBe(before)
    // Run again on migrated data: nothing changes, even after the venue's deal does.
    const again = normalise({ ...m, venues: [{ ...fixed, feePerSession: 900 }] })
    expect(again.records[0].dealTerms).toEqual(termsOf(fixed))
  })
})

describe('a payment with refunds keeps what they depend on (Release 1, D1/D2)', () => {
  const p = pay('p', '2026-03-10', 1000)
  const fs = [refund('f1', 'p', '2026-04-05', 300), refund('f2', 'p', '2026-05-01', 200)]
  it('an unrefunded payment edits freely', () => {
    expect(paymentEditError(p, { ...p, amount: 10, currency: 'EUR', status: 'expected', date: '2027-01-01' }, [])).toBeNull()
  })
  it('a refunded one edits freely within its refunds', () => {
    expect(paymentEditError(p, { ...p, amount: 500, description: 'new', date: '2026-04-05' }, fs)).toBeNull()
  })
  it('refuses an amount below what was refunded (several refunds summed)', () => {
    expect(paymentEditError(p, { ...p, amount: 499.99 }, fs)).toMatch(/totalling 500 RON/)
  })
  it('refuses a currency change', () => {
    expect(paymentEditError(p, { ...p, currency: 'EUR' }, fs)).toMatch(/currency can't change/)
  })
  it('refuses a date after the first refund', () => {
    expect(paymentEditError(p, { ...p, date: '2026-04-06' }, fs)).toMatch(/refunded on 2026-04-05/)
  })
  it('refuses Expected (its refunds would vanish from every figure)', () => {
    expect(paymentEditError(p, { ...p, status: 'expected' }, fs)).toMatch(/stays received/)
  })
})

describe('the refund form starts at what arrived (Release 1, D4)', () => {
  it('no withholding: all that is left', () => {
    expect(defaultRefund(pay('p', '2026-03-10', 1000), [])).toMatchObject({ amount: 1000, withheld: 0, left: 1000 })
  })
  it('10% withheld: the 900 that arrived, not the gross 1,000; the limit stays the gross', () => {
    expect(defaultRefund(pay('p', '2026-03-10', 1000, { taxWithheld: 100 }), [])).toMatchObject({ amount: 900, cashReceived: 900, withheld: 100, left: 1000 })
  })
  it('foreign currency: withheld lei converted at the payment’s rate', () => {
    expect(defaultRefund(pay('p', '2026-03-10', 200, { currency: 'EUR', fxRate: 5, amountRon: 1000, taxWithheld: 100 }), [])).toMatchObject({ amount: 180, withheld: 20 })
  })
  it('after a first refund: what arrived less what went back already', () => {
    expect(defaultRefund(pay('p', '2026-03-10', 1000, { taxWithheld: 100 }), [refund('f', 'p', '2026-04-01', 400)])).toMatchObject({ amount: 500, left: 600 })
  })
  it('fully withheld: nothing arrived, so it starts at 0', () => {
    expect(defaultRefund(pay('p', '2026-03-10', 1000, { taxWithheld: 1000 }), []).amount).toBe(0)
  })
})

describe('refunds larger than the year’s income (Release 1, D5)', () => {
  const custom = { ...DEMO_SETTINGS_TAX, id: 'custom' as const, customRate: 0.1, expectedAnnualIncome: 0 }
  const pos = (records: IncomeRecord[], refunds: Refund[], year = 2026) => taxPosition(custom, withRefunds({ ...base, records, refunds }).records, year, '2026-11-25')
  it('a full refund in a year with no other income: nothing owed, no credit, and said so', () => {
    const p = pos([pay('dec', '2025-12-20', 1000)], [refund('f', 'dec', '2026-01-10', 1000)])
    expect([p.rawTaxable, p.owed, p.gap, p.refundsExceedIncome, gapLabel(p.gap)]).toEqual([-1000, 0, 0, true, 'Nothing more to set aside'])
  })
  it('a refund partly exceeding this year’s income: floored at 0, the refund itself untouched', () => {
    const d = withRefunds({ ...base, records: [pay('dec', '2025-12-20', 1000), pay('jan', '2026-01-15', 300)], refunds: [refund('f', 'dec', '2026-02-01', 800)] })
    expect(d.records.find((r) => r.refundOf)!.amountRon).toBe(-800)
    expect(taxableGross(d.records, 2026)).toBe(-500)
    expect(taxPosition(custom, d.records, 2026, '2026-11-25')).toMatchObject({ owed: 0, refundsExceedIncome: true })
  })
  it('several refunds, and one with tax withheld on the original: the withheld tax still counts, never negative tax', () => {
    const p = pos([pay('a', '2025-11-01', 1000, { taxWithheld: 100 }), pay('b', '2026-03-01', 500)], [refund('f1', 'a', '2026-01-10', 400), refund('f2', 'a', '2026-02-10', 400)])
    expect(p).toMatchObject({ owed: 0, withheld: 0, refundsExceedIncome: true })
  })
  it('the refund’s own year moves, the original year doesn’t; a normal year is unchanged', () => {
    expect(pos([pay('dec', '2025-12-20', 1000)], [refund('f', 'dec', '2026-01-10', 1000)], 2025)).toMatchObject({ rawTaxable: 1000, refundsExceedIncome: false })
    const normal = pos([pay('a', '2026-02-01', 5000)], [refund('f', 'a', '2026-03-01', 1000)])
    expect(normal).toMatchObject({ rawTaxable: 4000, refundsExceedIncome: false })
    expect(normal.owed).toBeGreaterThan(0)
  })
})

describe('venue deals show sessions, and refunds beside them (Release 1, D8)', () => {
  const fixed: Venue = { ...room, deal: 'fixed', feePerSession: 100, sharePct: 0 }
  const rs = [pay('p1', '2026-03-10', 1000), pay('p2', '2026-03-20', 500)]
  const deal = (refunds: Refund[], range: { from: string; to: string }) => venueDeal(fixed, withRefunds({ ...base, venues: [fixed], records: rs, refunds }).records, range)
  it('ordinary sessions: unchanged', () => {
    expect(deal([], march)).toMatchObject({ revenue: 1500, venueCost: 200, sessionCount: 2, refunded: 0 })
  })
  it('a partial refund in the same period: revenue net of it, sessions and venue cost as they were', () => {
    const d = deal([refund('f', 'p1', '2026-03-25', 300)], march)
    expect(d).toMatchObject({ revenue: 1200, venueCost: 200, sessionCount: 2, refunded: 300, takeHome: 1000 })
    expect(d.sessions).toHaveLength(2)
  })
  it('a full refund: still a session that happened, the money gone', () => {
    expect(deal([refund('f', 'p1', '2026-03-25', 1000)], march)).toMatchObject({ revenue: 500, sessionCount: 2, refunded: 1000 })
  })
  it('a refund-only period: no deal row, named apart', () => {
    const data = withRefunds({ ...base, venues: [fixed], records: rs, refunds: [refund('f', 'p1', '2026-04-05', 300)] })
    expect(venueDeals([fixed], data.records, april)).toEqual([])
    expect(refundsWithoutSessions([fixed], data.records, april)).toEqual([{ venue: fixed, refunded: 300 }])
  })
})
