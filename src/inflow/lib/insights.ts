/**
 * Insights for someone finding their feet: a heat map of where the money is
 * best, and a short list of pain points and wins in plain words — the
 * sessions that cost more than they earned, the client drifting away, the
 * work that leaves little after costs, the room that needs more people.
 *
 * Every insight is computed from the records; nothing is a canned tip.
 */
import type { IncomeRecord, InflowData } from '../domain/types'
import { keyOf, nameOf, type Dimension } from './analytics'
import { addMonths, monthShort, startOfMonth, endOfMonth } from './dates'
import { venueCosts, venueDeals } from './deals'
import { lei, percent, round2 } from './money'

// ── take-home per record ────────────────────────────────────────────────────

/**
 * What each received payment left you: income less its venue's deal cost
 * (with deals on) and less direct costs linked to the same venue on the same
 * day (with costs on). Venue hire and platform fees recorded as costs are
 * skipped when deals are on, so a room is never counted twice.
 */
export function takeHome(data: InflowData, opts: { deals: boolean; costs: boolean }): Map<string, number> {
  const venue = opts.deals ? venueCosts(data.records, data.venues) : new Map<string, number>()
  const linked = new Map<string, number>()
  if (opts.costs) {
    for (const c of data.costs) {
      if (c.status !== 'paid' || c.group !== 'direct' || !c.venueId) continue
      if (opts.deals && (c.category === 'venue_hire' || c.category === 'platform_fees')) continue
      const k = `${c.venueId}|${c.date}`
      linked.set(k, (linked.get(k) ?? 0) + c.amountRon)
    }
  }
  // Same-day linked costs are shared across that venue's payments that day.
  const sameDay = new Map<string, number>()
  for (const r of data.records) if (r.status === 'received' && r.venueId) sameDay.set(`${r.venueId}|${r.date}`, (sameDay.get(`${r.venueId}|${r.date}`) ?? 0) + 1)
  const out = new Map<string, number>()
  for (const r of data.records) {
    if (r.status !== 'received') continue
    const k = `${r.venueId}|${r.date}`
    const direct = r.venueId ? (linked.get(k) ?? 0) / (sameDay.get(k) ?? 1) : 0
    out.set(r.id, round2(r.amountRon - (venue.get(r.id) ?? 0) - direct))
  }
  return out
}

// ── heat map ────────────────────────────────────────────────────────────────

export type HeatMeasure = 'income' | 'perSession' | 'take' | 'takePerSession'
export type HeatAxis = Dimension | 'month'

export const HEAT_MEASURE_LABEL: Record<HeatMeasure, string> = {
  income: 'Total income',
  perSession: 'Income per session',
  take: 'Total kept',
  takePerSession: 'Kept per session',
}

export interface HeatCell { value: number; count: number }
export interface HeatMap {
  rows: { id: string; name: string; total: number }[]
  cols: { id: string; name: string }[]
  cells: (HeatCell | null)[][]
  min: number
  max: number
}

function monthKeys(r: { from: string; to: string }): string[] {
  const out: string[] = []
  for (let m = startOfMonth(r.from); m <= r.to; m = addMonths(m, 1)) out.push(m.slice(0, 7))
  return out
}

