/**
 * Every figure on the dashboard and in the reports, computed from the records.
 * Nothing here is stored; change a record and every number follows.
 *
 * "Income" means received payments. Expected ones are counted separately as
 * outstanding and never inflate a total.
 */
import type { Category, IncomeRecord, InflowData } from '../domain/types'
import { CATEGORY } from '../domain/vocabulary'
import { round2 } from './money'
import { addDays, addMonths } from './dates'
import { inRange, type Bucket } from './period'

export type Dimension = 'client' | 'source' | 'venue' | 'activity'

export function received(records: IncomeRecord[], r: { from: string; to: string }): IncomeRecord[] {
  return records.filter((x) => x.status === 'received' && inRange(x.date, r))
}

/**
 * The three kinds of money in (audit B-01), used the same way on every screen, report and export:
 *  - **service revenue**: received payments for work, everything but reimbursements;
 *  - **cost recovery**: reimbursements, money back for a cost paid on a client's behalf. Shown on
 *    its own line, never as revenue, margin or earnings; the cost it repays stays a cost;
 *  - **cash received**: both, less tax the payer withheld (that never reached you).
 * Taxability is its own question: a reimbursement is not assumed non-taxable for being one.
 */
export const isCostRecovery = (r: Pick<IncomeRecord, 'category'>): boolean => r.category === 'reimbursement'
/** Service revenue only: what the work earned. */
export const earned = <T extends Pick<IncomeRecord, 'category'>>(rs: T[]): T[] => rs.filter((r) => !isCostRecovery(r))
/** Cost recovery only. */
export const recovered = <T extends Pick<IncomeRecord, 'category'>>(rs: T[]): T[] => rs.filter(isCostRecovery)
/** What actually arrived from one received payment: its amount in lei less tax withheld at source. */
export const cashOf = (r: Pick<IncomeRecord, 'amountRon' | 'taxWithheld'>): number => r.amountRon - (r.taxWithheld || 0)

export const sum = (rs: IncomeRecord[], pick: (r: IncomeRecord) => number = (r) => r.amountRon) =>
  round2(rs.reduce((s, r) => s + (pick(r) || 0), 0))

export interface PeriodSummary {
  /** Service revenue: received payments for work, cost recovery excluded. */
  total: number
  /** Payments counted in `total`. */
  count: number
  /** Reimbursements received in the period: shown apart, never counted as revenue. */
  costRecovery: number
  /** All money received before tax withheld: `total + costRecovery`. */
  receivedGross: number
  /** What actually arrived: `receivedGross` less tax withheld at source. */
  cashIn: number
  taxable: number
  nonTaxable: number
  review: number
  withheld: number
  selfDeclared: number
  /** Stored reserves on the period's records (what you set aside), RON. */
  reserve: number
  /** Tax actually withheld or paid on the period's records, RON. */
  taxWithheld: number
  /** total − reserve − taxWithheld. */
  net: number
}

/**
 * A period's figures from its received service payments and, separately, its cost recovery.
 * The tax split (taxable, non-taxable, review) and the tax amounts cover both: taxability is
 * decided per payment, whatever its kind.
 */
export function summarise(service: IncomeRecord[], recovery: IncomeRecord[] = []): PeriodSummary {
  const total = sum(service)
  const costRecovery = sum(recovery)
  const rs = [...service, ...recovery]
  const by = (f: (r: IncomeRecord) => boolean) => sum(rs.filter(f))
  const reserve = sum(rs, (r) => r.taxReserve ?? 0)
  const taxWithheld = sum(rs, (r) => r.taxWithheld)
  return {
    total,
    // Refund adjustments change the money, not the number of payments.
    count: service.filter((r) => !r.refundOf).length,
    costRecovery,
    receivedGross: round2(total + costRecovery),
    cashIn: round2(total + costRecovery - taxWithheld),
    taxable: by((r) => r.taxability === 'taxable'),
    nonTaxable: by((r) => r.taxability === 'non_taxable'),
    review: by((r) => r.taxability === 'review'),
    withheld: by((r) => r.taxability === 'taxable' && r.taxHandling === 'withheld'),
    selfDeclared: by((r) => r.taxability === 'taxable' && r.taxHandling === 'self_declared'),
    reserve,
    taxWithheld,
    net: round2(total - reserve - taxWithheld),
  }
}

