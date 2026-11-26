/**
 * Refunds: money paid back against a payment already received.
 *
 * A refund is its own transaction (`Refund`), linked to the payment it returns money from. The
 * payment itself is never changed or made negative: its history stays as it happened. For the
 * figures, each refund becomes an *adjustment row*, a copy of the payment dated the day the money
 * went back, with the refunded amount negative. Every total that reads `books` (see
 * `app/state.tsx`) therefore takes the refund in the refund's own period:
 *
 *   revenue and client earnings   less the refund (cost recovery less it, for a reimbursement)
 *   cash flow                     money out on the refund's date
 *   venue deals                   less revenue at that venue; the venue's fee or share stays paid
 *   tax                           less taxable income in the refund's year (cash basis). Reserves
 *                                 stored on the original are never rewritten; "still to set
 *                                 aside" simply falls, so a reserve already put by shows as ahead
 *
 * An adjustment row covers no session, no hours and no people, carries no reserve and no tax
 * withheld, and is never recurring: it changes money, not the work that was done.
 */
import type { IncomeRecord, InflowData, Refund } from '../domain/types'
import { round2 } from './money'

/** Is this row a refund's adjustment, not a payment? */
export const isRefund = (r: Pick<IncomeRecord, 'refundOf'>): boolean => !!r.refundOf

/** Payments only: refund adjustments left out (for counts, lists of payments, per-session figures). */
export const paymentsOnly = <T extends Pick<IncomeRecord, 'refundOf'>>(rs: T[]): T[] => rs.filter((r) => !r.refundOf)

/** The refunds against one payment, oldest first. */
export function refundsOf(paymentId: string, refunds: Refund[]): Refund[] {
  return refunds.filter((f) => f.paymentId === paymentId).sort((a, b) => a.date.localeCompare(b.date))
}

/** What has been refunded of a payment so far, in its own currency, and in lei. */
export function refundedOf(paymentId: string, refunds: Refund[], exceptId?: string): { amount: number; amountRon: number } {
  const fs = refunds.filter((f) => f.paymentId === paymentId && f.id !== exceptId)
  return { amount: round2(fs.reduce((a, f) => a + f.amount, 0)), amountRon: round2(fs.reduce((a, f) => a + f.amountRon, 0)) }
}

/** How much of a payment can still be refunded, in its own currency. */
export function refundable(payment: IncomeRecord, refunds: Refund[], exceptId?: string): number {
  if (payment.status !== 'received') return 0
  return Math.max(0, round2(payment.amount - refundedOf(payment.id, refunds, exceptId).amount))
}

export type RefundState = 'none' | 'partial' | 'full'

export function refundState(payment: IncomeRecord, refunds: Refund[]): RefundState {
  const done = refundedOf(payment.id, refunds).amount
  if (done <= 0) return 'none'
  return done >= payment.amount - 0.005 ? 'full' : 'partial'
}

/**
 * Why a refund can't be saved as it stands, or null. A refund belongs to a received payment,
 * is more than nothing, and together with the payment's other refunds can't exceed it.
 */
export function refundError(f: Refund, payment: IncomeRecord | undefined, refunds: Refund[]): string | null {
  if (!payment) return 'The payment this refund belongs to is gone.'
  if (payment.status !== 'received') return 'Only a payment already received can be refunded.'
  if (!(f.amount > 0)) return 'Enter the amount paid back.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return 'Pick the date the money went back.'
  if (f.date < payment.date) return 'A refund can\'t be dated before the payment it refunds.'
  const left = refundable(payment, refunds, f.id)
  if (f.amount > left + 0.005) {
    return left <= 0 ? 'This payment has already been refunded in full.' : `That is more than the ${left} ${payment.currency} still refundable.`
  }
  return null
}

/** One refund as an adjustment row: see the module comment. */
export function adjustmentOf(f: Refund, payment: IncomeRecord): IncomeRecord {
  return {
    ...payment,
    id: `refund:${f.id}`,
    description: `Refund: ${payment.description}`,
    date: f.date,
    amount: -f.amount,
    fxRate: f.fxRate,
    amountRon: -f.amountRon,
    status: 'received',
    recurring: false,
    attendees: null,
    sessions: 0,
    hours: null,
    taxReserve: null,
    reserveSource: null,
    taxWithheld: 0,
    notes: f.notes,
    refundOf: payment.id,
    demo: f.demo,
  }
}

/** Adjustment rows for every refund whose payment is here and received. */
export function adjustments(records: IncomeRecord[], refunds: Refund[]): IncomeRecord[] {
  if (!refunds.length) return []
  const byId = new Map(records.map((r) => [r.id, r]))
  const out: IncomeRecord[] = []
  for (const f of refunds) {
    const p = byId.get(f.paymentId)
    if (p && p.status === 'received') out.push(adjustmentOf(f, p))
  }
  return out
}

/** The data every figure is read from: the payments plus each refund's adjustment row. */
export function withRefunds(data: InflowData): InflowData {
  const extra = adjustments(data.records, data.refunds ?? [])
  return extra.length ? { ...data, records: [...data.records, ...extra] } : data
}