export function heatMap(
  data: InflowData,
  r: { from: string; to: string },
  rowDim: Dimension,
  colAxis: HeatAxis,
  measure: HeatMeasure,
  take: Map<string, number>,
  maxRows = 8,
  maxCols = 8,
): HeatMap {
  const rs = data.records.filter((x) => x.status === 'received' && x.date >= r.from && x.date <= r.to && x.category !== 'reimbursement')
  const colKey = (x: IncomeRecord) => (colAxis === 'month' ? x.date.slice(0, 7) : keyOf(x, colAxis))
  const val = (x: IncomeRecord) => (measure === 'take' || measure === 'takePerSession' ? take.get(x.id) ?? x.amountRon : x.amountRon)
  const perSession = measure === 'perSession' || measure === 'takePerSession'

  const rowTotals = new Map<string, number>()
  for (const x of rs) rowTotals.set(keyOf(x, rowDim), (rowTotals.get(keyOf(x, rowDim)) ?? 0) + x.amountRon)
  const rows = [...rowTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxRows)
    .map(([id, total]) => ({ id, name: nameOf(data, rowDim, id), total: round2(total) }))

  let colIds: string[]
  if (colAxis === 'month') colIds = monthKeys(r).slice(-12)
  else {
    const colTotals = new Map<string, number>()
    for (const x of rs) colTotals.set(colKey(x), (colTotals.get(colKey(x)) ?? 0) + x.amountRon)
    colIds = [...colTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxCols).map(([id]) => id)
  }
  const cols = colIds.map((id) => ({ id, name: colAxis === 'month' ? `${monthShort(`${id}-01`)}${colIds.length > 12 ? ` ${id.slice(2, 4)}` : ''}` : nameOf(data, colAxis, id) }))

  let min = Infinity
  let max = -Infinity
  const cells = rows.map((row) => cols.map((col) => {
    const xs = rs.filter((x) => keyOf(x, rowDim) === row.id && colKey(x) === col.id)
    if (!xs.length) return null
    const total = xs.reduce((a, x) => a + val(x), 0)
    const value = round2(perSession ? total / xs.length : total)
    min = Math.min(min, value)
    max = Math.max(max, value)
    return { value, count: xs.length }
  }))
  return { rows, cols, cells, min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 0 }
}

// ── pain points and wins ────────────────────────────────────────────────────

export type InsightKind = 'pain' | 'win' | 'tip'

export interface Insight {
  id: string
  kind: InsightKind
  title: string
  detail: string
  /** Rough size of what's at stake, lei, for ordering. */
  weight: number
  /** Where to look next. */
  link?: { label: string; hash: string }
}

export interface InsightOptions {
  deals: boolean
  costs: boolean
  expected: boolean
}

const sum = (xs: { amountRon: number }[]) => round2(xs.reduce((a, x) => a + x.amountRon, 0))

