/**
 * P&L, cash flow, margins and break-even, from income records and costs.
 *
 * Cash basis throughout, the way a freelancer actually sees money: income
 * counts when received, a cost when paid. Expected income and due costs stay
 * out of every figure here. Depreciation is the one non-cash line: it is in
 * the P&L and never in cash flow; buying the equipment is the reverse.
 */
import type { CostGroup, CostRecord, IncomeRecord } from '../domain/types'
import { COST_CATEGORY } from '../domain/vocabulary'
import { addDays, addMonths, daysBetween, endOfMonth, monthShort, startOfMonth } from './dates'
import { cashOf, isCostRecovery } from './analytics'
import { round2 } from './money'

export interface Column {
  from: string
  to: string
  label: string
}

/** One column per calendar month touched by the range, clipped to it. */
export function monthColumns(r: { from: string; to: string }): Column[] {
  const out: Column[] = []
  let m = startOfMonth(r.from)
  while (m <= r.to) {
    const from = m < r.from ? r.from : m
    const end = endOfMonth(m)
    const to = end > r.to ? r.to : end
    const sameYear = r.from.slice(0, 4) === r.to.slice(0, 4)
    const name = sameYear ? monthShort(m) : `${monthShort(m)} ${m.slice(2, 4)}`
    // A column holding only part of a month says which days, so a week never reads as all of November.
    const whole = from === m && to === end
    out.push({ from, to, label: whole ? name : from === to ? `${Number(from.slice(8))} ${name}` : `${Number(from.slice(8))}–${Number(to.slice(8))} ${name}` })
    m = addMonths(m, 1)
  }
  return out
}

const inCol = (date: string, c: { from: string; to: string }) => date >= c.from && date <= c.to
const total = (xs: { amountRon: number }[]) => round2(xs.reduce((s, x) => s + x.amountRon, 0))

export function paidCosts(costs: CostRecord[], r: { from: string; to: string }): CostRecord[] {
  return costs.filter((c) => c.status === 'paid' && inCol(c.date, r))
}

export interface PnlLine {
  key: string
  label: string
  kind: 'revenue' | 'recovery' | 'cost' | 'subtotal' | 'detail'
  values: number[]
  total: number
}

export interface Pnl {
  columns: Column[]
  lines: PnlLine[]
  /** The bottom line per column, for the chart and the cards. */
  net: number[]
  revenue: number[]
}

const P_AND_L_GROUPS: CostGroup[] = ['direct', 'operating', 'depreciation', 'interest', 'tax']

