/**
 * A few plain figures about clients for a period (Release 2): how many paid, how many of those
 * were new or came back, and what a paying client brought on average. Clients are counted, never
 * payments: three payments from one client are one client. A payment with no client counts
 * towards neither; imported payments with no client are listed by the name the bank gave.
 */
import type { IncomeRecord } from '../domain/types'
import { earned } from './analytics'
import { round2 } from './money'

export interface ClientMetrics {
  /** Distinct clients with a received payment for work in the period. */
  paying: number
  /** Of those, paid for the first time in this period. */
  newClients: number
  /** Of those, paid before the period too. */
  returning: number
  /** Income for work from those clients, net of refunds, divided by `paying`. Lei. */
  perClient: number
  /** Payments for work in the period with no client. */
  noClient: number
  /** Distinct bank counterparties among imported payments with no client. */
  unmatched: string[]
}

/**
 * `records` are the books (payments plus refund adjustments, see `withRefunds`); `range` the
 * period. Cost recovery (reimbursements) is not work and is left out throughout.
 */
export function clientMetrics(records: IncomeRecord[], range: { from: string; to: string }): ClientMetrics {
  const work = earned(records.filter((r) => r.status === 'received'))
  const inRange = (r: IncomeRecord) => r.date >= range.from && r.date <= range.to
  const payments = work.filter((r) => !r.refundOf && inRange(r))
  const paying = new Set(payments.filter((r) => r.clientId).map((r) => r.clientId!))
  const before = new Set(work.filter((r) => !r.refundOf && r.clientId && r.date < range.from).map((r) => r.clientId!))
  const returning = [...paying].filter((c) => before.has(c)).length
  // Net of refunds in the period, as every income figure is.
  const income = work.filter((r) => inRange(r) && r.clientId && paying.has(r.clientId)).reduce((s, r) => s + r.amountRon, 0)
  const noClient = payments.filter((r) => !r.clientId)
  const unmatched = [...new Set(noClient.map((r) => r.importMeta?.counterparty?.trim()).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b))
  return {
    paying: paying.size,
    newClients: paying.size - returning,
    returning,
    perClient: paying.size ? round2(income / paying.size) : 0,
    noClient: noClient.length,
    unmatched,
  }
}
