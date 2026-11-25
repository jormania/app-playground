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

/** A sensible "what if" to compare against: the other kind of deal at today's equivalent price. */
export function defaultAlternative(d: VenueDeal): Terms {
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


/** A venue's deal terms: the actual ones on the venue, or a hypothetical set to compare. */
export type Terms = Pick<Venue, 'deal' | 'feePerSession' | 'sharePct' | 'monthlyFee'>

export interface Scenario {
  /** Retained under the venue's actual deal (as recorded). */
  current: number
  /** Retained on the same sessions under the hypothetical terms. */
  hypothetical: number
  /** hypothetical − current, lei. */
  difference: number
  /** difference ÷ current; null when current is zero or below. */
  differencePct: number | null
}

/**
 * The same sessions, the same revenue, other terms: what you would have
 * retained. Pure — the venue and its records are never changed.
 */
export function scenario(d: VenueDeal, alt: Terms): Scenario {
  const hypothetical = round2(d.sessions.reduce((s, x) => s + x.revenue - venueCostOf(x.revenue, alt), 0))
  const current = d.takeHome
  const difference = round2(hypothetical - current)
  return { current, hypothetical, difference, differencePct: current > 0 ? difference / current : null }
}

/** Totals across venues: revenue, paid to the venues, retained. */
export function dealTotals(deals: VenueDeal[]): { sessions: number; revenue: number; venueCost: number; retained: number } {
  const t = deals.reduce((a, d) => ({ sessions: a.sessions + d.sessions.length, revenue: a.revenue + d.revenue, venueCost: a.venueCost + d.venueCost }), { sessions: 0, revenue: 0, venueCost: 0 })
  return { sessions: t.sessions, revenue: round2(t.revenue), venueCost: round2(t.venueCost), retained: round2(t.revenue - t.venueCost) }
}

/**
 * A fixed fee is covered once a session brings in the fee itself. Shown with
 * the head count it takes at the venue's recorded price per head, when there is one.
 */
export function feeCoveredAt(d: VenueDeal): { revenue: number; people: number | null } | null {
  if (d.venue.deal !== 'fixed') return null
  const fee = d.venue.feePerSession
  return { revenue: fee, people: d.revenuePerHead && d.revenuePerHead > 0 ? Math.ceil(fee / d.revenuePerHead) : null }
}

/**
 * A genuine data question: two payments at a fixed-fee venue on the same day
 * count as two sessions, and two fees. The number of such extra payments.
 */
export function sameDayRepeats(d: VenueDeal): number {
  return d.sessions.length - new Set(d.sessions.map((x) => x.date)).size
}

/** What one more person at a session leaves you under these terms. */
export function keptPerPerson(t: Terms, pricePerPerson: number): number {
  const share = t.deal === 'share' || t.deal === 'hybrid' ? t.sharePct : 0
  return round2(pricePerPerson * (1 - share))
}

/**
 * How many people a session needs before the venue's fee is covered, at a
 * price per person. Fixed fee (and fee + share): the fee over what each person
 * leaves you, rounded up. A revenue share has no fee to cover: null.
 */
export function breakEvenPeople(t: Terms, pricePerPerson: number): number | null {
  if (t.deal !== 'fixed' && t.deal !== 'hybrid') return null
  const each = keptPerPerson(t, pricePerPerson)
  if (!(each > 0)) return null
  return Math.max(1, Math.ceil(t.feePerSession / each - 1e-9))
}
