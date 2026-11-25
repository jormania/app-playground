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
import { inRange, type Bucket } from './period'

export type Dimension = 'client' | 'source' | 'venue' | 'activity'

export function received(records: IncomeRecord[], r: { from: string; to: string }): IncomeRecord[] {
  return records.filter((x) => x.status === 'received' && inRange(x.date, r))
}

export const sum = (rs: IncomeRecord[], pick: (r: IncomeRecord) => number = (r) => r.amountRon) =>
  round2(rs.reduce((s, r) => s + (pick(r) || 0), 0))

export interface PeriodSummary {
  total: number
  count: number
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

export function summarise(rs: IncomeRecord[]): PeriodSummary {
  const total = sum(rs)
  const by = (f: (r: IncomeRecord) => boolean) => sum(rs.filter(f))
  const reserve = sum(rs, (r) => r.taxReserve ?? 0)
  const taxWithheld = sum(rs, (r) => r.taxWithheld)
  return {
    total,
    count: rs.length,
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
      return {
        id,
        name: nameOf(data, dim, id),
        total: t,
        count: list.length,
        share: total > 0 ? t / total : 0,
        average: list.length ? round2(t / list.length) : 0,
        previous: prevTotals.get(id) ?? 0,
      }
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
}

export const NO_ENTITY = NONE

/** Sum per chart bucket. */
export function series(records: IncomeRecord[], bs: Bucket[]): number[] {
  return bs.map((b) => sum(records.filter((r) => r.status === 'received' && r.date >= b.from && r.date <= b.to)))
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

export interface Pivot {
  cols: { id: string; name: string }[]
  rows: { id: string; name: string; cells: number[]; total: number }[]
  colTotals: number[]
}

/**
 * Rows by one dimension, columns by another: "which activity at which venue".
 * The largest `maxCols` columns are kept and the rest fold into "Other".
 */
export function pivot(data: Pick<InflowData, 'clients' | 'sources' | 'venues'>, rs: IncomeRecord[], rowDim: Dimension, colDim: Dimension, maxCols = 4): Pivot {
  const colTotals = new Map<string, number>()
  for (const r of rs) colTotals.set(keyOf(r, colDim), (colTotals.get(keyOf(r, colDim)) ?? 0) + r.amountRon)
  const ranked = [...colTotals.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  const keep = ranked.slice(0, maxCols)
  const hasOther = ranked.length > maxCols
  const OTHER = '__other__'
  const colOf = (r: IncomeRecord) => (keep.includes(keyOf(r, colDim)) ? keyOf(r, colDim) : OTHER)
  const cols = [...keep.map((id) => ({ id, name: nameOf(data, colDim, id) })), ...(hasOther ? [{ id: OTHER, name: 'Other' }] : [])]
  const rowMap = new Map<string, number[]>()
  for (const r of rs) {
    const k = keyOf(r, rowDim)
    const cells = rowMap.get(k) ?? cols.map(() => 0)
    cells[cols.findIndex((c) => c.id === colOf(r))] += r.amountRon
    rowMap.set(k, cells)
  }
  const rows = [...rowMap.entries()]
    .map(([id, cells]) => ({ id, name: nameOf(data, rowDim, id), cells: cells.map(round2), total: round2(cells.reduce((a, b) => a + b, 0)) }))
    .sort((a, b) => b.total - a.total)
  return { cols, rows, colTotals: cols.map((_, i) => round2(rows.reduce((s, r) => s + r.cells[i], 0))) }
}
