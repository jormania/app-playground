/**
 * Venue deals: what each kind of arrangement costs you, session by session.
 *
 * Read from the deal terms set on the venue (a 600-lei evening fee, a 30%
 * share), not from recorded costs, so a beginner sees the answer without
 * keeping a ledger. A payment covers its `sessions` (1 unless it's a package
 * or a payout): a fixed fee is paid for each of them.
 *
 *   fixed    you pay the fee per session whoever turns up
 *   share    the venue takes a share of what the session brings in
 *   hybrid   both
 *   monthly  rent per month, spread over that month's sessions there
 *   none     nothing (online, client's office, an agency pays)
 */
import type { DealTerms, IncomeRecord, Venue } from '../domain/types'
import { DEAL } from '../domain/vocabulary'
import { lei, percent, round2 } from './money'

const inRange = (d: string, r: { from: string; to: string }) => d >= r.from && d <= r.to

/** The deal in a few words: "Fixed fee · 600 lei a session", "Revenue share · 30%". */
export function describeTerms(t: DealTerms): string {
  switch (t.deal) {
    case 'fixed': return `${DEAL.fixed} · ${lei(t.feePerSession)} a session`
    case 'share': return `${DEAL.share} · ${percent(t.sharePct)}`
    case 'hybrid': return `${DEAL.hybrid} · ${lei(t.feePerSession)} + ${percent(t.sharePct)}`
    case 'monthly': return `${DEAL.monthly} · ${lei(t.monthlyFee)} a month`
    case 'none': return DEAL.none
  }
}

/** A venue's current deal, as a set of terms. */
export const termsOf = (v: Pick<Venue, 'deal' | 'feePerSession' | 'sharePct' | 'monthlyFee'>): DealTerms =>
  ({ deal: v.deal, feePerSession: v.feePerSession, sharePct: v.sharePct, monthlyFee: v.monthlyFee })

/**
 * The deal a payment was made under: its own snapshot, else (data from before snapshots, never
 * migrated) the venue's current deal. Editing a venue therefore changes only new payments.
 */
export function termsFor(r: Pick<IncomeRecord, 'dealTerms'>, v: Venue): DealTerms {
  return r.dealTerms ?? termsOf(v)
}

export const sameTerms = (a: DealTerms, b: DealTerms): boolean =>
  a.deal === b.deal && a.feePerSession === b.feePerSession && a.sharePct === b.sharePct && a.monthlyFee === b.monthlyFee

/**
 * The snapshot a payment is saved with. A new payment, or one moved to another venue, takes the
 * venue's deal as it is now; a payment that stays at its venue keeps the deal it has (or, saved
 * before snapshots, the venue's current deal, which is what it was being counted under). No venue,
 * no terms. `keep` puts a payment back exactly as it was (undoing a delete).
 */
export function stampTerms(r: IncomeRecord, stored: IncomeRecord | undefined, venues: Venue[], opts: { keep?: boolean } = {}): IncomeRecord {
  if (!r.venueId) return r.dealTerms === null ? r : { ...r, dealTerms: null }
  if (opts.keep && r.dealTerms) return r
  const v = venues.find((x) => x.id === r.venueId)
  const current = v ? termsOf(v) : undefined
  if (stored && stored.venueId === r.venueId) return { ...r, dealTerms: r.dealTerms ?? stored.dealTerms ?? current }
  return current ? { ...r, dealTerms: current } : r
}

/**
 * What a payment costs at its venue. A refund's adjustment row costs nothing: the venue's fee or
 * share was paid on the original, and InFlow doesn't assume the venue gives any of it back.
 */
const costApplies = (r: IncomeRecord) => !r.refundOf

/** Sessions that earn: received, at a venue, not a reimbursement. Refunds at the venue are included, as negative revenue. */
export function sessionsAt(records: IncomeRecord[], venueId: string, r: { from: string; to: string }): IncomeRecord[] {
  return records.filter((x) => x.status === 'received' && x.venueId === venueId && x.category !== 'reimbursement' && inRange(x.date, r))
}

/**
 * What the venue costs for a payment covering `sessions` sessions under its deal.
 * `sessionsThatMonth` spreads monthly rent over the month's sessions.
 */
export function venueCostOf(revenue: number, v: Pick<Venue, 'deal' | 'feePerSession' | 'sharePct' | 'monthlyFee'>, sessionsThatMonth = 1, sessions = 1): number {
  switch (v.deal) {
    case 'fixed': return round2(v.feePerSession * sessions)
    case 'share': return round2(revenue * v.sharePct)
    case 'hybrid': return round2(v.feePerSession * sessions + revenue * v.sharePct)
    case 'monthly': return round2((v.monthlyFee / Math.max(1, sessionsThatMonth)) * sessions)
    case 'none': return 0
  }
}

