/**
 * P&L, cash flow, margins and break-even, from income records and costs.
 *
 * Cash basis throughout, the way a freelancer actually sees money: income
 * counts when received, a cost when paid. Expected income and due costs stay
 * out of every figure here. Depreciation is the one non-cash line: it is in
 * the P&L and never in cash flow; buying the equipment is the reverse.
 */
import type { CostGroup, CostRecord, IncomeRecord, InflowData } from '../domain/types'
import { COST_CATEGORY } from '../domain/vocabulary'
import { keyOf, nameOf, NO_ENTITY, type Dimension } from './analytics'
import { addDays, addMonths, daysBetween, endOfMonth, monthShort, startOfMonth } from './dates'
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
    out.push({ from, to, label: sameYear ? monthShort(m) : `${monthShort(m)} ${m.slice(2, 4)}` })
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
  kind: 'revenue' | 'cost' | 'subtotal' | 'detail'
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
  const rev = columns.map((c) => total(records.filter((r) => r.status === 'received' && inCol(r.date, c))))
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
  const gross = minus(rev, g.direct)
  const ebitda = minus(gross, g.operating)
  const ebit = minus(ebitda, g.depreciation)
  const ebt = minus(ebit, g.interest)
  const net = minus(ebt, g.tax)
  const line = (key: string, label: string, kind: PnlLine['kind'], values: number[]): PnlLine => ({ key, label, kind, values, total: sumArr(values) })
  const lines: PnlLine[] = [
    line('revenue', 'Revenue', 'revenue', rev),
    line('direct', 'Direct costs (COGS)', 'cost', g.direct),
    ...details('direct'),
    line('gross', 'Gross margin', 'subtotal', gross),
    line('operating', 'Operating costs (SG&A)', 'cost', g.operating),
    ...details('operating'),
    line('ebitda', 'EBITDA', 'subtotal', ebitda),
    line('depreciation', 'Depreciation', 'cost', g.depreciation),
    line('ebit', 'Operating profit (EBIT)', 'subtotal', ebit),
    line('interest', 'Interest', 'cost', g.interest),
    line('ebt', 'Profit before tax', 'subtotal', ebt),
    line('tax', 'Tax paid', 'cost', g.tax),
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
  const inflow = total(records.filter((x) => x.status === 'received' && inCol(x.date, r)))
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
  const rows: Record<string, number[]> = { open: [], in: [], op: [], inv: [], fin: [], net: [], close: [] }
  for (const c of columns) {
    const pc = paidCosts(costs, c)
    const inn = total(records.filter((r) => r.status === 'received' && inCol(r.date, c)))
    const op = total(pc.filter((x) => ['direct', 'operating', 'interest', 'tax'].includes(x.group)))
    const inv = total(pc.filter((x) => x.group === 'investment'))
    const fin = total(pc.filter((x) => x.group === 'financing'))
    const net = round2(inn - op - inv - fin)
    rows.open.push(start)
    rows.in.push(inn)
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
      { key: 'in', label: 'Income received', kind: 'in', values: rows.in },
      { key: 'op', label: 'Costs and taxes paid', kind: 'out', values: rows.op },
      { key: 'opnet', label: 'From operations', kind: 'subtotal', values: rows.in.map((v, i) => round2(v - rows.op[i])) },
      { key: 'inv', label: 'Equipment & investments', kind: 'out', values: rows.inv },
      { key: 'fin', label: 'Loan repayments & drawings', kind: 'out', values: rows.fin },
      { key: 'net', label: 'Net change', kind: 'subtotal', values: rows.net },
      { key: 'close', label: 'Cash at end', kind: 'balance', values: rows.close },
    ],
  }
}

// ── margins per dimension ───────────────────────────────────────────────────

export interface MarginRow {
  id: string
  name: string
  revenue: number
  costs: number
  margin: number
  /** margin ÷ revenue; null without revenue. */
  marginRate: number | null
  engagements: number
  revenuePerEngagement: number
}

/**
 * Revenue less the direct and operating costs linked to each venue, client or
 * activity. Costs not linked to anything stay out (they are overheads), and a
 * source can't carry costs, so for sources this is revenue only.
 */
export function margins(data: Pick<InflowData, 'clients' | 'sources' | 'venues'>, records: IncomeRecord[], costs: CostRecord[], r: { from: string; to: string }, dim: Dimension): MarginRow[] {
  const rec = records.filter((x) => x.status === 'received' && inCol(x.date, r))
  const cst = paidCosts(costs, r).filter((x) => x.group === 'direct' || x.group === 'operating')
  const costKey = (c: CostRecord) => {
    const id = dim === 'client' ? c.clientId : dim === 'venue' ? c.venueId : dim === 'activity' ? c.activity : null
    return id ?? NO_ENTITY
  }
  const keys = new Set([...rec.map((x) => keyOf(x, dim)), ...cst.map(costKey).filter((k) => k !== NO_ENTITY)])
  return [...keys].map((id) => {
    const rs = rec.filter((x) => keyOf(x, dim) === id)
    const revenue = total(rs)
    const c = id === NO_ENTITY ? 0 : total(cst.filter((x) => costKey(x) === id))
    const margin = round2(revenue - c)
    return {
      id, name: nameOf(data, dim, id), revenue, costs: c, margin,
      marginRate: revenue > 0 ? margin / revenue : null,
      engagements: rs.length,
      revenuePerEngagement: rs.length ? round2(revenue / rs.length) : 0,
    }
  }).sort((a, b) => b.margin - a.margin || a.name.localeCompare(b.name))
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
  const rev = total(records.filter((x) => x.status === 'received' && inCol(x.date, r)))
  if (fixed <= 0 || rev <= 0 || daysBetween(start, end) < 27) return null
  const direct = total(pc.filter((x) => x.group === 'direct'))
  const grossRate = Math.max(0.05, (rev - direct) / rev)
  const fixedPerMonth = round2(fixed / 3)
  const revenueNeeded = round2(fixedPerMonth / grossRate)
  const thisMonth = total(records.filter((x) => x.status === 'received' && inCol(x.date, { from: startOfMonth(today), to: today })))
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