export function insights(data: InflowData, r: { from: string; to: string }, today: string, opts: InsightOptions): Insight[] {
  const out: Insight[] = []
  const rec = data.records.filter((x) => x.status === 'received')
  const inR = rec.filter((x) => x.date >= r.from && x.date <= r.to)
  const total = sum(inR)

  // Venue deals: sessions that cost more than they earned, rooms that need fuller sessions.
  if (opts.deals) {
    for (const d of venueDeals(data.venues, data.records, r)) {
      const v = d.venue
      if (d.losing.length) {
        out.push({
          id: `losing-${v.id}`, kind: 'pain', weight: d.lost * 3,
          title: `${d.losing.length} ${d.losing.length === 1 ? 'session' : 'sessions'} at ${v.name} cost more than ${d.losing.length === 1 ? 'it' : 'they'} earned`,
          detail: `The ${v.deal === 'monthly' ? 'rent' : 'fee'} is paid whoever comes; those sessions lost ${lei(d.lost)} together.${d.breakEvenAttendees ? ` A session there needs ${d.breakEvenAttendees} people to cover the room.` : ''} A minimum sign-up before booking, or a share deal, would take the risk off you.`,
          link: { label: 'Venue deals', hash: '#/reports/deals' },
        })
      } else if (d.breakEvenAttendees && d.breakEvenAttendees > 1 && d.avgAttendees !== null && d.avgAttendees < d.breakEvenAttendees * 1.3) {
        // A room one person already pays for (1:1 work) is never "close" in any useful sense.
        out.push({
          id: `thin-${v.id}`, kind: 'tip', weight: d.revenue * 0.2,
          title: `${v.name} runs close to its break-even`,
          detail: `Sessions there average ${d.avgAttendees} ${d.avgAttendees === 1 ? 'person' : 'people'} and need ${d.breakEvenAttendees} to cover the ${lei(v.feePerSession)} fee. One quiet evening and it's a loss.`,
          link: { label: 'Venue deals', hash: '#/reports/deals' },
        })
      }
      if (v.deal === 'share' && d.sessions.length >= 3 && d.venueCost / d.sessions.length > 300) {
        out.push({
          id: `share-${v.id}`, kind: 'tip', weight: d.venueCost * 0.3,
          title: `${v.name}'s ${percent(v.sharePct)} share costs about ${lei(d.venueCost / d.sessions.length)} a session`,
          detail: `At your current turnout${d.avgAttendees ? ` (${d.avgAttendees} people)` : ''}, a fixed fee below that would leave you more — but you'd carry the empty days yourself. Worth asking once your numbers are steady.`,
          link: { label: 'Compare deals', hash: '#/reports/deals' },
        })
      }
    }
  }

  // Where the money is best: the activity that keeps the most per session.
  const take = takeHome(data, { deals: opts.deals, costs: opts.costs })
  const byActivity = new Map<string, { kept: number; n: number; income: number }>()
  for (const x of inR) {
    if (!x.category || x.category === 'reimbursement') continue
    const a = byActivity.get(x.category) ?? { kept: 0, n: 0, income: 0 }
    a.kept += take.get(x.id) ?? x.amountRon
    a.n += 1
    a.income += x.amountRon
    byActivity.set(x.category, a)
  }
  const acts = [...byActivity.entries()].filter(([, a]) => a.n >= 2).map(([id, a]) => ({ id, perSession: a.kept / a.n, kept: a.kept, income: a.income, n: a.n }))
  if (acts.length >= 2) {
    const best = [...acts].sort((a, b) => b.perSession - a.perSession)[0]
    out.push({
      id: `best-activity`, kind: 'win', weight: best.kept * 0.5,
      title: `${nameOf(data, 'activity', best.id)} keeps the most per session: ${lei(best.perSession)}`,
      detail: `${best.n} sessions brought ${lei(best.income)}${opts.deals || opts.costs ? `, and ${lei(best.kept)} stayed with you` : ''}. More of this is the quickest way up.`,
      link: { label: 'See where it pays best', hash: '#/reports/insights/heat' },
    })
  }

  // Margins: work that leaves little after its linked costs.
  if (opts.costs || opts.deals) {
    for (const a of acts) {
      const rate = a.income > 0 ? a.kept / a.income : 1
      if (rate < 0.5 && a.income >= total * 0.04) {
        out.push({
          id: `thin-margin-${a.id}`, kind: 'pain', weight: (a.income - a.kept),
          title: `${nameOf(data, 'activity', a.id)} keeps only ${percent(rate)} of what it brings in`,
          detail: `${lei(a.income)} in, ${lei(a.kept)} kept after the room, co-facilitators and materials. Check the price, the venue deal or who you share it with.`,
          link: { label: 'Activities', hash: '#/reports/activities' },
        })
      }
    }
  }

  // Clients drifting away or growing: the last three months against the three before.
  const m3 = addMonths(startOfMonth(today), -3)
  const m6 = addMonths(startOfMonth(today), -6)
  const lastEnd = endOfMonth(addMonths(startOfMonth(today), -1))
  const window = (from: string, to: string) => rec.filter((x) => x.date >= from && x.date <= to)
  const recent = window(m3, lastEnd)
  const before = window(m6, endOfMonth(addMonths(m3, -1)))
  const allRecent = sum(recent) || 1
  const byClient = (xs: IncomeRecord[]) => {
    const m = new Map<string, number>()
    for (const x of xs) if (x.clientId) m.set(x.clientId, (m.get(x.clientId) ?? 0) + x.amountRon)
    return m
  }
  const rc = byClient(recent)
  const bc = byClient(before)
  for (const [id, prev] of bc) {
    const now = rc.get(id) ?? 0
    if (prev >= allRecent * 0.05 && now < prev * 0.5) {
      out.push({
        id: `fading-${id}`, kind: 'pain', weight: prev - now,
        title: `${nameOf(data, 'client', id)} is fading: ${lei(now)} in the last three months, ${lei(prev)} the three before`,
        detail: now === 0 ? 'Nothing since. A short check-in now costs less than finding a new client later.' : 'Worth a conversation about what they need next.',
        link: { label: 'Clients', hash: '#/reports/clients' },
      })
    }
  }
  for (const [id, now] of rc) {
    const prev = bc.get(id) ?? 0
    if (prev > 0 && now >= prev * 1.5 && now >= allRecent * 0.05) {
      out.push({
        id: `growing-${id}`, kind: 'win', weight: now - prev,
        title: `${nameOf(data, 'client', id)} is growing: ${lei(now)} in the last three months, up from ${lei(prev)}`,
        detail: 'Whatever is working there, it could work with similar clients.',
        link: { label: 'Clients', hash: '#/reports/clients' },
      })
    }
  }

  // Dependence on one client.
  const periodClients = byClient(inR)
  const top = [...periodClients.entries()].sort((a, b) => b[1] - a[1])[0]
  if (top && total > 0 && top[1] / total >= 0.35) {
    out.push({
      id: 'concentration', kind: 'pain', weight: top[1] * 0.4,
      title: `${percent(top[1] / total)} of this period came from ${nameOf(data, 'client', top[0])}`,
      detail: 'If they paused, the month would look very different. A second client of that size would make you sturdier.',
      link: { label: 'Clients', hash: '#/reports/clients' },
    })
  }

  // New clients who came once and never came back.
  const firstSeen = new Map<string, { first: string; n: number }>()
  for (const x of rec) {
    if (!x.clientId) continue
    const f = firstSeen.get(x.clientId)
    if (!f) firstSeen.set(x.clientId, { first: x.date, n: 1 })
    else { f.n += 1; if (x.date < f.first) f.first = x.date }
  }
  const settled = [...firstSeen.values()].filter((f) => f.first <= addMonths(today, -2) && f.first >= addMonths(today, -12))
  const once = settled.filter((f) => f.n === 1).length
  if (settled.length >= 4 && once >= 2) {
    const back = settled.length - once
    out.push({
      id: 'retention', kind: once / settled.length > 0.4 ? 'pain' : 'tip', weight: once * 300,
      title: `${once} of ${settled.length} new clients this year came once and didn't return`,
      detail: `${percent(back / settled.length)} came back. A follow-up after a first session, or a small package to continue, often turns intro clients into regulars.`,
      link: { label: 'Clients', hash: '#/reports/clients' },
    })
  }

  // Money owed.
  if (opts.expected) {
    const overdue = data.records.filter((x) => x.status === 'expected' && x.date < today)
    if (overdue.length) {
      out.push({
        id: 'overdue', kind: 'pain', weight: sum(overdue) * 2,
        title: `${lei(sum(overdue))} is overdue from ${overdue.length} ${overdue.length === 1 ? 'payment' : 'payments'}`,
        detail: 'A friendly reminder now; it gets harder the longer it waits.',
        link: { label: 'Income', hash: '#/income' },
      })
    }
  }

  // The quietest month of the last year, to plan around.
  const months = new Map<string, number>()
  for (const x of window(addMonths(startOfMonth(today), -12), lastEnd)) months.set(x.date.slice(0, 7), (months.get(x.date.slice(0, 7)) ?? 0) + x.amountRon)
  if (months.size >= 6) {
    const sorted = [...months.entries()].sort((a, b) => a[1] - b[1])
    const avg = [...months.values()].reduce((a, b) => a + b, 0) / months.size
    const [m, v] = sorted[0]
    if (v < avg * 0.6) {
      out.push({
        id: 'quiet-month', kind: 'tip', weight: avg - v,
        title: `${monthShort(`${m}-01`)} was your quietest month: ${lei(v)}, against ${lei(avg)} on average`,
        detail: 'Set something aside before it comes round again, or plan an online offer for those weeks.',
      })
    }
  }

  return out.sort((a, b) => b.weight - a.weight)
}

