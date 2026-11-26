/**
 * From reviewed rows to what will be saved (Release 2, experimental). Pure: the records are built
 * here with InFlow's own rules (tax classification suggested, reserve suggested, a refund checked
 * as the refund form checks it, an expected payment received as `lib/receive` receives it) and
 * saved by `app/import.ts`.
 *
 * Nothing is invented: an imported payment has no sessions, no hours, no tax withheld, and a
 * reserve only as the payment form would suggest it. Amounts stay in the transaction's currency
 * at that day's rate, converted once.
 */
import type { CostRecord, Currency, Features, IncomeRecord, InflowData, Refund, TaxProfile } from '../../domain/types'
import { suggestClassification } from '../../tax/classify'
import { round2, toRon } from '../money'
import { receive, type SuggestReserve } from '../receive'
import { refundError } from '../refunds'
import { type Choice, type Kind, type Row, SET_ASIDE } from './classify'

export type Op =
  | { op: 'createRecord'; key: string; kind: Kind; record: IncomeRecord }
  | { op: 'createCost'; key: string; kind: Kind; cost: CostRecord }
  | { op: 'createRefund'; key: string; kind: Kind; refund: Refund }
  | { op: 'link'; key: string; kind: Kind; counterparty: string; target: { kind: 'record' | 'cost' | 'refund'; id: string } }
  | { op: 'receive'; key: string; kind: Kind; expectedId: string; received: IncomeRecord; remaining: IncomeRecord | null }
  | { op: 'skip'; key: string; kind: Kind }

export interface Blocked { key: string; line: number; message: string }

export interface PlanInput {
  rows: Row[]
  choices: Map<string, Choice>
  data: InflowData
  features: Features
  profile: TaxProfile
  /** Lei per unit by `${currency}|${date}`. Missing means not known: the row waits. */
  rates: Map<string, number>
  batch: string
  counterpartyOf?: (row: Row) => string
  suggestReserve?: SuggestReserve
}

export interface Plan {
  ops: Op[]
  /** Rows that will not be imported this time, with why. Not remembered: they come back next time. */
  blocked: Blocked[]
  /** Counted per currency, in the transaction's currency. */
  totals: { income: Record<string, number>; recovery: Record<string, number>; costs: Record<string, number>; fees: Record<string, number>; refunds: Record<string, number> }
  counts: { records: number; costs: number; refunds: number; linked: number; received: number; setAside: number; waiting: number; alreadyIn: number; never: number }
}

export const rateKey = (currency: Currency, date: string) => `${currency}|${date}`

/** Why this row can't be imported as chosen, or null. Shown on the row; the same check the plan makes. */
export function blocker(row: Row, c: Choice, data: InflowData, features: Features): string | null {
  if (row.locked) return row.locked
  if (row.match.status === 'exact' && !c.anyway) return null
  if (c.action === 'skip') return c.kind === 'review' ? 'Needs a decision: say what this is, or leave it out.' : null
  if (c.kind === 'review') return 'Needs a decision: say what this is, or leave it out.'
  if (c.kind === 'refundReceived') return 'InFlow has nowhere to put money a supplier paid back yet. Leave it out, or adjust the cost by hand.'
  if (row.tx.currency !== 'RON' && !features.currencies) return `Foreign currencies are off. Turn them on in Settings to import ${row.tx.currency}.`
  if ((c.kind === 'cost' || c.kind === 'fee') && !features.costs) return 'Costs are off. Turn on Track costs in Settings to import costs.'
  if (c.kind === 'refundIssued' && !features.refunds) return 'Refunds are off. Turn them on in Settings to import a refund.'
  if (c.action === 'receive' && !features.expected) return 'Expected payments are off.'
  if (row.match.status === 'possible' && c.action === 'import' && !c.anyway) return 'This may already be in InFlow: link it, leave it out, or import it anyway.'
  if (c.action === 'link') {
    if (!c.target) return 'Pick the entry this transaction is.'
    const pool = row.tx.direction === 'in' ? data.records : [...data.costs, ...data.refunds]
    if (!pool.some((x) => x.id === c.target)) return 'The entry to link to is no longer there.'
    return null
  }
  if (c.action === 'receive') {
    const e = data.records.find((r) => r.id === c.target && r.status === 'expected')
    if (!e) return 'Pick the expected payment this money settles.'
    if (e.currency !== row.tx.currency) return `That payment is expected in ${e.currency}; this is ${row.tx.currency}.`
    if (row.tx.amount > e.amount + 0.005) return 'More than is expected: import it as a new payment, or edit the expected one first.'
    return null
  }
  if (row.tx.direction === 'in' && !['income', 'recovery'].includes(c.kind)) return 'Money in can be income or money back for a cost.'
  if (row.tx.direction === 'out' && !['cost', 'fee', 'refundIssued'].includes(c.kind)) return 'Money out can be a cost, a bank fee or a refund to a client.'
  if (c.kind === 'refundIssued' && !c.paymentId) return "Pick the client's payment this refunds."
  return null
}

const add = (m: Record<string, number>, k: string, v: number) => { m[k] = round2((m[k] ?? 0) + v) }

