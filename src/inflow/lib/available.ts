/**
 * Estimated available to spend (audit F-01): roughly what of the money that has come in this
 * year is yours to use, once this year's tax and the bills already due are allowed for.
 *
 *   Received this year       cash that arrived: payments and cost recovery, less tax withheld at
 *                            source (it never arrived), less refunds paid back
 *   − Costs paid this year   every cost paid, depreciation aside (no cash moves)
 *   − Tax still owed         this year's income so far at the year's effective rate, less what
 *                            payers withheld, less tax paid towards this year (see below)
 *   − Costs due              costs marked due, dated up to 30 days ahead
 *   = Available to spend     an estimate, never a promise
 *
 * Withheld tax counts once: it is neither cash in nor still owed. Tax reserves set aside are
 * *not* counted as available: that money is earmarked for the tax still owed. Expected payments
 * are left out entirely: nothing is counted before it arrives.
 *
 * With an opening cash balance set (Reports → Cash flow), the starting point is the cash on hand
 * on 1 January (or on the opening date, if later), so the figure is a cash estimate; without one,
 * it starts from zero on 1 January and reads as "this year's money".
 *
 * **Tax paid during the year.** A tax payment is a paid cost, so it already lowers the cash. It
 * lowers what is still owed this year only when it is *for* this year: under a PFA (sistem real or
 * normă) the year's tax is declared and paid the following spring, so tax paid this year is
 * last year's; for an SRL on micro tax the quarterly payments made after 25 January are this
 * year's; under a custom profile all tax paid this year counts towards this year. Last year's tax
 * still unpaid is not in this figure: it is a known limit, said in the breakdown.
 */
import type { CostRecord, IncomeRecord, Settings } from '../domain/types'
import { taxPosition } from '../tax/estimate'
import { cashOf } from './analytics'
import { addDays, yearOf } from './dates'
import { balanceAt } from './finance'
import { round2 } from './money'

export interface Available {
  /** 1 January, or the opening-cash date when that is later in the year. */
  from: string
  /** Cash on hand at `from`; 0 without an opening balance. */
  startCash: number
  hasOpening: boolean
  received: number
  /** Of `received`: tax withheld at source, already left out. */
  withheldLeftOut: number
  costsPaid: number
  /** Tax still owed on this year's income so far (0 with tax tracking off or nothing owed). */
  taxOwed: number
  /** Tax paid this year that counted towards this year's tax. */
  taxPaidForThisYear: number
  /** Tax paid this year taken as last year's (PFA). */
  taxPaidForLastYear: number
  costsDue: number
  /** The due costs counted: dated up to this day. */
  dueBy: string
  available: number
  trackTax: boolean
  trackCosts: boolean
}

/** Is a tax payment on this date for this year's income, under this profile? */
export function paysThisYear(profileId: Settings['tax']['id'], date: string): boolean {
  if (profileId === 'pfa_real' || profileId === 'pfa_norma') return false
  if (profileId === 'srl_micro') return date.slice(5) > '01-25'
  return true
}

export function availableToSpend(
  records: IncomeRecord[], costs: CostRecord[], settings: Pick<Settings, 'tax' | 'openingCash' | 'openingCashDate'>, today: string,
  opts: { trackTax: boolean; trackCosts: boolean },
): Available {
  const year = yearOf(today)
  const yearStart = `${year}-01-01`
  const opening = settings.openingCashDate && settings.openingCashDate <= today ? settings.openingCashDate : ''
  const from = opening && opening > yearStart ? opening : yearStart
  const cs = opts.trackCosts ? costs : []
  const startCash = opening ? balanceAt(from, records, cs, settings.openingCash, opening) : 0
  const inWindow = (d: string) => d >= from && d <= today
  const got = records.filter((r) => r.status === 'received' && inWindow(r.date))
  const received = round2(got.reduce((s, r) => s + cashOf(r), 0))
  const withheldLeftOut = round2(got.reduce((s, r) => s + (r.taxWithheld || 0), 0))
  const paid = cs.filter((c) => c.status === 'paid' && c.group !== 'depreciation' && inWindow(c.date))
  const costsPaid = round2(paid.reduce((s, c) => s + c.amountRon, 0))
  const taxPaidThisYear = cs.filter((c) => c.status === 'paid' && c.group === 'tax' && c.date >= yearStart && c.date <= today)
  const forThis = round2(taxPaidThisYear.filter((c) => paysThisYear(settings.tax.id, c.date)).reduce((s, c) => s + c.amountRon, 0))
  const forLast = round2(taxPaidThisYear.reduce((s, c) => s + c.amountRon, 0) - forThis)
  const taxOwed = opts.trackTax
    ? Math.max(0, (() => { const p = taxPosition(settings.tax, records, year, today, cs); return Math.round(p.owed - p.withheld - forThis) })())
    : 0
  const dueBy = addDays(today, 30)
  const costsDue = round2(cs.filter((c) => c.status === 'due' && c.group !== 'depreciation' && c.date <= dueBy).reduce((s, c) => s + c.amountRon, 0))
  return {
    from, startCash, hasOpening: !!opening, received, withheldLeftOut, costsPaid, taxOwed, taxPaidForThisYear: forThis, taxPaidForLastYear: forLast,
    costsDue, dueBy, available: round2(startCash + received - costsPaid - taxOwed - costsDue), trackTax: opts.trackTax, trackCosts: opts.trackCosts,
  }
}