export function buildPnl(records: IncomeRecord[], costs: CostRecord[], columns: Column[]): Pnl {
  const got = (c: Column) => records.filter((r) => r.status === 'received' && inCol(r.date, c))
  // Revenue is service revenue; reimbursements come in on their own line (audit B-01).
  const rev = columns.map((c) => total(got(c).filter((r) => !isCostRecovery(r))))
  const recovery = columns.map((c) => total(got(c).filter(isCostRecovery)))
  // Revenue is net of refunds, which are shown beneath it, in the month the money went back.
  const refunded = columns.map((c) => total(got(c).filter((r) => r.refundOf && !isCostRecovery(r))))
  // Tax a payer withheld was paid for you, out of revenue: it is tax paid, and never cash in (audit B-04).
  const withheld = columns.map((c) => round2(got(c).reduce((s, r) => s + (r.taxWithheld || 0), 0)))
  const byGroup = (g: CostGroup) => columns.map((c) => total(paidCosts(costs, c).filter((x) => x.group === g)))
  const details = (g: CostGroup): PnlLine[] => {
    const cats = [...new Set(costs.filter((x) => x.group === g && x.status === 'paid').map((x) => x.category))]
    return cats
      .map((cat) => {
        const values = columns.map((c) => total(paidCosts(costs, c).filter((x) => x.group === g && x.category === cat)))
        return { key: `${g}:${cat}`, label: COST_CATEGORY[cat], kind: 'detail' as const, values, total: sumArr(values) }
      })
      .filter((l) => l.total !== 0)
      .sort((a, b) => b.total - a.total)
  }
  const g = Object.fromEntries(P_AND_L_GROUPS.map((k) => [k, byGroup(k)])) as Record<CostGroup, number[]>
  const minus = (a: number[], b: number[]) => a.map((v, i) => round2(v - b[i]))
  const plus = (a: number[], b: number[]) => a.map((v, i) => round2(v + b[i]))
  const taxPaid = plus(g.tax, withheld)
  // The cost a reimbursement repays stays a direct cost; the money back comes in beside it.
  const gross = plus(minus(rev, g.direct), recovery)
  const ebitda = minus(gross, g.operating)
  const ebit = minus(ebitda, g.depreciation)
  const ebt = minus(ebit, g.interest)
  const net = minus(ebt, taxPaid)
  const withheldLine: PnlLine[] = withheld.some((v) => v !== 0)
    ? [{ key: 'tax:withheld', label: 'Withheld by payers', kind: 'detail', values: withheld, total: sumArr(withheld) }]
    : []
  const line = (key: string, label: string, kind: PnlLine['kind'], values: number[]): PnlLine => ({ key, label, kind, values, total: sumArr(values) })
  const lines: PnlLine[] = [
    line('revenue', 'Revenue', 'revenue', rev),
    ...(refunded.some((v) => v !== 0) ? [{ key: 'revenue:refunds', label: 'of which refunds', kind: 'detail' as const, values: refunded, total: sumArr(refunded) }] : []),
    line('direct', 'Costs of the work (direct, COGS)', 'cost', g.direct),
    ...details('direct'),
    ...(recovery.some((v) => v !== 0) ? [line('recovery', 'Cost recovery (reimbursed)', 'recovery', recovery)] : []),
    line('gross', 'Left after the work’s costs (gross margin)', 'subtotal', gross),
    line('operating', 'Running costs (operating, SG&A)', 'cost', g.operating),
    ...details('operating'),
    line('ebitda', 'Profit before equipment write-off (EBITDA)', 'subtotal', ebitda),
    line('depreciation', 'Equipment written off over its life (depreciation)', 'cost', g.depreciation),
    line('ebit', 'Profit from the work (EBIT)', 'subtotal', ebit),
    line('interest', 'Loan interest', 'cost', g.interest),
    line('ebt', 'Profit before tax', 'subtotal', ebt),
    line('tax', 'Tax paid', 'cost', taxPaid),
    ...withheldLine,
    ...details('tax'),
    line('net', 'Net profit', 'subtotal', net),
  ]
  return { columns, lines, net, revenue: rev }
}

function sumArr(xs: number[]) {
  return round2(xs.reduce((s, v) => s + v, 0))
}

// ── cash flow ───────────────────────────────────────────────────────────────

export interface CashFlowRow {
  key: string
  label: string
  kind: 'balance' | 'in' | 'out' | 'subtotal'
  values: number[]
}

export interface CashFlow {
  columns: Column[]
  rows: CashFlowRow[]
  closing: number[]
  /** True when no opening balance is set and the first column starts at 0. */
  relative: boolean
}

/** Cash moved on days in [from, to]: income received less non-depreciation costs paid. */
function netFlow(records: IncomeRecord[], costs: CostRecord[], from: string, to: string): number {
  if (from > to) return 0
  const r = { from, to }
  // Cash that arrived: withheld tax never did (audit B-04).
  const inflow = round2(records.filter((x) => x.status === 'received' && inCol(x.date, r)).reduce((s, x) => s + cashOf(x), 0))
  const outflow = total(paidCosts(costs, r).filter((x) => x.group !== 'depreciation'))
  return round2(inflow - outflow)
}