export interface BreakdownRow {
  id: string
  name: string
  total: number
  count: number
  share: number
  average: number
  previous: number
}

const NONE = '__none__'

export function keyOf(r: Pick<IncomeRecord, 'clientId' | 'sourceId' | 'venueId' | 'category'>, dim: Dimension): string {
  const id = dim === 'client' ? r.clientId : dim === 'source' ? r.sourceId : dim === 'venue' ? r.venueId : r.category
  return id ?? NONE
}

export const DIMENSION_NOUN: Record<Dimension, string> = { client: 'Client', source: 'Source', venue: 'Venue', activity: 'Activity' }

export function nameOf(data: Pick<InflowData, 'clients' | 'sources' | 'venues'>, dim: Dimension, id: string): string {
  if (id === NONE) return dim === 'client' ? 'No client' : dim === 'source' ? 'No source' : dim === 'venue' ? 'No venue' : 'No activity'
  if (dim === 'activity') return CATEGORY[id as Category] ?? id
  const list = dim === 'client' ? data.clients : dim === 'source' ? data.sources : data.venues
  return list.find((x) => x.id === id)?.name ?? 'Deleted'
}

/** The four scope filters reports share: '' = any, NO_ENTITY = not set. */
export interface Scope {
  clientId: string
  sourceId: string
  venueId: string
  activity: string
}

export const ANY_SCOPE: Scope = { clientId: '', sourceId: '', venueId: '', activity: '' }

export function inScope(r: Pick<IncomeRecord, 'clientId' | 'sourceId' | 'venueId' | 'category'>, s: Scope): boolean {
  const m = (field: string | null, want: string) => !want || (want === NONE ? !field : field === want)
  return m(r.clientId, s.clientId) && m(r.sourceId, s.sourceId) && m(r.venueId, s.venueId) && m(r.category, s.activity)
}

export function scopeIsSet(s: Scope): boolean {
  return !!(s.clientId || s.sourceId || s.venueId || s.activity)
}