/** Venue cost per record id, under each record's venue deal. */
export function venueCosts(records: IncomeRecord[], venues: Venue[]): Map<string, number> {
  const byVenue = new Map(venues.map((v) => [v.id, v]))
  const monthCount = new Map<string, number>()
  for (const r of records) {
    if (r.status !== 'received' || !r.venueId || r.category === 'reimbursement' || !costApplies(r)) continue
    const k = `${r.venueId}|${r.date.slice(0, 7)}`
    monthCount.set(k, (monthCount.get(k) ?? 0) + (r.sessions ?? 1))
  }
  const out = new Map<string, number>()
  for (const r of records) {
    const v = r.venueId ? byVenue.get(r.venueId) : undefined
    if (!v || r.status !== 'received' || r.category === 'reimbursement' || !costApplies(r)) continue
    out.set(r.id, venueCostOf(r.amountRon, termsFor(r, v), monthCount.get(`${r.venueId}|${r.date.slice(0, 7)}`) ?? 1, r.sessions ?? 1))
  }
  return out
}

export interface DealSession {
  id: string
  date: string
  description: string
  revenue: number
  attendees: number | null
  /** Sessions this payment covers. */
  sessions: number
  venueCost: number
  takeHome: number
}

export interface VenueDeal {
  venue: Venue
  /** One entry per payment; `sessionCount` adds up the sessions they cover. */
  sessions: DealSession[]
  sessionCount: number
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
  /** Paid back in the period on payments here (positive); already taken off `revenue`. Never a session. */
  refunded: number
  /** Payments here counted under a deal the venue no longer has (each keeps the one it was made under). */
  underEarlierDeal: number
}

export function venueDeal(venue: Venue, records: IncomeRecord[], r: { from: string; to: string }): VenueDeal {
  const all = sessionsAt(records, venue.id, r)
  // Sessions are payments; a refund in the period is not a session (D8). It still comes off the
  // venue's revenue, as it comes off revenue in Profit, and is shown on its own line.
  const rs = all.filter((x) => !x.refundOf)
  const refunded = round2(-all.filter((x) => x.refundOf).reduce((a, x) => a + x.amountRon, 0))
  const months = new Map<string, number>()
  for (const x of rs) months.set(x.date.slice(0, 7), (months.get(x.date.slice(0, 7)) ?? 0) + (x.sessions ?? 1))
  const sessions = rs.map((x): DealSession => {
    const n = x.sessions ?? 1
    const cost = venueCostOf(x.amountRon, termsFor(x, venue), months.get(x.date.slice(0, 7)) ?? 1, n)
    return { id: x.id, date: x.date, description: x.description, revenue: x.amountRon, attendees: x.attendees, sessions: n, venueCost: cost, takeHome: round2(x.amountRon - cost) }
  }).sort((a, b) => a.date.localeCompare(b.date))
  const sum = (f: (s: DealSession) => number) => round2(sessions.reduce((a, s) => a + f(s), 0))
  const revenue = round2(sum((s) => s.revenue) - refunded)
  const venueCost = sum((s) => s.venueCost)
  const sessionCount = sessions.reduce((a, s) => a + s.sessions, 0)
  const counted = sessions.filter((s) => s.attendees && s.attendees > 0)
  // People who came is per session: a 4-session payment with 6 people is 24 seats.
  const heads = counted.reduce((a, s) => a + (s.attendees ?? 0) * s.sessions, 0)
  const revenuePerHead = heads ? round2(counted.reduce((a, s) => a + s.revenue, 0) / heads) : null
  const keepPerHead = revenuePerHead === null ? null : revenuePerHead * (1 - (venue.deal === 'hybrid' ? venue.sharePct : 0))
  const losing = sessions.filter((s) => s.takeHome < 0)
  return {
    venue, sessions, sessionCount, revenue, venueCost, refunded,
    takeHome: round2(revenue - venueCost),
    takePerSession: sessionCount ? round2((revenue - venueCost) / sessionCount) : 0,
    effectiveShare: revenue > 0 ? venueCost / revenue : null,
    avgAttendees: counted.length ? Math.round((heads / counted.reduce((a, s) => a + s.sessions, 0)) * 10) / 10 : null,
    revenuePerHead,
    breakEvenAttendees: (venue.deal === 'fixed' || venue.deal === 'hybrid') && keepPerHead && keepPerHead > 0
      ? Math.ceil(venue.feePerSession / keepPerHead) : null,
    losing,
    lost: round2(-losing.reduce((a, s) => a + s.takeHome, 0)),
    underEarlierDeal: rs.filter((x) => !x.refundOf && x.dealTerms && !sameTerms(x.dealTerms, termsOf(venue))).length,
  }
}