/** The cash balance at the start of `date`, from an opening balance taken on `openingDate`. */
export function balanceAt(date: string, records: IncomeRecord[], costs: CostRecord[], opening: number, openingDate: string): number {
  if (date >= openingDate) return round2(opening + netFlow(records, costs, openingDate, addDays(date, -1)))
  return round2(opening - netFlow(records, costs, date, addDays(openingDate, -1)))
}

export function buildCashFlow(records: IncomeRecord[], costs: CostRecord[], columns: Column[], opening: number, openingDate: string): CashFlow {
  const relative = !openingDate
  let start = relative ? 0 : balanceAt(columns[0]?.from ?? '', records, costs, opening, openingDate)
  const rows: Record<string, number[]> = { open: [], in: [], back: [], refunds: [], op: [], inv: [], fin: [], net: [], close: [] }
  for (const c of columns) {
    const pc = paidCosts(costs, c)
    const got = records.filter((r) => r.status === 'received' && inCol(r.date, c))
    // Cash that arrived: withheld tax never did (audit B-04). Reimbursements on their own line.
    // Refunds paid back are money out, on their own line.
    const inn = round2(got.filter((r) => !isCostRecovery(r) && !r.refundOf).reduce((s, r) => s + cashOf(r), 0))
    const back = round2(got.filter((r) => isCostRecovery(r) && !r.refundOf).reduce((s, r) => s + cashOf(r), 0))
    const refunds = round2(-got.filter((r) => r.refundOf).reduce((s, r) => s + cashOf(r), 0))
    const op = total(pc.filter((x) => ['direct', 'operating', 'interest', 'tax'].includes(x.group)))
    const inv = total(pc.filter((x) => x.group === 'investment'))
    const fin = total(pc.filter((x) => x.group === 'financing'))
    const net = round2(inn + back - refunds - op - inv - fin)
    rows.open.push(start)
    rows.in.push(inn)
    rows.back.push(back)
    rows.refunds.push(refunds)
    rows.op.push(op)
    rows.inv.push(inv)
    rows.fin.push(fin)
    rows.net.push(net)
    start = round2(start + net)
    rows.close.push(start)
  }
  return {
    columns,
    relative,
    closing: rows.close,
    rows: [
      { key: 'open', label: 'Cash at start', kind: 'balance', values: rows.open },
      { key: 'in', label: 'Income received (after tax withheld)', kind: 'in', values: rows.in },
      ...(rows.back.some((v) => v !== 0) ? [{ key: 'back', label: 'Cost recovery received', kind: 'in' as const, values: rows.back }] : []),
      ...(rows.refunds.some((v) => v !== 0) ? [{ key: 'refunds', label: 'Refunds paid back', kind: 'out' as const, values: rows.refunds }] : []),
      { key: 'op', label: 'Costs and taxes paid', kind: 'out', values: rows.op },
      { key: 'opnet', label: 'From operations', kind: 'subtotal', values: rows.in.map((v, i) => round2(v + rows.back[i] - rows.refunds[i] - rows.op[i])) },
      { key: 'inv', label: 'Equipment & investments', kind: 'out', values: rows.inv },
      { key: 'fin', label: 'Loan repayments & drawings', kind: 'out', values: rows.fin },
      { key: 'net', label: 'Net change', kind: 'subtotal', values: rows.net },
      { key: 'close', label: 'Cash at end', kind: 'balance', values: rows.close },
    ],
  }
}

// ── break-even ──────────────────────────────────────────────────────────────

export interface BreakEven {
  /** Average monthly operating + interest costs over the last three whole months. */
  fixedPerMonth: number
  /** Share of revenue left after direct costs over the same months (0–1). */
  grossRate: number
  /** Revenue a month needs to cover fixed costs at that gross margin. */
  revenueNeeded: number
  /** Revenue so far this month. */
  thisMonth: number
  covered: number
}

