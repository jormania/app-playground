/**
 * Estimated available to spend (audit F-01): it reconciles with the cash flow and the tax
 * position, counts withheld tax once, leaves expected income out, and reads tax paid during the
 * year by profile.
 */
import { describe, expect, it } from 'vitest'
import { buildDemo, DEMO_SETTINGS_TAX } from '../data/demo'
import type { CostRecord, IncomeRecord, TaxProfile } from '../domain/types'
import { taxPosition } from '../tax/estimate'
import { availableToSpend, paysThisYear } from './available'
import { balanceAt } from './finance'
import { addDays } from './dates'
import { withRefunds } from './refunds'

const today = '2026-11-25'
const demo = buildDemo(today)
const on = { trackTax: true, trackCosts: true }
const noOpening = { tax: DEMO_SETTINGS_TAX, openingCash: 0, openingCashDate: '' }

const pay = (id: string, date: string, amount: number, extra: Partial<IncomeRecord> = {}): IncomeRecord => ({
  ...demo.records[0], id, date, amount, amountRon: amount, currency: 'RON', fxRate: 1, status: 'received', taxability: 'taxable',
  taxWithheld: 0, taxReserve: null, reserveSource: null, category: 'workshop', demo: undefined, ...extra,
})
const cost = (id: string, date: string, amount: number, extra: Partial<CostRecord> = {}): CostRecord => ({
  ...demo.costs[0], id, date, amount, amountRon: amount, currency: 'RON', fxRate: 1, status: 'paid', group: 'operating', category: 'software', demo: undefined, ...extra,
})

describe('available to spend reconciles', () => {
  it('adds up: received − costs paid − tax still owed − costs due', () => {
    const a = availableToSpend(demo.records, demo.costs, noOpening, today, on)
    expect(a.available).toBeCloseTo(a.startCash + a.received - a.costsPaid - a.taxOwed - a.costsDue, 2)
    expect(a.received).toBeGreaterThan(0)
    expect(a.costsPaid).toBeGreaterThan(0)
  })

  it('with an opening balance, cash on hand less tax and due costs equals the cash flow’s balance less the same', () => {
    const s = { ...noOpening, openingCash: 14_000, openingCashDate: '2025-10-01' }
    const a = availableToSpend(demo.records, demo.costs, s, today, on)
    const cashNow = balanceAt(addDays(today, 1), demo.records, demo.costs, s.openingCash, s.openingCashDate)
    expect(a.startCash + a.received - a.costsPaid).toBeCloseTo(cashNow, 1)
    expect(a.available).toBeCloseTo(cashNow - a.taxOwed - a.costsDue, 1)
  })

  it('tax owed is the shared tax position, less what was withheld, and never below zero', () => {
    const p = taxPosition(DEMO_SETTINGS_TAX, demo.records, 2026, today, demo.costs)
    const a = availableToSpend(demo.records, demo.costs, { ...noOpening, tax: { ...DEMO_SETTINGS_TAX, id: 'pfa_real' } }, today, on)
    expect(a.taxOwed).toBe(Math.max(0, Math.round(p.owed - p.withheld)))
  })
})

