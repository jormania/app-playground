import { describe, expect, it } from 'vitest'
import type { IncomeRecord, InflowData, Refund } from '../domain/types'
import { clientMetrics } from './clientMetrics'
import { withRefunds } from './refunds'

const pay = (id: string, clientId: string | null, amount: number, date: string, extra: Partial<IncomeRecord> = {}): IncomeRecord => ({
  id, description: 'x', amount, currency: 'RON', fxRate: 1, amountRon: amount, date, status: 'received', clientId, sourceId: null, venueId: null,
  category: 'workshop', recurring: false, notes: '', attendees: null, sessions: 1, hours: null, taxability: 'taxable', taxHandling: 'self_declared',
  vat: 'exempt', classification: 'confirmed', taxReserve: null, reserveSource: null, taxWithheld: 0, taxRules: '', ...extra,
})

describe('client metrics', () => {
  const range = { from: '2026-03-01', to: '2026-03-31' }
  const refund: Refund = { id: 'f1', paymentId: 'p3', date: '2026-03-20', amount: 100, currency: 'RON', fxRate: 1, amountRon: 100, notes: '' }
  const data: InflowData = {
    clients: [], sources: [], venues: [], costs: [], refunds: [refund],
    records: [
      pay('p0', 'ana', 500, '2026-02-10'),          // Ana paid before: returning
      pay('p1', 'ana', 300, '2026-03-02'),
      pay('p2', 'ana', 200, '2026-03-09'),          // two payments, one client
      pay('p3', 'bob', 1000, '2026-03-05'),         // new; 100 refunded in March
      pay('p4', 'cora', 400, '2026-03-06', { category: 'reimbursement' }), // cost recovery: not a paying client
      pay('p5', null, 250, '2026-03-07', { importMeta: { key: 'k1', batch: 'b', counterparty: 'Beta Corp' } }),
      pay('p6', null, 80, '2026-03-08', { importMeta: { key: 'k2', batch: 'b', counterparty: 'Beta Corp' } }),
      pay('p7', null, 60, '2026-03-08'),            // no client, entered by hand
      pay('p8', 'dan', 700, '2026-03-30', { status: 'expected' }), // not received: not counted
    ],
  }
  const m = clientMetrics(withRefunds(data).records, range)

  it('counts clients, not payments; new and returning add up', () => {
    expect(m).toMatchObject({ paying: 2, newClients: 1, returning: 1 })
  })
  it('income per paying client is net of refunds and leaves out cost recovery and payments with no client', () => {
    // (300 + 200 + 1000 − 100) / 2 = 700
    expect(m.perClient).toBe(700)
  })
  it('payments with no client are counted as payments, and imported ones are named once each', () => {
    expect(m.noClient).toBe(3)
    expect(m.unmatched).toEqual(['Beta Corp'])
  })
})