export function breakEven(records: IncomeRecord[], costs: CostRecord[], today: string): BreakEven | null {
  const end = addDays(startOfMonth(today), -1)
  const start = startOfMonth(addMonths(startOfMonth(today), -3))
  const r = { from: start, to: end }
  const pc = paidCosts(costs, r)
  const fixed = total(pc.filter((x) => x.group === 'operating' || x.group === 'interest'))
  const got = records.filter((x) => x.status === 'received' && inCol(x.date, r))
  const rev = total(got.filter((x) => !isCostRecovery(x)))
  if (fixed <= 0 || rev <= 0 || daysBetween(start, end) < 27) return null
  // Direct costs a client paid back don't weigh on the margin.
  const direct = total(pc.filter((x) => x.group === 'direct')) - total(got.filter(isCostRecovery))
  const grossRate = Math.max(0.05, (rev - direct) / rev)
  const fixedPerMonth = round2(fixed / 3)
  const revenueNeeded = round2(fixedPerMonth / grossRate)
  const thisMonth = total(records.filter((x) => x.status === 'received' && !isCostRecovery(x) && inCol(x.date, { from: startOfMonth(today), to: today })))
  return { fixedPerMonth, grossRate, revenueNeeded, thisMonth, covered: revenueNeeded > 0 ? thisMonth / revenueNeeded : 0 }
}

/** Deductible costs paid in a year up to `upTo`, for the tax estimate. */
export function deductibleCosts(costs: CostRecord[], year: number, upTo?: string): number {
  return total(costs.filter((c) => c.status === 'paid' && c.deductible && c.date.startsWith(String(year)) && (!upTo || c.date <= upTo)
    && (c.group === 'direct' || c.group === 'operating' || c.group === 'depreciation' || c.group === 'interest')))
}

/**
 * Recurring costs paid last month and not yet recorded this month, once their
 * usual day has passed: rent, software, the accountant. One copy of each, the
 * latest, so the form opens filled in.
 */
export function recurringCostsMissing(costs: CostRecord[], today: string): CostRecord[] {
  const thisMonth = today.slice(0, 7)
  const lastMonth = addMonths(startOfMonth(today), -1).slice(0, 7)
  const key = (c: CostRecord) => `${c.category}|${c.description.trim().toLowerCase()}`
  const seenNow = new Set(costs.filter((c) => c.date.startsWith(thisMonth)).map(key))
  const latest = new Map<string, CostRecord>()
  for (const c of costs) {
    if (!c.recurring || c.status !== 'paid' || !c.date.startsWith(lastMonth) || seenNow.has(key(c))) continue
    const cur = latest.get(key(c))
    if (!cur || c.date > cur.date) latest.set(key(c), c)
  }
  return [...latest.values()]
    .filter((c) => Number(c.date.slice(8, 10)) <= Number(today.slice(8, 10)))
    .sort((a, b) => b.amountRon - a.amountRon)
}

export type ReimbursedState = 'partial' | 'full'

/**
 * How much of each cost has come back, from the received reimbursements that name it (Release 1):
 * "Reimbursed" only once they cover it, "Partly reimbursed" before that. Several reimbursements
 * add up; refunds of a reimbursement (adjustment rows, which keep the link) take it back off.
 * Read from the books, so pass `withRefunds(data).records`.
 */
export function reimbursedCosts(costs: CostRecord[], records: IncomeRecord[]): Map<string, { recovered: number; state: ReimbursedState }> {
  const back = new Map<string, number>()
  for (const r of records) {
    if (r.status !== 'received' || !r.repaysCostId) continue
    back.set(r.repaysCostId, (back.get(r.repaysCostId) ?? 0) + r.amountRon)
  }
  const out = new Map<string, { recovered: number; state: ReimbursedState }>()
  for (const c of costs) {
    const got = round2(back.get(c.id) ?? 0)
    if (got <= 0) continue
    out.set(c.id, { recovered: got, state: got >= c.amountRon - 0.5 ? 'full' : 'partial' })
  }
  return out
}