/** Totals per client, source or venue, largest first, with the previous period beside each. */
export function breakdown(data: Pick<InflowData, 'clients' | 'sources' | 'venues'>, rs: IncomeRecord[], prev: IncomeRecord[], dim: Dimension): BreakdownRow[] {
  const total = sum(rs)
  const groups = new Map<string, IncomeRecord[]>()
  for (const r of rs) {
    const k = keyOf(r, dim)
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  const prevTotals = new Map<string, number>()
  for (const r of prev) prevTotals.set(keyOf(r, dim), round2((prevTotals.get(keyOf(r, dim)) ?? 0) + r.amountRon))
  return [...groups.entries()]
    .map(([id, list]) => {
      const t = sum(list)
      const n = list.filter((r) => !r.refundOf).length
      return {
        id,
        name: nameOf(data, dim, id),
        total: t,
        count: n,
        share: total > 0 ? t / total : 0,
        average: n ? round2(t / n) : 0,
        previous: prevTotals.get(id) ?? 0,
      }
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
}

export const NO_ENTITY = NONE

/** Sum per chart bucket. */
/** Service revenue per bucket, for the trend chart. */
export function series(records: IncomeRecord[], bs: Bucket[]): number[] {
  return bs.map((b) => sum(records.filter((r) => r.status === 'received' && !isCostRecovery(r) && r.date >= b.from && r.date <= b.to)))
}

export interface Concentration {
  name: string
  share: number
  level: 'healthy' | 'watch' | 'high'
}

/** How much of the period rests on the largest client. */
export function concentration(rows: BreakdownRow[]): Concentration | null {
  const top = rows.find((r) => r.id !== NONE)
  if (!top || rows.length === 0) return null
  const level = top.share >= 0.5 ? 'high' : top.share >= 0.3 ? 'watch' : 'healthy'
  return { name: top.name, share: top.share, level }
}

function median(ns: number[]): number {
  if (!ns.length) return 0
  const s = [...ns].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * Ids of unusually large payments: at least `multiple` × the median received
 * payment, and out of line for that client too (1.5× their own median), so a
 * big monthly retainer isn't "unusual" every month. Needs a handful of records
 * before it will call anything unusual.
 */
export function largeRecordIds(records: IncomeRecord[], multiple: number): Set<string> {
  const rs = records.filter((r) => r.status === 'received' && r.amountRon > 0)
  if (rs.length < 6 || multiple <= 1) return new Set()
  const m = median(rs.map((r) => r.amountRon))
  const byClient = new Map<string, number[]>()
  for (const r of rs) if (r.clientId) byClient.set(r.clientId, [...(byClient.get(r.clientId) ?? []), r.amountRon])
  return new Set(rs.filter((r) => {
    if (r.amountRon < m * multiple) return false
    const own = r.clientId ? byClient.get(r.clientId) ?? [] : []
    return own.length < 3 || r.amountRon >= median(own) * 1.5
  }).map((r) => r.id))
}

export interface Outstanding {
  total: number
  count: number
  overdue: number
  records: IncomeRecord[]
}

export function outstanding(records: IncomeRecord[], today: string): Outstanding {
  const rs = records.filter((r) => r.status === 'expected').sort((a, b) => a.date.localeCompare(b.date))
  return { total: sum(rs), count: rs.length, overdue: rs.filter((r) => r.date < today).length, records: rs }
}

export interface ExpectedSuggestion {
  /** Client and suggested date: stable, so a dismissal sticks. */
  key: string
  date: string
  /** The recurring payment it repeats. */
  from: IncomeRecord
}

/**
 * Next month's payment from each client paid on a recurring basis, where
 * nothing is expected from them yet: the last recurring payment, one month
 * on, same amount. Only dates from a week ago to six weeks ahead; older ones
 * mean the client has gone quiet, which is an insight, not a suggestion.
 */
export function suggestExpected(records: IncomeRecord[], today: string, dismissed: ReadonlySet<string> = new Set()): ExpectedSuggestion[] {
  const last = new Map<string, IncomeRecord>()
  const waiting = new Set<string>()
  const latest = new Map<string, string>()
  for (const r of records) {
    if (!r.clientId) continue
    if (r.status === 'expected') { waiting.add(r.clientId); continue }
    if (r.date > (latest.get(r.clientId) ?? '')) latest.set(r.clientId, r.date)
    if (!r.recurring) continue
    const cur = last.get(r.clientId)
    if (!cur || r.date > cur.date) last.set(r.clientId, r)
  }
  const out: ExpectedSuggestion[] = []
  for (const [client, r] of last) {
    if (waiting.has(client)) continue
    const date = addMonths(r.date, 1)
    // Paid again since (a top-up, a one-off): the month's payment may already be in.
    if ((latest.get(client) ?? '') > r.date && (latest.get(client) ?? '') >= addDays(date, -20)) continue
    if (date < addDays(today, -7) || date > addDays(today, 42)) continue
    const key = `${client}:${date}`
    if (!dismissed.has(key)) out.push({ key, date, from: r })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** A suggestion as an expected record, ready to save. */
export function asExpected(s: ExpectedSuggestion): IncomeRecord {
  return { ...s.from, id: '', status: 'expected', date: s.date, notes: '', taxReserve: null, reserveSource: null, taxWithheld: 0 }
}

/** Per-client totals across all time, with the most recent payment. */
export function clientStats(records: IncomeRecord[]): Map<string, { total: number; last: string | null; count: number }> {
  const out = new Map<string, { total: number; last: string | null; count: number }>()
  for (const r of records) {
    if (r.status !== 'received' || !r.clientId) continue
    const cur = out.get(r.clientId) ?? { total: 0, last: null, count: 0 }
    cur.total = round2(cur.total + r.amountRon)
    cur.count += 1
    if (!cur.last || r.date > cur.last) cur.last = r.date
    out.set(r.clientId, cur)
  }
  return out
}

