/**
 * Venue deals: what each kind of arrangement costs you, session by session.
 *
 * Read from the deal terms set on the venue (a 600-lei evening fee, a 30%
 * share), not from recorded costs, so a beginner sees the answer without
 * keeping a ledger. Every income record at a venue counts as one session.
 *
 *   fixed    you pay the fee per session whoever turns up
 *   share    the venue takes a share of what the session brings in
 *   hybrid   both
 *   monthly  rent per month, spread over that month's sessions there
 *   none     nothing (online, client's office, an agency pays)
 */
import type { IncomeRecord, Venue } from '../domain/types'
import { round2 } from './money'

const inRange = (d: string, r: { from: string; to: string }) => d >= r.from && d <= r.to

/** Sessions that earn: received, at a venue, not a reimbursement. */
export function sessionsAt(records: IncomeRecord[], venueId: string, r: { from: string; to: string }): IncomeRecord[] {
  return records.filter((x) => x.status === 'received' && x.venueId === venueId && x.category !== 'reimbursement' && inRange(x.date, r))
}

/** What the venue costs for one session under its deal. `sessionsThatMonth` spreads monthly rent. */
export function venueCostOf(revenue: number, v: Pick<Venue, 'deal' | 'feePerSession' | 'sharePct' | 'monthlyFee'>, sessionsThatMonth = 1): number {
  switch (v.deal) {
    case 'fixed': return v.feePerSession
    case 'share': return round2(revenue * v.sharePct)
    case 'hybrid': return round2(v.feePerSession + revenue * v.sharePct)
    case 'monthly': return round2(v.monthlyFee / Math.max(1, sessionsThatMonth))
    case 'none': return 0
  }
}

/** Venue cost per record id, under each record's venue deal. */
export function venueCosts(records: IncomeRecord[], venues: Venue[]): Map<string, number> {
  const byVenue = new Map(venues.map((v) => [v.id, v]))
  const monthCount = new Map<string, number>()
  for (const r of records) {
    if (r.status !== 'received' || !r.venueId || r.category === 'reimbursement') continue
    const k = `${r.venueId}|${r.date.slice(0, 7)}`
    monthCount.set(k, (monthCount.get(k) ?? 0) + 1)
  }
  const out = new Map<string, number>()
  for (const r of records) {
    const v = r.venueId ? byVenue.get(r.venueId) : undefined
    if (!v || r.status !== 'received' || r.category === 'reimbursement') continue
    out.set(r.id, venueCostOf(r.amountRon, v, monthCount.get(`${r.venueId}|${r.date.slice(0, 7)}`) ?? 1))
  }
  return out
}

export interface DealSession {
  id: string
  date: string
  description: string
  revenue: number
  attendees: number | null
  venueCost: number
  takeHome: number
}

export interface VenueDeal {
  venue: Venue
  sessions: DealSession[]
  revenue: number
  venueCost: number
  takeHome: number
  takePerSession: number
  /** Venue cost ÷ revenue: the share the venue effectively took. */
  effectiveShare: number | null
  /** Average people per session, over sessions with a head count. */
  avgAttendees: number | null
  /** Revenue per person, over sessions with a head count. */
  revenuePerHead: number | null
  /** Fixed and hybrid deals: people a session needs before the fee is covered. */
  breakEvenAttendees: number | null
  losing: DealSession[]
  lost: number
}

