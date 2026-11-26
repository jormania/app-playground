/**
 * At scale (audit G-01, G-04): five years, 5,000 payments and 600 costs. Every figure a screen
 * computes stays fast, and the indexed cost allocation gives exactly what the plain rule gave.
 * Budgets are generous (CI machines vary); the audit measured 236 ms for insights() before.
 */
import { describe, expect, it } from 'vitest'
import { buildDemo, DEMO_SETTINGS_TAX } from '../data/demo'
import type { Client, CostRecord, IncomeRecord, InflowData } from '../domain/types'
import { breakdown, received } from './analytics'
import { availableToSpend } from './available'
import { daysBetween } from './dates'
import { venueDeals } from './deals'
import { earnings } from './earnings'
import { buildCashFlow, buildPnl, monthColumns } from './finance'
import { insights, recordCosts } from './insights'
import { withRefunds } from './refunds'

const today = '2026-11-26'
const d = buildDemo(today)
const clients: Client[] = Array.from({ length: 300 }, (_, i) => ({ ...d.clients[0], id: `c${i}`, name: `Client ${i}`, kind: i % 10 ? 'individual' : 'business', archived: false, demo: undefined }))
const records: IncomeRecord[] = Array.from({ length: 5000 }, (_, i) => {
  const date = new Date(Date.UTC(2022, 0, 1 + Math.floor((i * 1790) / 5000))).toISOString().slice(0, 10)
  return { ...d.records[0], id: `r${i}`, clientId: `c${i % 300}`, venueId: d.venues[i % d.venues.length].id, sourceId: d.sources[i % d.sources.length].id, date, amount: 300 + (i % 7) * 50, amountRon: 300 + (i % 7) * 50, status: 'received', category: i % 40 === 0 ? 'reimbursement' : 'workshop', recurring: i % 5 === 0, dealTerms: undefined, demo: undefined }
})
const costs: CostRecord[] = Array.from({ length: 600 }, (_, i) => ({ ...d.costs[0], id: `k${i}`, date: new Date(Date.UTC(2022, 0, 1 + i * 3)).toISOString().slice(0, 10), venueId: i % 3 ? d.venues[i % d.venues.length].id : null, clientId: i % 3 ? null : `c${i % 300}`, group: i % 2 ? 'direct' : 'operating', category: 'materials', status: 'paid', demo: undefined }))
const data: InflowData = withRefunds({ clients, sources: d.sources, venues: d.venues, records, costs, refunds: [{ id: 'f', paymentId: 'r4000', date: '2026-02-01', amount: 100, currency: 'RON', fxRate: 1, amountRon: 100, notes: '' }] })
const year = { from: '2026-01-01', to: '2026-12-31' }
const timed = (f: () => unknown) => { const s = performance.now(); f(); return performance.now() - s }

/** The allocation rule as it was written before indexing: every cost against every payment. */
function plainDirect(x: InflowData): Map<string, number> {
  const sessions = x.records.filter((r) => r.status === 'received' && r.category !== 'reimbursement' && !r.refundOf)
  const out = new Map<string, number>()
  for (const c of x.costs) {
    if (c.status !== 'paid' || c.group !== 'direct' || c.category === 'venue_hire' || c.category === 'platform_fees') continue
    const at = c.venueId ? sessions.filter((r) => r.venueId === c.venueId) : c.clientId ? sessions.filter((r) => r.clientId === c.clientId) : []
    if (!at.length) continue
    let best = Infinity
    for (const r of at) best = Math.min(best, Math.abs(daysBetween(c.date, r.date)))
    if (best > 31) continue
    const targets = at.filter((r) => Math.abs(daysBetween(c.date, r.date)) === best)
    for (const r of targets) out.set(r.id, (out.get(r.id) ?? 0) + c.amountRon / targets.length)
  }
  return out
}

describe('5,000 payments and 600 costs', () => {
  it('the indexed allocation gives the same costs per payment as the plain rule', () => {
    const plain = plainDirect(data)
    const fast = recordCosts(data, { deals: true, costs: true })
    expect(plain.size).toBeGreaterThan(100)
    for (const [id, v] of plain) expect(fast.get(id)!.direct).toBeCloseTo(v, 2)
    for (const [id, c] of fast) if (c.direct) expect(plain.has(id)).toBe(true)
  })

  it('every screen’s figures stay quick', () => {
    const opts = { deals: true, costs: true, expected: true, tax: true }
    const budget: [string, () => unknown, number][] = [
      ['insights', () => insights(data, year, today, opts), 150],
      ['earnings', () => earnings(data, year, 'client', { deals: true, costs: true }), 150],
      ['venue deals', () => venueDeals(data.venues, data.records, year), 100],
      ['P&L, 5 years', () => buildPnl(data.records, data.costs, monthColumns({ from: '2022-01-01', to: '2026-12-31' })), 150],
      ['cash flow, 5 years', () => buildCashFlow(data.records, data.costs, monthColumns({ from: '2022-01-01', to: '2026-12-31' }), 1000, '2022-01-01'), 150],
      ['breakdown', () => breakdown(data, received(data.records, year), [], 'client'), 100],
      ['available to spend', () => availableToSpend(data.records, data.costs, { tax: DEMO_SETTINGS_TAX, openingCash: 0, openingCashDate: '' }, today, { trackTax: true, trackCosts: true }), 100],
    ]
    for (const [, f] of budget) f() // warm up
    for (const [name, f, ms] of budget) expect([name, timed(f)]).toSatisfy(([, t]: [string, number]) => t < ms)
  })
})
