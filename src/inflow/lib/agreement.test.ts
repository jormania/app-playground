/**
 * One period, every place it is reported: the Overview's summary, the P&L, Clients & work, the
 * cash flow, the printable report and the CSV export must agree on what was earned, what came
 * back as cost recovery, and what actually arrived (audit B-01, B-04).
 */
import { describe, expect, it } from 'vitest'
import { buildDemo, DEMO_SETTINGS_TAX } from '../data/demo'
import type { IncomeRecord } from '../domain/types'
import { recordsCsv } from '../store/backup'
import { earned, received, recovered, summarise } from './analytics'
import { earnings } from './earnings'
import { buildCashFlow, buildPnl, monthColumns } from './finance'
import { defaultReportOptions, renderReport } from './report'
import { lei, round2 } from './money'
import { withRefunds } from './refunds'

const today = '2026-11-25'
const demo = buildDemo(today)
// Give one reimbursement some tax withheld, so cash and revenue differ for both kinds.
const withheld = { ...demo, records: demo.records.map((r, i) => (i === demo.records.findIndex((x) => x.category === 'reimbursement') ? { ...r, taxWithheld: 10 } : r)) }
// And one refund of a service payment, paid back later in the year: every screen reads it from the same books.
const refunded = withheld.records.find((r) => r.status === 'received' && r.category !== 'reimbursement' && r.date.startsWith('2026-02'))!
const data = withRefunds({ ...withheld, refunds: [{ id: 'f1', paymentId: refunded.id, date: '2026-06-15', amount: 100, currency: refunded.currency, fxRate: refunded.fxRate, amountRon: round2(100 * refunded.fxRate), notes: '' }] })
const range = { from: '2026-01-01', to: '2026-12-31' }
const all = received(data.records, range)
const s = summarise(earned(all), recovered(all))
const pnl = buildPnl(data.records, data.costs, monthColumns(range))
const line = (k: string) => pnl.lines.find((l) => l.key === k)?.total ?? 0

describe('every screen reports the same period the same way', () => {
  it('has both kinds of money and a refund in the data, so the test means something', () => {
    expect(data.records.some((r) => r.refundOf)).toBe(true)
    expect(s.total).toBeGreaterThan(0)
    expect(s.costRecovery).toBeGreaterThan(0)
    expect(s.taxWithheld).toBeGreaterThan(0)
  })

  it('earned: Overview = P&L revenue = Clients & work income, reimbursements apart', () => {
    expect(line('revenue')).toBeCloseTo(s.total, 2)
    expect(earnings(data, range, 'client', { deals: true, costs: true }).totals.income).toBeCloseTo(s.total, 2)
    expect(earnings(data, range, 'activity', { deals: false, costs: false }).totals.income).toBeCloseTo(s.total, 2)
  })

  it('cost recovery: one figure, on its own line everywhere', () => {
    expect(line('recovery')).toBeCloseTo(s.costRecovery, 2)
    expect(earnings(data, range, 'client', { deals: true, costs: true }).totals.costRecovery).toBeCloseTo(s.costRecovery, 2)
    expect(s.receivedGross).toBeCloseTo(s.total + s.costRecovery, 2)
  })

  it('cash: what arrived is everything received less tax withheld, in the summary and the cash flow', () => {
    const cf = buildCashFlow(data.records, data.costs, monthColumns(range), 0, '')
    const row = (k: string) => (cf.rows.find((r) => r.key === k)?.values ?? []).reduce((a, v) => a + v, 0)
    expect(row('in') + row('back') - row('refunds')).toBeCloseTo(s.cashIn, 2)
    expect(s.cashIn).toBeCloseTo(s.receivedGross - s.taxWithheld, 2)
  })

  it('withheld tax is tax paid in the P&L, so profit and cash count it once', () => {
    const withheld = pnl.lines.find((l) => l.key === 'tax:withheld')!.total
    expect(withheld).toBeCloseTo(s.taxWithheld, 2)
  })

  it('the printable report shows the same earned and cost recovery figures', () => {
    const html = renderReport(data, { ...defaultReportOptions(range), from: range.from, to: range.to, sections: ['summary', 'pnl', 'payments'], compare: false },
      { today, trackTax: true, trackCosts: true, tax: DEMO_SETTINGS_TAX })
    expect(html).toContain(lei(s.total))
    expect(html).toContain(lei(s.costRecovery))
  })

  it('the CSV export adds up to the same earned, cost recovery and cash', () => {
    const rs: IncomeRecord[] = all
    const csv = recordsCsv(rs, data)
    const rows = csv.replace(/^\uFEFF/, '').trim().split('\n').slice(1).map((l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '')))
    const head = csv.replace(/^\uFEFF/, '').split('\n')[0].split(',')
    const col = (n: string) => head.indexOf(n)
    const total = (kind: string, c: string) => rows.filter((r) => r[col('Kind')] === kind).reduce((a, r) => a + Number(r[col(c)]), 0)
    // The refund here is of a service payment: its negative row nets against service revenue.
    expect(total('Service', 'Amount RON') + total('Refund', 'Amount RON')).toBeCloseTo(s.total, 1)
    expect(total('Cost recovery', 'Amount RON')).toBeCloseTo(s.costRecovery, 1)
    expect(total('Service', 'Cash received RON') + total('Cost recovery', 'Cash received RON') + total('Refund', 'Cash received RON')).toBeCloseTo(s.cashIn, 1)
  })
})
