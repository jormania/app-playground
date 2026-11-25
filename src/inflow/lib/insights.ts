/**
 * Insights for someone finding their feet: what each payment left you, and
 * a short list of pain points and wins in plain words — the
 * sessions that cost more than they earned, the client drifting away, the
 * work that leaves little after costs, the room that needs more people.
 *
 * Every insight is computed from the records; nothing is a canned tip.
 */
import type { IncomeRecord, InflowData } from '../domain/types'
import { nameOf } from './analytics'
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
  const out = new Map<string, number>()
  for (const [id, c] of recordCosts(data, opts)) out.set(id, c.kept)
  return out
}

export interface RecordCosts { income: number; venueFee: number; direct: number; kept: number }

/** takeHome's parts, per received payment: the venue's fee, the direct costs shared to it, and what was kept. */
export function recordCosts(data: InflowData, opts: { deals: boolean; costs: boolean }): Map<string, RecordCosts> {
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
  // A reimbursement is money back, not a session: it takes no share of the day's costs.
  for (const r of data.records) if (r.status === 'received' && r.venueId && r.category !== 'reimbursement') sameDay.set(`${r.venueId}|${r.date}`, (sameDay.get(`${r.venueId}|${r.date}`) ?? 0) + 1)
  const out = new Map<string, RecordCosts>()
  for (const r of data.records) {
    if (r.status !== 'received') continue
    const k = `${r.venueId}|${r.date}`
    const direct = r.venueId && r.category !== 'reimbursement' ? (linked.get(k) ?? 0) / (sameDay.get(k) ?? 1) : 0
    const venueFee = venue.get(r.id) ?? 0
    out.set(r.id, { income: r.amountRon, venueFee: round2(venueFee), direct: round2(direct), kept: round2(r.amountRon - venueFee - direct) })
  }
  return out
}

// ── pain points and wins ────────────────────────────────────────────────────

export type InsightKind = 'pain' | 'win' | 'tip'

export interface Insight {
  id: string
  /** The rule it came from; feedback can mute a rule ("hide all like this"). */
  rule: InsightRule
  kind: InsightKind
  title: string
  detail: string
  /** Rough size of what's at stake, lei, for ordering. */
  weight: number
  /** Where to look next. */
  link?: { label: string; hash: string }
}

export type InsightRule =
  | 'losing-sessions' | 'close-to-break-even' | 'venue-for-the-same-work' | 'best-work' | 'thin-margin'
  | 'regular-fading' | 'regular-growing' | 'one-client' | 'intro-clients' | 'overdue' | 'quiet-month'

export const RULE_LABEL: Record<InsightRule, string> = {
  'losing-sessions': 'Sessions that lost money at a venue',
  'close-to-break-even': 'Venues running close to their break-even',
  'venue-for-the-same-work': 'The same work at two venues',
  'best-work': 'The work that keeps the most',
  'thin-margin': 'Work that keeps little after costs',
  'regular-fading': 'Regular clients going quiet',
  'regular-growing': 'Regular clients growing',
  'one-client': 'Leaning on one client',
  'intro-clients': 'Individual clients who came once',
  overdue: 'Overdue payments',
  'quiet-month': 'Your quietest month',
}

export interface InsightOptions {
  deals: boolean
  costs: boolean
  expected: boolean
}

const sum = (xs: { amountRon: number }[]) => round2(xs.reduce((a, x) => a + x.amountRon, 0))
const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7))

/**
 * What kind of practice this is, read from the records, so each rule speaks
 * only where it applies: which clients pay regularly (three or more separate
 * months in the last year), whether there is group work, how many full months
 * of history there are.
 */
export interface Practice {
  /** Complete months since the first one with income (the first, partial month not counted). */
  fullMonths: number
  firstFullMonth: string
  regularClients: Set<string>
  groupWork: boolean
}

export function practice(data: InflowData, today: string): Practice {
  const rec = data.records.filter((x) => x.status === 'received' && x.date <= today)
  const first = rec.reduce((m, x) => (x.date < m ? x.date : m), today)
  const firstFullMonth = addMonths(startOfMonth(first), 1)
  const fullMonths = Math.max(0, monthsBetween(firstFullMonth, startOfMonth(today)))
  const yearAgo = addMonths(startOfMonth(today), -12)
  const monthsPaid = new Map<string, Set<string>>()
  for (const x of rec) {
    if (!x.clientId || x.date < yearAgo) continue
    monthsPaid.set(x.clientId, (monthsPaid.get(x.clientId) ?? new Set()).add(x.date.slice(0, 7)))
  }
  return {
    fullMonths, firstFullMonth,
    regularClients: new Set([...monthsPaid].filter(([, m]) => m.size >= 3).map(([id]) => id)),
    groupWork: rec.some((x) => (x.attendees ?? 0) >= 3),
  }
}