describe('what is in it, and what is not', () => {
  const tax: TaxProfile = { ...DEMO_SETTINGS_TAX, id: 'custom', customRate: 0.1, expectedAnnualIncome: 0 }
  const s = { tax, openingCash: 0, openingCashDate: '' }

  it('counts withheld tax once: neither received nor still owed', () => {
    const plain = availableToSpend([pay('a', '2026-03-01', 1000)], [], s, today, on)
    const held = availableToSpend([pay('a', '2026-03-01', 1000, { taxWithheld: 100 })], [], s, today, on)
    expect(held.received).toBe(plain.received - 100)
    expect(held.taxOwed).toBe(Math.max(0, plain.taxOwed - 100))
    expect(held.available).toBeCloseTo(plain.available, 0)
    expect(held.withheldLeftOut).toBe(100)
  })

  it('leaves expected income out, and counts cost recovery and refunds', () => {
    const base = availableToSpend([pay('a', '2026-03-01', 1000)], [], s, today, on).available
    expect(availableToSpend([pay('a', '2026-03-01', 1000), pay('e', '2026-11-20', 5000, { status: 'expected' })], [], s, today, on).available).toBe(base)
    const recovery = availableToSpend([pay('a', '2026-03-01', 1000), pay('r', '2026-03-02', 200, { category: 'reimbursement', taxability: 'non_taxable' })], [], s, today, on)
    expect(recovery.received).toBe(1200)
    const books = withRefunds({ ...demo, records: [pay('a', '2026-03-01', 1000)], costs: [], refunds: [{ id: 'f', paymentId: 'a', date: '2026-04-01', amount: 300, currency: 'RON', fxRate: 1, amountRon: 300, notes: '' }] })
    expect(availableToSpend(books.records, [], s, today, on).received).toBe(700)
  })

  it('a reserve set aside is not counted as available', () => {
    const a = availableToSpend([pay('a', '2026-03-01', 1000, { taxReserve: 100, reserveSource: 'manual' })], [], s, today, on)
    expect(a.taxOwed).toBe(100)
    expect(a.available).toBe(900)
  })

  it('costs: paid this year out, depreciation aside; due ones within 30 days out', () => {
    const cs = [cost('p', '2026-02-01', 100), cost('d', '2026-02-01', 50, { group: 'depreciation', category: 'depreciation' }),
      cost('soon', '2026-12-10', 70, { status: 'due' }), cost('later', '2027-03-01', 900, { status: 'due' }), cost('old', '2025-12-01', 40)]
    const a = availableToSpend([pay('a', '2026-03-01', 1000)], cs, s, today, on)
    expect(a.costsPaid).toBe(100)
    expect(a.costsDue).toBe(70)
    const off = availableToSpend([pay('a', '2026-03-01', 1000)], cs, s, today, { trackTax: true, trackCosts: false })
    expect(off.costsPaid + off.costsDue).toBe(0)
  })

  it('tax off: nothing taken for tax', () => {
    expect(availableToSpend([pay('a', '2026-03-01', 1000)], [], s, today, { trackTax: false, trackCosts: true }).available).toBe(1000)
  })
})

describe('tax paid during the year, by profile', () => {
  it('PFA: tax paid this year is last year’s; SRL micro: after 25 January it is this year’s; custom: this year’s', () => {
    expect(paysThisYear('pfa_real', '2026-05-20')).toBe(false)
    expect(paysThisYear('pfa_norma', '2026-05-20')).toBe(false)
    expect(paysThisYear('srl_micro', '2026-01-20')).toBe(false)
    expect(paysThisYear('srl_micro', '2026-04-24')).toBe(true)
    expect(paysThisYear('custom', '2026-02-01')).toBe(true)
  })

  it('a payment towards this year lowers what is still owed; it is never counted twice', () => {
    const tax: TaxProfile = { ...DEMO_SETTINGS_TAX, id: 'custom', customRate: 0.1, expectedAnnualIncome: 0 }
    const rs = [pay('a', '2026-03-01', 10_000)]
    const before = availableToSpend(rs, [], { tax, openingCash: 0, openingCashDate: '' }, today, on)
    const after = availableToSpend(rs, [cost('t', '2026-06-01', 400, { group: 'tax', category: 'income_tax' })], { tax, openingCash: 0, openingCashDate: '' }, today, on)
    expect(after.taxPaidForThisYear).toBe(400)
    expect(after.taxOwed).toBe(before.taxOwed - 400)
    expect(after.available).toBe(before.available)
    // Under a PFA the same payment is last year's: cash went down, this year's tax didn't.
    const pfa = availableToSpend(rs, [cost('t', '2026-05-20', 400, { group: 'tax', category: 'income_tax' })], { tax: { ...DEMO_SETTINGS_TAX, id: 'pfa_real' }, openingCash: 0, openingCashDate: '' }, today, on)
    expect(pfa.taxPaidForLastYear).toBe(400)
  })
})
