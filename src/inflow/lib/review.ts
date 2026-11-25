/**
 * The period in review, as WhereItWent tells it: a headline paragraph, the
 * main movers (what changed most against the period before), the main
 * shakers (who carries the income), then the insights to act on.
 *
 * Pure, so the Review screen and the printable report say the same thing.
 */
import type { InflowData, IncomeRecord } from '../domain/types'
import { breakdown, DIMENSION_NOUN, keyOf, nameOf, sum, type BreakdownRow, type Dimension } from './analytics'
import { monthLabel, shortDate } from './dates'
import { delta, lei, percent } from './money'
import type { Insight } from './insights'

export interface Mover {
  dim: Dimension
  id: string
  name: string
  current: number
  previous: number
  /** current − previous, lei. */
  change: number
}

/**
 * What moved most, up or down, across clients, venues and activities. A
 * client who stopped paying counts too (current 0). At most `perDim` from
 * one dimension, so one big client doesn't fill the list three ways.
 */
export function movers(
  data: Pick<InflowData, 'clients' | 'sources' | 'venues'>,
  cur: IncomeRecord[], before: IncomeRecord[],
  dims: Dimension[] = ['client', 'venue', 'activity'], n = 6, perDim = 3,
): Mover[] {
  const all: Mover[] = []
  for (const dim of dims) {
    const totals = new Map<string, [number, number]>()
    const add = (rs: IncomeRecord[], i: 0 | 1) => {
      for (const r of rs) {
        const k = keyOf(r, dim)
        const t = totals.get(k) ?? [0, 0]
        t[i] += r.amountRon
        totals.set(k, t)
      }
    }
    add(cur, 0)
    add(before, 1)
    const list = [...totals.entries()]
      .filter(([id]) => !id.startsWith('__'))
      .map(([id, [c, p]]) => ({ dim, id, name: nameOf(data, dim, id), current: Math.round(c), previous: Math.round(p), change: Math.round(c - p) }))
      .filter((m) => m.change !== 0)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, perDim)
    all.push(...list)
  }
  // The biggest drops always make the list (up to two), so a client who stopped
  // is never crowded out by a good year's rises.
  const ranked = all.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
  const drops = ranked.filter((x) => x.change < 0).slice(0, 2)
  const rest = ranked.filter((x) => !drops.includes(x)).slice(0, Math.max(0, n - drops.length))
  return [...rest, ...drops].sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
}

/** Who carries the income: the top rows of one dimension. */
export function shakers(data: Pick<InflowData, 'clients' | 'sources' | 'venues'>, cur: IncomeRecord[], before: IncomeRecord[], dim: Dimension): BreakdownRow[] {
  return breakdown(data, cur, before, dim)
}

/** "November 2026 in review", "2026 in review", "This week in review". */
export function reviewTitle(range: { from: string; to: string; label: string }): string {
  const whole = (a: string, b: string) => range.from === a && range.to === b
  const y = range.from.slice(0, 4)
  if (whole(`${y}-01-01`, `${y}-12-31`)) return `${y} in review`
  if (range.from.slice(8) === '01' && range.from.slice(0, 7) === range.to.slice(0, 7)) return `${monthLabel(range.from)} in review`
  if (range.label === 'This week') return 'This week in review'
  return `${shortDate(range.from)} – ${shortDate(range.to, Number(range.to.slice(0, 4)))} in review`
}

export interface ReviewInput {
  data: Pick<InflowData, 'clients' | 'sources' | 'venues'>
  cur: IncomeRecord[]
  before: IncomeRecord[]
  prevLabel: string
  /** Income less costs for the period, when costs are on. */
  kept?: number | null
  insights: Insight[]
  periodLabel: string
  /** Start of the comparison period, and of the records: a comparison that reaches before the first record is partial. */
  prevFrom?: string
  firstRecord?: string
}

/** The headline paragraph: a few plain sentences, the numbers that matter. */
export function reviewSummary({ data, cur, before, prevLabel, kept, insights, periodLabel, prevFrom, firstRecord }: ReviewInput): string {
  const total = sum(cur)
  const prev = sum(before)
  if (total === 0 && prev === 0) return `Nothing came in ${periodLabel.toLowerCase()} or ${prevLabel}.`
  const out: string[] = []
  const d = delta(total, prev)
  const partial = !!(prevFrom && firstRecord && firstRecord > prevFrom && prev > 0)
  out.push(
    partial ? `${lei(total)} came in. Your records start in ${monthLabel(firstRecord!)}, so there is only part of ${prevLabel} to compare with (${lei(prev)}).`
      : d.direction === 'flat' ? `${lei(total)} came in, about the same as ${prevLabel}.`
      : d.direction === 'new' ? `${lei(total)} came in; nothing did ${prevLabel}.`
        : `${lei(total)} came in, ${d.direction === 'up' ? 'up' : 'down'} ${d.text.slice(1)} on ${prevLabel} (${lei(prev)}).`,
  )
  if (kept !== null && kept !== undefined && total > 0) out.push(`After costs you kept ${lei(kept)}, ${percent(kept / total)} of it.`)
  const top = breakdown(data, cur, before, 'client')[0]
  if (top && total > 0) out.push(`${top.name} brought the most: ${lei(top.total)}, ${percent(top.share)} of the total.`)
  const m = movers(data, cur, before)
  const up = m.find((x) => x.change > 0)
  const down = m.find((x) => x.change < 0)
  if (up) out.push(`Biggest rise: ${up.name} (${DIMENSION_NOUN[up.dim].toLowerCase()}), +${lei(up.change)}.`)
  if (down) out.push(`Biggest drop: ${down.name}, −${lei(-down.change)}${down.current === 0 ? ', nothing this time' : ''}.`)
  const pains = insights.filter((i) => i.kind === 'pain').length
  if (pains) out.push(`${pains} ${pains === 1 ? 'thing needs' : 'things need'} a look.`)
  return out.join(' ')
}
