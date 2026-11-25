/**
 * Guards against a wrong number that looks reasonable.
 *
 * A typo in InFlow doesn't crash anything: an extra zero, a rate typed
 * upside down or a payment entered twice just becomes a believable total, and
 * a reserve stored for the old amount stays (reserves are never recomputed).
 * So before a save, the forms ask these checks. Each finding is a warning, not
 * a block: the person can fix it in one tap where there's an obvious fix, or
 * save anyway. Only the impossible (more tax than the payment) is refused, in
 * the forms themselves.
 *
 * Every comparison is with the person's own history, never a fixed price list.
 */
import type { CostRecord, Currency, IncomeRecord } from '../domain/types'
import { addDays, daysBetween, shortDate } from './dates'
import { lei } from './money'

export interface Finding {
  id: string
  text: string
  /** A one-tap correction, where the right value is plain. */
  fix?: { label: string; apply: Fix }
}

export type Fix =
  | { kind: 'amount'; value: number }
  | { kind: 'fxRate'; value: number }
  | { kind: 'status'; value: 'expected' | 'due' }
  | { kind: 'reserve'; value: number }

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}

/** The rate last used for a currency, from what is already recorded. */
export function lastRate(currency: Currency, items: { currency: Currency; fxRate: number; date: string }[]): number | null {
  if (currency === 'RON') return null
  const xs = items.filter((x) => x.currency === currency && x.fxRate > 0).sort((a, b) => b.date.localeCompare(a.date))
  return xs.length ? xs[0].fxRate : null
}

function rateCheck(currency: Currency, fxRate: number, history: { currency: Currency; fxRate: number; date: string }[]): Finding | null {
  const ref = lastRate(currency, history)
  if (!ref || !(fxRate > 0)) return null
  const ratio = fxRate / ref
  if (ratio > 0.75 && ratio < 1.33) return null
  return {
    id: 'fx',
    text: `1 ${currency} = ${fxRate} lei, against ${ref} last time. Typed the wrong way round, or a missing decimal?`,
    fix: { label: `Use ${ref}`, apply: { kind: 'fxRate', value: ref } },
  }
}

function amountCheck(amountRon: number, usual: number[], who: string, amount: number, fxRate: number): Finding | null {
  if (usual.length < 3) return null
  const m = median(usual)
  if (m <= 0) return null
  if (amountRon >= m * 8) {
    // An extra zero (or two): offer the amount that matches the usual size.
    const tenth = amountRon / 10 >= m / 3 && amountRon / 10 <= m * 3 ? amount / 10 : amountRon / 100 >= m / 3 && amountRon / 100 <= m * 3 ? amount / 100 : null
    return {
      id: 'amount-high',
      text: `${lei(amountRon)} is ${Math.round(amountRon / m)}× ${who} usual ${lei(m)}. An extra zero?`,
      fix: tenth !== null ? { label: `Make it ${lei(Math.round(tenth * fxRate * 100) / 100)}`, apply: { kind: 'amount', value: Math.round(tenth * 100) / 100 } } : undefined,
    }
  }
  if (amountRon <= m / 8) {
    return { id: 'amount-low', text: `${lei(amountRon)} is far below ${who} usual ${lei(m)}. A missing zero, or a decimal point?` }
  }
  return null
}

function dateChecks(date: string, today: string, settled: boolean, kind: 'income' | 'cost'): Finding[] {
  const out: Finding[] = []
  if (settled && date > today) {
    out.push(kind === 'income'
      ? { id: 'future', text: `Received on ${shortDate(date)}, which hasn't come yet. Is it expected instead?`, fix: { label: 'Make it expected', apply: { kind: 'status', value: 'expected' } } }
      : { id: 'future', text: `Paid on ${shortDate(date)}, which hasn't come yet. Is it due instead?`, fix: { label: 'Make it due', apply: { kind: 'status', value: 'due' } } })
  }
  if (date < addDays(today, -400)) out.push({ id: 'old', text: `Dated ${shortDate(date, 0)}, over a year ago. Right year?` })
  if (date > addDays(today, 400)) out.push({ id: 'far', text: `Dated ${shortDate(date, 0)}, more than a year ahead. Right year?` })
  return out
}

export interface IncomeContext {
  records: IncomeRecord[]
  today: string
  /** The record as stored, when editing. */
  before?: IncomeRecord | null
  /** What the tax estimate suggests setting aside now, when tax is on. */
  suggestedReserve?: number | null
}