export function venueDeal(venue: Venue, records: IncomeRecord[], r: { from: string; to: string }): VenueDeal {
  const rs = sessionsAt(records, venue.id, r)
  const months = new Map<string, number>()
  for (const x of rs) months.set(x.date.slice(0, 7), (months.get(x.date.slice(0, 7)) ?? 0) + 1)
  const sessions = rs.map((x): DealSession => {
    const cost = venueCostOf(x.amountRon, venue, months.get(x.date.slice(0, 7)) ?? 1)
    return { id: x.id, date: x.date, description: x.description, revenue: x.amountRon, attendees: x.attendees, venueCost: cost, takeHome: round2(x.amountRon - cost) }
  }).sort((a, b) => a.date.localeCompare(b.date))
  const sum = (f: (s: DealSession) => number) => round2(sessions.reduce((a, s) => a + f(s), 0))
  const revenue = sum((s) => s.revenue)
  const venueCost = sum((s) => s.venueCost)
  const counted = sessions.filter((s) => s.attendees && s.attendees > 0)
  const heads = counted.reduce((a, s) => a + (s.attendees ?? 0), 0)
  const revenuePerHead = heads ? round2(counted.reduce((a, s) => a + s.revenue, 0) / heads) : null
  const keepPerHead = revenuePerHead === null ? null : revenuePerHead * (1 - (venue.deal === 'hybrid' ? venue.sharePct : 0))
  const losing = sessions.filter((s) => s.takeHome < 0)
  return {
    venue, sessions, revenue, venueCost,
    takeHome: round2(revenue - venueCost),
    takePerSession: sessions.length ? round2((revenue - venueCost) / sessions.length) : 0,
    effectiveShare: revenue > 0 ? venueCost / revenue : null,
    avgAttendees: counted.length ? Math.round((heads / counted.length) * 10) / 10 : null,
    revenuePerHead,
    breakEvenAttendees: (venue.deal === 'fixed' || venue.deal === 'hybrid') && keepPerHead && keepPerHead > 0
      ? Math.ceil(venue.feePerSession / keepPerHead) : null,
    losing,
    lost: round2(-losing.reduce((a, s) => a + s.takeHome, 0)),
  }
}

/** Every venue with a deal and at least one session in the range, most take-home first. */
export function venueDeals(venues: Venue[], records: IncomeRecord[], r: { from: string; to: string }): VenueDeal[] {
  return venues
    .map((v) => venueDeal(v, records, r))
    .filter((d) => d.sessions.length > 0)
    .sort((a, b) => b.takeHome - a.takeHome)
}

export interface DealCurvePoint {
  attendees: number
  current: number
  alternative: number
}

/**
 * What one session leaves you at each head count, under the current deal and
 * an alternative: the "fixed or share?" picture. Monthly rent is read per session.
 */
export function dealCurve(
  pricePerHead: number,
  current: Pick<Venue, 'deal' | 'feePerSession' | 'sharePct' | 'monthlyFee'>,
  alternative: Pick<Venue, 'deal' | 'feePerSession' | 'sharePct' | 'monthlyFee'>,
  maxAttendees: number,
): DealCurvePoint[] {
  const points: DealCurvePoint[] = []
  for (let n = 0; n <= maxAttendees; n++) {
    const rev = n * pricePerHead
    points.push({ attendees: n, current: round2(rev - venueCostOf(rev, current)), alternative: round2(rev - venueCostOf(rev, alternative)) })
  }
  return points
}

/** The head count at which the two deals leave you the same, if they cross. */
export function crossover(points: DealCurvePoint[]): number | null {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].current - points[i - 1].alternative
    const b = points[i].current - points[i].alternative
    if (a === 0) return points[i - 1].attendees
    if ((a < 0 && b >= 0) || (a > 0 && b <= 0)) {
      // Interpolate between the two head counts.
      return Math.round((points[i - 1].attendees + Math.abs(a) / (Math.abs(a) + Math.abs(b))) * 10) / 10
    }
  }
  return null
}

/** A sensible "what if" to compare against: the other kind of deal at today's equivalent price. */
export function defaultAlternative(d: VenueDeal): Pick<Venue, 'deal' | 'feePerSession' | 'sharePct' | 'monthlyFee'> {
  const v = d.venue
  if (v.deal === 'share') {
    // A fixed fee equal to what the share cost per session on average.
    const fee = d.sessions.length ? Math.round(d.venueCost / d.sessions.length / 10) * 10 : 0
    return { deal: 'fixed', feePerSession: fee, sharePct: 0, monthlyFee: 0 }
  }
  // Fixed, hybrid, monthly: the share that would have cost the same overall, else 30%.
  const share = d.effectiveShare && d.effectiveShare > 0 ? Math.min(0.9, Math.round(d.effectiveShare * 20) / 20) : 0.3
  return { deal: 'share', feePerSession: 0, sharePct: share, monthlyFee: 0 }
}
