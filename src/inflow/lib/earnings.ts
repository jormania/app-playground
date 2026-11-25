/**
 * Which clients and types of work earn you the most: for each, the income,
 * the venue fees and direct costs that came out of it, what you kept, the
 * sessions behind it, and what a session kept on average.
 *
 * "Kept" is the existing per-payment rule (insights.ts recordCosts): income
 * less its venue's deal cost and the direct costs linked to that venue on that
 * day. A session is a received payment in the period that isn't a reimbursement.
 */
import type { InflowData } from '../domain/types'
import { keyOf, nameOf } from './analytics'
import { recordCosts } from './insights'
import { round2 } from './money'

export type EarningsBy = 'client' | 'activity'

export interface EarningsVenue { id: string; name: string; sessions: number; income: number; kept: number }

export interface EarningsRow {
  id: string
  name: string
  income: number
  venueFees: number
  directCosts: number
  kept: number
  sessions: number
  keptPerSession: number
  /** Lowest and highest kept by a single session: how even the earnings are. */
  lowest: number
  highest: number
  venues: EarningsVenue[]
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
    let income = 0, venueFees = 0, directCosts = 0
    const each: number[] = []
    const venues = new Map<string, EarningsVenue>()
    for (const r of list) {
      const p = parts.get(r.id)!
      income += p.income
      venueFees += p.venueFee
      directCosts += p.direct
      each.push(p.kept)
      const vk = keyOf(r, 'venue')
      const v = venues.get(vk) ?? { id: vk, name: nameOf(data, 'venue', vk), sessions: 0, income: 0, kept: 0 }
      v.sessions += 1
      v.income += p.income
      v.kept += p.kept
      venues.set(vk, v)
    }
    const kept = income - venueFees - directCosts
    return {
      id, name: nameOf(data, by, id),
      income: round2(income), venueFees: round2(venueFees), directCosts: round2(directCosts), kept: round2(kept),
      sessions: list.length, keptPerSession: round2(kept / list.length),
      lowest: Math.min(...each), highest: Math.max(...each),
      venues: [...venues.values()].map((v) => ({ ...v, income: round2(v.income), kept: round2(v.kept) })).sort((a, b) => b.kept - a.kept),
    }
  }).sort((a, b) => b.kept - a.kept || b.sessions - a.sessions)
  const t = rows.reduce((a, r) => ({ income: a.income + r.income, costs: a.costs + r.venueFees + r.directCosts, kept: a.kept + r.kept, sessions: a.sessions + r.sessions }), { income: 0, costs: 0, kept: 0, sessions: 0 })
  return { rows, totals: { income: round2(t.income), costs: round2(t.costs), kept: round2(t.kept), sessions: t.sessions } }
}