export function incomeFindings(r: IncomeRecord, ctx: IncomeContext): Finding[] {
  const out: Finding[] = []
  const others = ctx.records.filter((x) => x.id !== r.id)
  const received = others.filter((x) => x.status === 'received' && x.category !== 'reimbursement')

  out.push(...dateChecks(r.date, ctx.today, r.status === 'received', 'income'))

  const fx = r.currency !== 'RON' ? rateCheck(r.currency, r.fxRate, others) : null
  if (fx) out.push(fx)

  // The same client's own amounts first; with no history there, the practice's as a whole, loosely.
  if (r.category !== 'reimbursement') {
    const mine = r.clientId ? received.filter((x) => x.clientId === r.clientId).map((x) => x.amountRon) : []
    if (mine.length >= 3) {
      const a = amountCheck(r.amountRon, mine, "this client's", r.amount, r.fxRate)
      if (a) out.push(a)
    } else {
      // A new client can pay more than usual; only something far beyond any normal payment is queried.
      const all = received.map((x) => x.amountRon)
      if (all.length >= 5 && r.amountRon >= median(all) * 25) out.push({ id: 'amount-high', text: `${lei(r.amountRon)} is far above anything you usually receive. Right amount?` })
    }
  }

  // Entered twice: same client, same amount, within three days.
  const twin = others.find((x) => x.status === r.status && x.clientId === r.clientId && x.currency === r.currency && Math.abs(x.amount - r.amount) < 0.005 && Math.abs(daysBetween(x.date, r.date)) <= 3)
  if (twin) out.push({ id: 'duplicate', text: `The same ${lei(r.amountRon)} from this client is already in, on ${shortDate(twin.date)}. Add it again?` })

  if (r.sessions > 40) out.push({ id: 'sessions', text: `${r.sessions} sessions in one payment?` })
  if (r.hours !== null && r.hours > Math.max(12, r.sessions * 10)) out.push({ id: 'hours', text: `${r.hours} hours for ${r.sessions} ${r.sessions === 1 ? 'session' : 'sessions'}?` })
  if (r.attendees !== null && r.attendees > 300) out.push({ id: 'attendees', text: `${r.attendees} people at one session?` })

  // A stored reserve stays as it was set; say so when the amount under it has changed.
  const b = ctx.before
  if (b && r.taxReserve !== null && r.taxReserve === b.taxReserve && Math.abs(b.amountRon - r.amountRon) >= 1 && ctx.suggestedReserve != null) {
    const s = ctx.suggestedReserve
    if (Math.abs(s - r.taxReserve) > Math.max(20, r.taxReserve * 0.15)) {
      out.push({
        id: 'reserve-stale',
        text: `The ${lei(r.taxReserve)} set aside was for ${lei(b.amountRon)}. For ${lei(r.amountRon)} the suggestion is ${lei(s)}.`,
        fix: { label: `Use ${lei(s)}`, apply: { kind: 'reserve', value: s } },
      })
    }
  }
  if (r.taxReserve !== null && r.taxReserve > r.amountRon * 0.45 && r.taxReserve <= r.amountRon) {
    out.push({ id: 'reserve-high', text: `Setting aside ${Math.round((r.taxReserve / r.amountRon) * 100)}% of this payment: more than tax usually takes.` })
  }
  return out
}

/** The impossible: refused outright, not just flagged. */
export function incomeErrors(r: Pick<IncomeRecord, 'amountRon' | 'taxReserve' | 'taxWithheld'>): string | null {
  if (r.taxReserve !== null && r.taxReserve > r.amountRon) return 'The tax set aside is more than the payment.'
  if (r.taxWithheld > r.amountRon) return 'The tax withheld is more than the payment.'
  if (r.taxReserve !== null && r.taxReserve < 0) return 'The tax set aside can\'t be negative.'
  return null
}

export function costFindings(c: CostRecord, ctx: { costs: CostRecord[]; today: string }): Finding[] {
  const out: Finding[] = []
  const others = ctx.costs.filter((x) => x.id !== c.id)
  out.push(...dateChecks(c.date, ctx.today, c.status === 'paid', 'cost'))
  const fx = c.currency !== 'RON' ? rateCheck(c.currency, c.fxRate, others) : null
  if (fx) out.push(fx)
  // Against the same kind of cost: rent against rent, software against software.
  const same = others.filter((x) => x.category === c.category && x.status === 'paid').map((x) => x.amountRon)
  const a = amountCheck(c.amountRon, same, 'the', c.amount, c.fxRate)
  if (a) out.push(a)
  const twin = others.find((x) => x.category === c.category && x.currency === c.currency && Math.abs(x.amount - c.amount) < 0.005 && Math.abs(daysBetween(x.date, c.date)) <= 3
    && x.description.trim().toLowerCase() === c.description.trim().toLowerCase())
  if (twin) out.push({ id: 'duplicate', text: `"${c.description}" for ${lei(c.amountRon)} is already in, on ${shortDate(twin.date)}. Add it again?` })
  return out
}