/** Every venue with a deal and at least one session in the range, most take-home first. */
export function venueDeals(venues: Venue[], records: IncomeRecord[], r: { from: string; to: string }): VenueDeal[] {
  return venues
    .map((v) => venueDeal(v, records, r))
    .filter((d) => d.sessions.length > 0)
    .sort((a, b) => b.takeHome - a.takeHome)
}

/**
 * Venues with refunds in the range but no session in it: money paid back for sessions in an
 * earlier period. Not a deal to rank (D8); the screen names them so the refund isn't lost from view.
 */
export function refundsWithoutSessions(venues: Venue[], records: IncomeRecord[], r: { from: string; to: string }): { venue: Venue; refunded: number }[] {
  return venues.map((v) => venueDeal(v, records, r)).filter((d) => d.sessions.length === 0 && d.refunded > 0).map((d) => ({ venue: d.venue, refunded: d.refunded }))
}

/** A sensible "what if" to compare against: the other kind of deal at today's equivalent price. */
export function defaultAlternative(d: VenueDeal): Terms {
  const v = d.venue
  if (v.deal === 'share') {
    // A fixed fee equal to what the share cost per session on average.
    const fee = d.sessionCount ? Math.round(d.venueCost / d.sessionCount / 10) * 10 : 0
    return { deal: 'fixed', feePerSession: fee, sharePct: 0, monthlyFee: 0 }
  }
  // Fixed, hybrid, monthly: the share that would have cost the same overall, else 30%.
  const share = d.effectiveShare && d.effectiveShare > 0 ? Math.min(0.9, Math.round(d.effectiveShare * 20) / 20) : 0.3
  return { deal: 'share', feePerSession: 0, sharePct: share, monthlyFee: 0 }
}


/** A venue's deal terms: the actual ones on the venue, or a hypothetical set to compare. */
export type Terms = DealTerms

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
  const hypothetical = round2(d.sessions.reduce((s, x) => s + x.revenue - venueCostOf(x.revenue, alt, 1, x.sessions), 0) - d.refunded)
  const current = d.takeHome
  const difference = round2(hypothetical - current)
  return { current, hypothetical, difference, differencePct: current > 0 ? difference / current : null }
}

/** Totals across venues: revenue, paid to the venues, retained. */
export function dealTotals(deals: VenueDeal[]): { sessions: number; revenue: number; venueCost: number; retained: number } {
  const t = deals.reduce((a, d) => ({ sessions: a.sessions + d.sessionCount, revenue: a.revenue + d.revenue, venueCost: a.venueCost + d.venueCost }), { sessions: 0, revenue: 0, venueCost: 0 })
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

/**
 * A venue's deal changed on `from` (which may be earlier than the day it was edited): the payments
 * there from that date that still carry the old deal, or none, move to the new one; earlier ones
 * keep the old. A payment given another deal by hand is left alone. Returns the payments to save.
 */
export function restampFrom(records: IncomeRecord[], venueId: string, old: DealTerms, next: DealTerms, from: string): IncomeRecord[] {
  return records
    .filter((r) => r.venueId === venueId && !r.refundOf && r.date >= from && (r.dealTerms === undefined || r.dealTerms === null || sameTerms(r.dealTerms, old)))
    .map((r) => ({ ...r, dealTerms: next }))
}

export interface DealSpan { terms: DealTerms; payments: number; from: string; to: string }

/** The deals payments at a venue were counted under, in date order: how a price changed over the period. */
export function dealHistory(records: IncomeRecord[], venue: Venue): DealSpan[] {
  const spans: DealSpan[] = []
  for (const r of [...records].filter((x) => x.venueId === venue.id && !x.refundOf).sort((a, b) => a.date.localeCompare(b.date))) {
    const t = termsFor(r, venue)
    const last = spans.at(-1)
    if (last && sameTerms(last.terms, t)) { last.payments++; last.to = r.date } else spans.push({ terms: t, payments: 1, from: r.date, to: r.date })
  }
  return spans
}
