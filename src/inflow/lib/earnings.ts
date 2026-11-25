/**
 * Which clients and types of work earn you the most: for each, the income,
 * the venue fees and direct costs that came out of it, what you kept, the
 * sessions behind it, and what a session kept on average.
 *
 * "Kept" is the existing per-payment rule (insights.ts recordCosts): income
 * less its venue's deal cost and the direct costs linked to that venue on that
 * day. Sessions add up what each received payment covers (1 unless it's a
 * package or a payout), reimbursements left out.
 */
import type { InflowData } from '../domain/types'
import { keyOf, nameOf, type Dimension } from './analytics'
import { recordCosts } from './insights'
import { round2 } from './money'

/** Ranked by any of the four: client, kind of work, venue or source. */
export type EarningsBy = Dimension

/** One line of a result's breakdown: by venue, or by client when the result is a venue. */
export interface EarningsPart { id: string; name: string; sessions: number; income: number; kept: number }

export interface EarningsRow {
  id: string
  name: string
  income: number
  venueFees: number
  directCosts: number
  kept: number
  sessions: number
  keptPerSession: number
  /** Kept per hour over the payments with hours recorded; null when none have. */
  keptPerHour: number | null
  /** Payments with hours recorded, of all of them: per hour is only as good as this. */
  hoursCoverage: number
  /** Lowest and highest kept by a single session: how even the earnings are. */
  lowest: number
  highest: number
  /** What it's made of: venues, or clients when ranking venues. */
  parts: EarningsPart[]
}

export interface Earnings {
  rows: EarningsRow[]
  totals: { income: number; costs: number; kept: number; sessions: number }
}

export function earnings(
  data: InflowData, range: { from: string; to: string }, by: EarningsBy, opts: { deals: boolean; costs: boolean },
): Earnings {
  const parts = recordCosts(data, opts)
  const rs = data.records.filter((r) => r.status === 'received' && r.category !== 'reimbursement' && r.date >= range.from && r.date <= range.to)
  const groups = new Map<string, typeof rs>()
  for (const r of rs) {
    const k = keyOf(r, by)
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  const rows = [...groups.entries()].map(([id, list]): EarningsRow => {
    let income = 0, venueFees = 0, directCosts = 0, sessions = 0, hours = 0, keptWithHours = 0, withHours = 0
    const each: number[] = []
    const partDim: Dimension = by === 'venue' ? 'client' : 'venue'
    const byPart = new Map<string, EarningsPart>()
    for (const r of list) {
      const p = parts.get(r.id)!
      income += p.income
      venueFees += p.venueFee
      directCosts += p.direct
      const n = r.sessions || 1
      sessions += n
      each.push(p.kept / n)
      if (r.hours && r.hours > 0) { hours += r.hours; keptWithHours += p.kept; withHours += 1 }
      const vk = keyOf(r, partDim)
      const v = byPart.get(vk) ?? { id: vk, name: nameOf(data, partDim, vk), sessions: 0, income: 0, kept: 0 }
      v.sessions += r.sessions || 1
      v.income += p.income
      v.kept += p.kept
      byPart.set(vk, v)
    }
    const kept = income - venueFees - directCosts
    return {
      id, name: nameOf(data, by, id),
      income: round2(income), venueFees: round2(venueFees), directCosts: round2(directCosts), kept: round2(kept),
      sessions, keptPerSession: round2(kept / sessions),
      keptPerHour: hours > 0 ? round2(keptWithHours / hours) : null, hoursCoverage: withHours / list.length,
      lowest: round2(Math.min(...each)), highest: round2(Math.max(...each)),
      parts: [...byPart.values()].map((v) => ({ ...v, income: round2(v.income), kept: round2(v.kept) })).sort((a, b) => b.kept - a.kept),
    }
  }).sort((a, b) => b.kept - a.kept || b.sessions - a.sessions)
  const t = rows.reduce((a, r) => ({ income: a.income + r.income, costs: a.costs + r.venueFees + r.directCosts, kept: a.kept + r.kept, sessions: a.sessions + r.sessions }), { income: 0, costs: 0, kept: 0, sessions: 0 })
  return { rows, totals: { income: round2(t.income), costs: round2(t.costs), kept: round2(t.kept), sessions: t.sessions } }
}