export function insights(data: InflowData, r: { from: string; to: string }, today: string, opts: InsightOptions): Insight[] {
  const out: Insight[] = []
  const p = practice(data, today)
  const rec = data.records.filter((x) => x.status === 'received')
  const inR = rec.filter((x) => x.date >= r.from && x.date <= r.to && x.category !== 'reimbursement')
  const take = takeHome(data, { deals: opts.deals, costs: opts.costs })
  const kept = (x: IncomeRecord) => take.get(x.id) ?? x.amountRon

  // Venue deals are set by the venue: the advice is about when to run a session, and where.
  if (opts.deals) {
    for (const d of venueDeals(data.venues, data.records, r)) {
      const v = d.venue
      if (d.losing.length && (v.deal === 'fixed' || v.deal === 'hybrid' || v.deal === 'monthly')) {
        out.push({
          id: `losing-${v.id}`, rule: 'losing-sessions', kind: 'pain', weight: d.lost * 3,
          title: `${d.losing.length} ${d.losing.length === 1 ? 'session' : 'sessions'} at ${v.name} cost more than ${d.losing.length === 1 ? 'it' : 'they'} earned`,
          detail: `The ${v.deal === 'monthly' ? 'rent' : 'fee'} is paid whoever comes; together they lost ${lei(d.lost)}.${d.breakEvenAttendees && d.breakEvenAttendees > 1 ? ` Confirming a session there once ${d.breakEvenAttendees} people have booked would avoid it.` : ''}`,
          link: { label: 'Venue deals', hash: '#/reports/deals' },
        })
      } else if (d.breakEvenAttendees && d.breakEvenAttendees > 1 && d.avgAttendees !== null && d.sessionCount >= 3 && d.avgAttendees < d.breakEvenAttendees * 1.3) {
        out.push({
          id: `thin-${v.id}`, rule: 'close-to-break-even', kind: 'tip', weight: d.revenue * 0.2,
          title: `${v.name} runs close to its break-even`,
          detail: `Sessions there average ${d.avgAttendees} people and need ${d.breakEvenAttendees} to cover the ${lei(v.feePerSession)} fee.`,
          link: { label: 'Venue deals', hash: '#/reports/deals' },
        })
      }
    }

    // The same work at two venues, three sessions or more at each: which leaves you more.
    const pairs = new Map<string, Map<string, { kept: number; n: number }>>()
    for (const x of inR) {
      if (!x.category || !x.venueId) continue
      const v = data.venues.find((y) => y.id === x.venueId)
      // Rooms only: an online platform's payment is often a month of sessions, not one.
      if (!v || v.deal === 'none' || (v.type !== 'in_person' && v.type !== 'hybrid')) continue
      const m = pairs.get(x.category) ?? new Map()
      const c = m.get(x.venueId) ?? { kept: 0, n: 0 }
      c.kept += kept(x)
      c.n += x.sessions || 1
      m.set(x.venueId, c)
      pairs.set(x.category, m)
    }
    for (const [cat, m] of pairs) {
      const rows = [...m].filter(([, c]) => c.n >= 3).map(([id, c]) => ({ id, per: c.kept / c.n, n: c.n })).sort((a, b) => b.per - a.per)
      if (rows.length < 2) continue
      const [hi, lo] = [rows[0], rows[rows.length - 1]]
      if (hi.per - lo.per < 100 || hi.per < lo.per * 1.15) continue
      out.push({
        id: `venue-pair-${cat}`, rule: 'venue-for-the-same-work', kind: 'tip', weight: (hi.per - lo.per) * lo.n,
        title: `${nameOf(data, 'activity', cat)} keeps ${lei(hi.per)} a session at ${nameOf(data, 'venue', hi.id)}, ${lei(lo.per)} at ${nameOf(data, 'venue', lo.id)}`,
        detail: `${hi.n} and ${lo.n} sessions. Same work, different deals: worth weighing when you book the next one.`,
        link: { label: 'Venue deals', hash: '#/reports/deals' },
      })
    }
  }

  // The work that keeps the most a session: only among kinds of work done five times or more.
  const byActivity = new Map<string, { kept: number; n: number; income: number }>()
  for (const x of inR) {
    if (!x.category) continue
    const a = byActivity.get(x.category) ?? { kept: 0, n: 0, income: 0 }
    a.kept += kept(x)
    a.n += x.sessions || 1
    a.income += x.amountRon
    byActivity.set(x.category, a)
  }
  const total = sum(inR)
  const acts = [...byActivity.entries()].filter(([, a]) => a.n >= 5).map(([id, a]) => ({ id, perSession: a.kept / a.n, kept: a.kept, income: a.income, n: a.n }))
  if (acts.length >= 2) {
    const [best, next] = [...acts].sort((a, b) => b.perSession - a.perSession)
    if (best.perSession >= next.perSession * 1.25) {
      out.push({
        id: `best-activity-${best.id}`, rule: 'best-work', kind: 'win', weight: best.kept * 0.5,
        title: `${nameOf(data, 'activity', best.id)} keeps the most a session: ${lei(best.perSession)}`,
        detail: `${best.n} sessions${opts.deals || opts.costs ? (Math.round(best.kept) === Math.round(best.income) ? `, ${lei(best.income)} with no venue fees or direct costs` : `, ${lei(best.kept)} kept of ${lei(best.income)}`) : `, ${lei(best.income)}`}. Next is ${nameOf(data, 'activity', next.id).toLowerCase()} at ${lei(next.perSession)}.`,
        link: { label: 'Clients & work', hash: '#/reports/earnings' },
      })
    }
  }

  // Work that leaves little after its own costs.
  if (opts.costs || opts.deals) {
    for (const a of acts) {
      const rate = a.income > 0 ? a.kept / a.income : 1
      if (rate < 0.5 && a.income >= total * 0.04) {
        out.push({
          id: `thin-margin-${a.id}`, rule: 'thin-margin', kind: 'pain', weight: (a.income - a.kept),
          title: `${nameOf(data, 'activity', a.id)} keeps only ${percent(rate)} of what it brings in`,
          detail: `${lei(a.income)} in, ${lei(a.kept)} kept after the venue and direct costs, over ${a.n} sessions.`,
          link: { label: 'Clients & work', hash: '#/reports/earnings' },
        })
      }
    }
  }

  // Regular clients only (paid in three or more months this past year): the last three months against the three before.
  const m3 = addMonths(startOfMonth(today), -3)
  const m6 = addMonths(startOfMonth(today), -6)
  const lastEnd = endOfMonth(addMonths(startOfMonth(today), -1))
  const window = (from: string, to: string) => rec.filter((x) => x.date >= from && x.date <= to)
  const byClient = (xs: IncomeRecord[]) => {
    const m = new Map<string, number>()
    for (const x of xs) if (x.clientId && p.regularClients.has(x.clientId)) m.set(x.clientId, (m.get(x.clientId) ?? 0) + x.amountRon)
    return m
  }
  if (p.fullMonths >= 6) {
    const rc = byClient(window(m3, lastEnd))
    const bc = byClient(window(m6, endOfMonth(addMonths(m3, -1))))
    for (const [id, prev] of bc) {
      const now = rc.get(id) ?? 0
      if (now < prev * 0.5 && prev >= 1000) {
        out.push({
          id: `fading-${id}`, rule: 'regular-fading', kind: 'pain', weight: prev - now,
          title: `${nameOf(data, 'client', id)} has gone quiet: ${lei(now)} in the last three months, ${lei(prev)} the three before`,
          detail: now === 0 ? 'A regular client with nothing since. A short check-in costs less than finding a new client.' : 'A regular client paying less. Worth a conversation about what they need next.',
          link: { label: 'Clients & work', hash: '#/reports/earnings' },
        })
      }
    }
    for (const [id, now] of rc) {
      const prev = bc.get(id) ?? 0
      if (prev > 0 && now >= prev * 1.5 && now - prev >= 1000) {
        out.push({
          id: `growing-${id}`, rule: 'regular-growing', kind: 'win', weight: now - prev,
          title: `${nameOf(data, 'client', id)} is growing: ${lei(now)} in the last three months, up from ${lei(prev)}`,
          detail: 'Whatever is working there, it could work with similar clients.',
          link: { label: 'Clients & work', hash: '#/reports/earnings' },
        })
      }
    }
  }

  // Leaning on one client, over the last twelve months (a week or a month is too short to say).
  const year = window(addMonths(startOfMonth(today), -12), today)
  const yearClients = new Map<string, number>()
  for (const x of year) if (x.clientId) yearClients.set(x.clientId, (yearClients.get(x.clientId) ?? 0) + x.amountRon)
  const yearTotal = sum(year)
  const top = [...yearClients.entries()].sort((a, b) => b[1] - a[1])[0]
  if (top && yearClients.size >= 3 && p.fullMonths >= 3 && top[1] / yearTotal >= 0.35) {
    out.push({
      id: `one-client-${top[0]}`, rule: 'one-client', kind: 'pain', weight: top[1] * 0.4,
      title: `${percent(top[1] / yearTotal)} of the last twelve months came from ${nameOf(data, 'client', top[0])}`,
      detail: 'If they paused, the year would look very different. A second client of that size would make you sturdier.',
      link: { label: 'Clients & work', hash: '#/reports/earnings' },
    })
  }

  // Individual clients who came once: about 1:1 practice, not companies booking a project.
  const firstSeen = new Map<string, { first: string; n: number }>()
  for (const x of rec) {
    const c = x.clientId ? data.clients.find((y) => y.id === x.clientId) : undefined
    if (!c || c.kind !== 'individual') continue
    const f = firstSeen.get(c.id)
    if (!f) firstSeen.set(c.id, { first: x.date, n: 1 })
    else { f.n += 1; if (x.date < f.first) f.first = x.date }
  }
  const settled = [...firstSeen.values()].filter((f) => f.first <= addMonths(today, -2) && f.first >= addMonths(today, -12))
  const once = settled.filter((f) => f.n === 1).length
  if (settled.length >= 5 && once >= 2 && once / settled.length >= 0.25) {
    out.push({
      id: 'intro-clients', rule: 'intro-clients', kind: once / settled.length > 0.4 ? 'pain' : 'tip', weight: once * 300,
      title: `${once} of ${settled.length} new individual clients this year came once and didn't return`,
      detail: 'A follow-up after a first session, or a small package to continue, often turns intro clients into regulars.',
      link: { label: 'Clients & work', hash: '#/reports/earnings' },
    })
  }

  // Money owed.
  if (opts.expected) {
    const overdue = data.records.filter((x) => x.status === 'expected' && x.date < today)
    if (overdue.length) {
      out.push({
        id: 'overdue', rule: 'overdue', kind: 'pain', weight: sum(overdue) * 2,
        title: `${lei(sum(overdue))} is overdue from ${overdue.length} ${overdue.length === 1 ? 'payment' : 'payments'}`,
        detail: 'Remind copies a polite note to send; it gets harder the longer it waits.',
        link: { label: 'Overview', hash: '#/overview' },
      })
    }
  }

  // The quietest complete month of the last year: never the current month, never a first partial one.
  if (p.fullMonths >= 9) {
    const from = [addMonths(startOfMonth(today), -12), p.firstFullMonth].sort()[1]
    const months = new Map<string, number>()
    for (let m = from; m < startOfMonth(today); m = addMonths(m, 1)) months.set(m.slice(0, 7), 0)
    for (const x of window(from, lastEnd)) months.set(x.date.slice(0, 7), (months.get(x.date.slice(0, 7)) ?? 0) + x.amountRon)
    // A practice starting up has low first months; they say nothing about the seasons.
    const all = [...months.entries()]
    const typical = all.map(([, v]) => v).sort((a, b) => a - b)[Math.floor(all.length / 2)]
    const settledAt = all.findIndex(([, v]) => v >= typical * 0.6)
    const settled = all.slice(Math.max(0, settledAt))
    const avg = settled.reduce((a, [, v]) => a + v, 0) / Math.max(1, settled.length)
    const [m, v] = [...settled].sort((a, b) => a[1] - b[1])[0] ?? ['', 0]
    if (settled.length >= 9 && m && v < avg * 0.6) {
      out.push({
        id: `quiet-month-${m}`, rule: 'quiet-month', kind: 'tip', weight: avg - v,
        title: `${monthShort(`${m}-01`)} ${m.slice(0, 4)} was your quietest month: ${lei(v)}, against ${lei(avg)} on average`,
        detail: 'If it repeats, set something aside beforehand, or plan work that fills it.',
      })
    }
  }

  return out.sort((a, b) => b.weight - a.weight)
}