export function buildPlan(p: PlanInput): Plan {
  const ops: Op[] = []
  const blocked: Blocked[] = []
  const totals: Plan['totals'] = { income: {}, recovery: {}, costs: {}, fees: {}, refunds: {} }
  const counts: Plan['counts'] = { records: 0, costs: 0, refunds: 0, linked: 0, received: 0, setAside: 0, waiting: 0, alreadyIn: 0, never: 0 }
  // Refunds planned in this batch count against what is left to refund on the payment.
  const refundsSoFar: Refund[] = [...p.data.refunds]
  // Expected payments as this batch leaves them, so two rows can't both settle all of one.
  const expectedNow = new Map(p.data.records.filter((r) => r.status === 'expected').map((r) => [r.id, r]))

  for (const row of p.rows) {
    const { tx } = row
    const c = p.choices.get(tx.key) ?? row.suggestion
    const meta = { key: tx.key, batch: p.batch, counterparty: (p.counterpartyOf?.(row) ?? tx.counterparty).slice(0, 200) }
    if (row.locked) { counts.never++; continue }
    if (row.match.status === 'exact' && !c.anyway) { counts.alreadyIn++; continue }
    const why = blocker(row, c, p.data, p.features)
    if (why) { blocked.push({ key: tx.key, line: tx.line, message: why }); counts.waiting++; continue }
    if (c.action === 'skip' || SET_ASIDE.includes(c.kind)) { ops.push({ op: 'skip', key: tx.key, kind: c.kind }); counts.setAside++; continue }

    if (c.action === 'link') {
      const kind = p.data.records.some((r) => r.id === c.target) ? 'record' : p.data.costs.some((x) => x.id === c.target) ? 'cost' : 'refund'
      ops.push({ op: 'link', key: tx.key, kind: c.kind, counterparty: meta.counterparty, target: { kind, id: c.target! } })
      counts.linked++
      continue
    }

    const fxRate = tx.currency === 'RON' ? 1 : p.rates.get(rateKey(tx.currency, tx.date))
    if (!fxRate) { blocked.push({ key: tx.key, line: tx.line, message: `No ${tx.currency} rate for ${tx.date} yet: try again when online.` }); counts.waiting++; continue }

    if (c.action === 'receive') {
      const e = expectedNow.get(c.target!)
      if (!e || tx.amount > e.amount + 0.005) { blocked.push({ key: tx.key, line: tx.line, message: 'Another row in this import already settles that expected payment.' }); counts.waiting++; continue }
      const r = receive(e, { amount: tx.amount, date: tx.date, fxRate }, p.features.tax ? p.suggestReserve : undefined)
      ops.push({ op: 'receive', key: tx.key, kind: c.kind, expectedId: e.id, received: { ...r.received, importMeta: meta }, remaining: r.remaining })
      if (r.remaining) expectedNow.set(e.id, r.remaining); else expectedNow.delete(e.id)
      add(totals.income, tx.currency, tx.amount)
      counts.received++
      continue
    }

    if (c.kind === 'income' || c.kind === 'recovery') {
      const category = c.kind === 'recovery' ? 'reimbursement' : c.category === 'reimbursement' ? null : c.category
      const client = p.data.clients.find((x) => x.id === c.clientId) ?? null
      const source = p.data.sources.find((x) => x.id === c.sourceId) ?? null
      const cls = suggestClassification({ category, client, source }, p.profile)
      const amountRon = toRon(tx.amount, fxRate)
      const record: IncomeRecord = {
        id: '', description: tx.description.trim() || tx.counterparty || 'Imported payment',
        amount: round2(tx.amount), currency: tx.currency, fxRate, amountRon, date: tx.date, status: 'received',
        clientId: c.clientId, sourceId: c.sourceId, venueId: c.venueId, category,
        recurring: false, notes: '', attendees: null,
        // No sessions invented: the payment counts in totals, not in the per-session range, until you say.
        sessions: 0, hours: null,
        taxability: cls.taxability, taxHandling: cls.taxHandling, vat: cls.vat, classification: 'suggested',
        taxReserve: null, reserveSource: null, taxWithheld: 0, taxRules: '',
        repaysCostId: c.kind === 'recovery' ? c.repaysCostId : null,
        importMeta: meta,
      }
      const s = p.features.tax && record.taxability === 'taxable' ? p.suggestReserve?.(record) ?? null : null
      if (s) Object.assign(record, { taxReserve: round2(s.amount), reserveSource: 'suggested', taxRules: s.rulesId })
      ops.push({ op: 'createRecord', key: tx.key, kind: c.kind, record })
      add(c.kind === 'recovery' ? totals.recovery : totals.income, tx.currency, tx.amount)
      counts.records++
      continue
    }

    if (c.kind === 'cost' || c.kind === 'fee') {
      const cost: CostRecord = {
        id: '', description: tx.description.trim() || tx.counterparty || 'Imported cost',
        amount: round2(tx.amount), currency: tx.currency, fxRate, amountRon: toRon(tx.amount, fxRate), date: tx.date, status: 'paid',
        group: c.kind === 'fee' ? 'operating' : c.costGroup, category: c.kind === 'fee' ? 'bank_fees' : c.costCategory,
        venueId: c.venueId, clientId: c.clientId, activity: null, recurring: false, deductible: c.deductible, notes: '',
        importMeta: meta,
      }
      ops.push({ op: 'createCost', key: tx.key, kind: c.kind, cost })
      add(c.kind === 'fee' ? totals.fees : totals.costs, tx.currency, tx.amount)
      counts.costs++
      continue
    }

    if (c.kind === 'refundIssued') {
      const payment = p.data.records.find((r) => r.id === c.paymentId)
      const refund: Refund = { id: '', paymentId: c.paymentId!, date: tx.date, amount: round2(tx.amount), currency: tx.currency, fxRate, amountRon: toRon(tx.amount, fxRate), notes: '', importMeta: meta }
      const err = refundError(refund, payment, refundsSoFar)
      if (err) { blocked.push({ key: tx.key, line: tx.line, message: err }); counts.waiting++; continue }
      refundsSoFar.push({ ...refund, id: `planned:${tx.key}` })
      ops.push({ op: 'createRefund', key: tx.key, kind: c.kind, refund })
      add(totals.refunds, tx.currency, tx.amount)
      counts.refunds++
    }
  }
  return { ops, blocked, totals, counts }
}
