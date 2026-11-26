/**
 * Marking an expected payment received: one rule, whichever screen it starts from
 * (audit B-02, B-03, E-01). Pure; the app layer (`app/receive.ts`) fetches the day's rate and saves.
 *
 *  - **All of it**: the expected payment itself becomes received, on the receipt date, at that
 *    date's rate. Its tax reserve is suggested unless you had set one by hand.
 *  - **Part of it**: a new received payment holds the part (with the sessions and hours, so they
 *    are counted once); the expected payment stays, holding the balance still owed, with no
 *    sessions of its own. Tax withheld is shared in proportion. Nothing is recreated by hand.
 */
import type { IncomeRecord } from '../domain/types'
import { round2, toRon } from './money'

export interface Receipt {
  /** In the payment's own currency. */
  amount: number
  date: string
  /** Lei per unit on the receipt date; 1 for lei. */
  fxRate: number
}

/** The reserve to suggest for a payment as received, or null when no reserve applies. */
export type SuggestReserve = (r: IncomeRecord) => { amount: number; rulesId: string } | null

export interface ReceiveResult {
  /** Save this: the received payment (the expected record itself when paid in full, else new). */
  received: IncomeRecord
  /** Save this too when part was paid: the expected record, now holding the balance. */
  remaining: IncomeRecord | null
}

/** Below this, a difference is rounding, not a balance still owed. */
const EPSILON = 0.005

export function receive(expected: IncomeRecord, receipt: Receipt, suggest?: SuggestReserve): ReceiveResult {
  if (expected.status !== 'expected') throw new Error('Only an expected payment can be marked received.')
  if (!(receipt.amount > 0)) throw new Error('Enter the amount received.')
  if (receipt.amount > expected.amount + EPSILON) throw new Error('That is more than is expected; edit the payment instead.')
  const part = receipt.amount < expected.amount - EPSILON
  const share = part ? receipt.amount / expected.amount : 1
  const base: IncomeRecord = {
    ...expected,
    id: part ? '' : expected.id,
    status: 'received',
    date: receipt.date,
    amount: round2(receipt.amount),
    fxRate: receipt.fxRate,
    amountRon: toRon(receipt.amount, receipt.fxRate),
    taxWithheld: round2((expected.taxWithheld || 0) * share),
  }
  // A reserve you set by hand is yours; otherwise it is suggested for the money that came in.
  const keepYours = expected.reserveSource === 'manual' && expected.taxReserve !== null
  const s = keepYours ? null : suggest?.(base) ?? null
  const received: IncomeRecord = keepYours
    ? { ...base, taxReserve: round2(expected.taxReserve! * share) }
    : s
      ? { ...base, taxReserve: round2(s.amount), reserveSource: 'suggested', taxRules: s.rulesId }
      : { ...base, taxReserve: base.taxReserve ?? null }
  if (!part) return { received, remaining: null }
  const rest = round2(expected.amount - receipt.amount)
  const remaining: IncomeRecord = {
    ...expected,
    amount: rest,
    amountRon: toRon(rest, expected.fxRate),
    sessions: 0,
    hours: null,
    attendees: null,
    taxWithheld: round2((expected.taxWithheld || 0) - received.taxWithheld),
    taxReserve: keepYours ? round2(expected.taxReserve! - received.taxReserve!) : null,
    notes: [expected.notes, `Balance after ${round2(receipt.amount)} ${expected.currency} received on ${receipt.date}.`].filter(Boolean).join(' '),
  }
  return { received, remaining }
}
