/**
 * The tax estimator: annual liability for a tax profile, and the effective
 * rate that turns it into a per-payment reserve suggestion.
 *
 * Why an effective rate and not "this payment's marginal tax": Romanian
 * contributions are annual and stepped. CAS is nothing below 12 minimum wages
 * and a fixed amount above; the CASS minimum (6 minimum wages) is owed in full
 * on the first leu. A marginal figure would hang 2,430 lei of CASS on January's
 * first invoice and charge 3,000+ lei of CAS to whichever payment crosses the
 * threshold. Reading the year's liability at the projected annual income and
 * dividing by that income gives one honest rate to put aside from each payment.
 *
 * Everything here is advisory. The user sets each record's actual treatment.
 */
import type { CostRecord, IncomeRecord, TaxProfile } from '../domain/types'
import { deductibleCosts } from '../lib/finance'
import { daysBetween, yearOf } from '../lib/dates'
import { round2 } from '../lib/money'
import { rulesFor, type Ruleset } from './rules'

export interface EstimateLine {
  key: string
  label: string
  /** The base the rate applies to, RON; null where the amount is a flat figure. */
  base: number | null
  rate: number | null
  amount: number
  note?: string
}

export interface Estimate {
  year: number
  rules: Ruleset
  provisional: boolean
  /** Taxable income (gross receipts) the estimate is read at, RON. */
  gross: number
  expenses: number
  /** Net income (PFA real), the norm (PFA normă), or profit before tax (SRL). */
  base: number
  lines: EstimateLine[]
  total: number
  /** Things the estimate can't know and the user should. */
  notes: string[]
}

const r0 = (n: number) => Math.round(n)

/** CAS for independent activities: nothing, 12 or 24 minimum wages × 25%. */
export function casFor(net: number, rules: Ruleset, profile: Pick<TaxProfile, 'casExempt' | 'casOptIn'>): EstimateLine {
  const [low, high] = rules.casLevels
  const lowBase = low * rules.minWage
  const highBase = high * rules.minWage
  if (profile.casExempt) {
    return { key: 'cas', label: 'CAS (pension)', base: null, rate: rules.casRate, amount: 0, note: 'Exempt (set in your tax profile).' }
  }
  let base = 0
  let note: string | undefined
  if (net >= highBase) base = highBase
  else if (net >= lowBase) base = lowBase
  else if (profile.casOptIn) { base = lowBase; note = 'Below the threshold; paid by choice.' }
  else note = `Not due below ${low} minimum wages (${lowBase.toLocaleString('en-US')} lei net).`
  return { key: 'cas', label: 'CAS (pension)', base, rate: rules.casRate, amount: r0(base * rules.casRate), note }
}

/** CASS for independent activities: 10% of net, floored at 6 and capped at 60/72 minimum wages. */
export function cassFor(net: number, rules: Ruleset, profile: Pick<TaxProfile, 'cassCoveredElsewhere'>): EstimateLine {
  const min = rules.cassMinWages * rules.minWage
  const max = rules.cassMaxWages * rules.minWage
  let base = Math.min(Math.max(net, 0), max)
  let note: string | undefined
  if (net <= 0) base = 0
  else if (base < min) {
    if (profile.cassCoveredElsewhere) note = 'Below the minimum base; not topped up because you are insured otherwise.'
    else { base = min; note = `Minimum base of ${rules.cassMinWages} minimum wages applies.` }
  }
  if (net > max) note = `Capped at ${rules.cassMaxWages} minimum wages.`
  return { key: 'cass', label: 'CASS (health)', base, rate: rules.cassRate, amount: r0(base * rules.cassRate), note }
}

/** CASS on dividends: flat bands at 6, 12 and 24 minimum wages. */
export function dividendCassFor(dividends: number, rules: Ruleset): EstimateLine {
  const [b1, b2, b3] = rules.dividendCassBands.map((w) => w * rules.minWage)
  const base = dividends >= b3 ? b3 : dividends >= b2 ? b2 : dividends >= b1 ? b1 : 0
  return {
    key: 'cass_div', label: 'CASS on dividends', base, rate: rules.cassRate, amount: r0(base * rules.cassRate),
    note: base === 0 ? `Not due below ${rules.dividendCassBands[0]} minimum wages of dividends.` : undefined,
  }
}

export function estimateYear(profile: TaxProfile, year: number, gross: number): Estimate {
  const { rules, provisional } = rulesFor(year)
  const notes: string[] = []
  if (provisional) notes.push(`No ${year} ruleset yet; using the ${rules.year} figures until it is added.`)
  gross = Math.max(0, gross)

  switch (profile.id) {
    case 'pfa_real': {
      const expenses = Math.max(0, profile.annualExpenses)
      const net = Math.max(0, gross - expenses)
      const cas = casFor(net, rules, profile)
      const cass = cassFor(net, rules, profile)
      const taxBase = Math.max(0, net - cas.amount - cass.amount)
      const tax: EstimateLine = { key: 'income_tax', label: 'Income tax', base: taxBase, rate: rules.incomeTaxRate, amount: r0(taxBase * rules.incomeTaxRate), note: 'On net income less CAS and CASS.' }
      if (expenses === 0) notes.push('No deductible expenses set; add your expected expenses in Settings for a closer figure.')
      notes.push('Assumes independent activity is your only income of this kind; other income can change CAS and CASS.')
      return finish({ year, rules, provisional, gross, expenses, base: net, lines: [cas, cass, tax], notes })
    }
    case 'pfa_norma': {
      const norm = Math.max(0, profile.annualNorm)
      if (norm === 0) notes.push('Enter your annual income norm in Settings; under normă the tax follows the norm, not what you earn.')
      const cas = casFor(norm, rules, profile)
      const cass = cassFor(norm, rules, profile)
      const tax: EstimateLine = { key: 'income_tax', label: 'Income tax', base: norm, rate: rules.incomeTaxRate, amount: r0(norm * rules.incomeTaxRate), note: 'On the annual norm, whatever you actually earn.' }
      notes.push('Under normă de venit the amount is fixed for the year; the reserve spreads it over your income.')
      return finish({ year, rules, provisional, gross, expenses: 0, base: norm, lines: [cas, cass, tax], notes })
    }
    case 'srl_micro': {
      const rate = profile.microRate ?? rules.microRate
      const micro: EstimateLine = { key: 'micro', label: 'Micro-enterprise tax', base: gross, rate, amount: r0(gross * rate), note: rules.microNote ?? `On revenue; the micro regime needs revenue under €${rules.microThresholdEur.toLocaleString('en-US')} and at least one employee.` }
      const expenses = Math.max(0, profile.annualExpenses)
      const profit = Math.max(0, gross - expenses - micro.amount)
      const dividends = round2(profit * clamp01(profile.dividendPayout))
      const divTax: EstimateLine = { key: 'dividend_tax', label: 'Dividend tax', base: dividends, rate: rules.dividendTaxRate, amount: r0(dividends * rules.dividendTaxRate), note: `On ${Math.round(clamp01(profile.dividendPayout) * 100)}% of profit paid out.` }
      const divCass = dividendCassFor(dividends, rules)
      notes.push('Company revenue, not personal income: salary costs and VAT are not modelled.')
      return finish({ year, rules, provisional, gross, expenses, base: profit, lines: [micro, divTax, divCass], notes })
    }
    case 'custom': {
      const rate = clamp01(profile.customRate)
      notes.push('A flat percentage you chose. It does not model Romanian thresholds.')
      return finish({ year, rules, provisional, gross, expenses: 0, base: gross, lines: [{ key: 'custom', label: 'Reserve at your rate', base: gross, rate, amount: r0(gross * rate) }], notes })
    }
  }
}

function finish(e: Omit<Estimate, 'total'>): Estimate {
  return { ...e, total: e.lines.reduce((s, l) => s + l.amount, 0) }
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, Number(n) || 0))
}

/** Counts toward taxable income: received, taxable, not marked "no tax due". */
export function countsAsTaxable(r: IncomeRecord): boolean {
  return r.status === 'received' && r.taxability === 'taxable' && r.taxHandling !== 'none'
}

export function taxableGross(records: IncomeRecord[], year: number, upTo?: string): number {
  return round2(records
    .filter((r) => countsAsTaxable(r) && yearOf(r.date) === year && (!upTo || r.date <= upTo))
    .reduce((s, r) => s + r.amountRon, 0))
}

export interface Projection {
  year: number
  /** Taxable income so far this year. */
  ytd: number
  /** The annual income the rate is read at. */
  projected: number
  method: 'expected' | 'run_rate' | 'actual'
  estimate: Estimate
  /** total ÷ projected, capped at MAX_RATE — the share of each taxable leu to put aside. */
  rate: number
  /** The uncapped rate. */
  rawRate: number
  /** True when fixed minimums pushed the rate past MAX_RATE. */
  capped: boolean
}

/** The most a reserve suggestion takes from one payment. */
export const MAX_RATE = 0.45

/** Days of the year counted before annualising: early January otherwise extrapolates wildly. */
const MIN_ELAPSED_DAYS = 60

export function projectYear(profile: TaxProfile, records: IncomeRecord[], year: number, today: string, extra = 0, costs: CostRecord[] = []): Projection {
  // Refunds can take a year's recorded taxable income below zero; the estimate starts at zero (D5).
  const ytd = Math.max(0, round2(taxableGross(records, year) + extra))
  let projected: number
  let method: Projection['method']
  const todayYear = yearOf(today)
  const days = daysBetween(`${year}-01-01`, `${year}-12-31`) + 1
  const elapsed = year < todayYear ? days : year > todayYear ? 1 : daysBetween(`${year}-01-01`, today) + 1
  // How far the year so far is scaled up to a whole year.
  const factor = days / Math.max(elapsed, MIN_ELAPSED_DAYS)
  if (profile.expectedAnnualIncome > 0) {
    projected = Math.max(profile.expectedAnnualIncome, ytd)
    method = 'expected'
  } else if (year < todayYear) {
    projected = ytd
    method = 'actual'
  } else {
    projected = Math.max(round2(ytd * factor), ytd)
    method = 'run_rate'
  }
  // Recorded deductible costs replace the typed estimate, annualised the same way.
  const fromCosts = profile.expensesFromCosts && costs.length > 0 && (profile.id === 'pfa_real' || profile.id === 'srl_micro')
  const effective = fromCosts
    ? { ...profile, annualExpenses: round2(deductibleCosts(costs, year) * (year < todayYear ? 1 : factor)) }
    : profile
  const estimate = estimateYear(effective, year, projected)
  if (fromCosts) estimate.notes.unshift(`Expenses read from your recorded deductible costs${year < todayYear ? '' : ', annualised'}: ${Math.round(estimate.expenses).toLocaleString('en-US')} lei.`)
  const raw = projected > 0 ? estimate.total / projected : profile.id === 'custom' ? clamp01(profile.customRate) : 0
  // Early in a year, or on a small income, fixed minimums (CASS on 6 minimum wages) can exceed the
  // income itself. A reserve above the payment helps nobody: the rate is capped, and the report
  // still shows the whole minimum owed.
  const capped = raw > MAX_RATE
  if (capped) estimate.notes.unshift(`On ${Math.round(projected).toLocaleString('en-US')} lei a year, fixed minimums make the rate ${(raw * 100).toFixed(0)}%; reserves are capped at ${MAX_RATE * 100}% per payment. The full amount is still in the estimate.`)
  return { year, ytd, projected, method, estimate, rate: Math.min(raw, MAX_RATE), rawRate: raw, capped }
}

export interface ReserveSuggestion {
  amount: number
  rate: number
  rulesId: string
  explanation: string
}

/**
 * The reserve to suggest for one record: its share at the year's effective
 * rate, less tax already withheld on it. Zero for anything not taxable.
 * `others` should exclude the record itself (it is added in for the projection).
 */
export function suggestReserve(
  record: Pick<IncomeRecord, 'amountRon' | 'date' | 'taxability' | 'taxHandling' | 'taxWithheld' | 'status'>,
  others: IncomeRecord[],
  profile: TaxProfile,
  today: string,
  costs: CostRecord[] = [],
): ReserveSuggestion {
  const year = yearOf(record.date || today)
  const { rules } = rulesFor(year)
  if (record.taxability !== 'taxable' || record.taxHandling === 'none') {
    return { amount: 0, rate: 0, rulesId: rules.id, explanation: 'Not taxable as classified, so nothing to reserve.' }
  }
  const counts = record.status === 'received' ? record.amountRon : 0
  const p = projectYear(profile, others, year, today, counts, costs)
  const gross = round2(record.amountRon * p.rate)
  const amount = Math.max(0, Math.round(gross - (record.taxWithheld || 0)))
  const how = p.method === 'expected' ? 'your expected' : p.method === 'actual' ? 'the actual' : 'a projected'
  const withheld = record.taxWithheld > 0 ? `, less ${Math.round(record.taxWithheld)} lei already withheld` : ''
  return {
    amount,
    rate: p.rate,
    rulesId: p.estimate.rules.id,
    explanation: p.capped
      ? `${(p.rate * 100).toFixed(0)}% of this payment${withheld}, the cap: at ${how} ${Math.round(p.projected).toLocaleString('en-US')} lei a year, fixed minimums outweigh the income.`
      : `${(p.rate * 100).toFixed(1)}% of this payment${withheld}: the ${year} rate at ${how} ${Math.round(p.projected).toLocaleString('en-US')} lei of taxable income.`,
  }
}

/**
 * What one deductible cost does to the year's tax estimate: the estimate
 * without it, less the estimate with it, on the same projected income. Under
 * sistem real a cost lowers the net income that income tax and CASS are read
 * from (CAS moves only across its thresholds); under a micro company it lowers
 * the profit paid out as dividends. Under normă or a custom rate on income,
 * costs change nothing, and the note says so.
 */
export function costTaxEffect(profile: TaxProfile, records: IncomeRecord[], costs: CostRecord[], cost: Pick<CostRecord, 'id' | 'amountRon' | 'date'>, today: string): { saving: number; note: string | null } {
  if (profile.id === 'pfa_norma') return { saving: 0, note: 'Under normă de venit the tax follows the norm, so costs don\'t lower it.' }
  if (profile.id === 'custom') return { saving: 0, note: 'Your custom rate applies to income, so costs don\'t change it.' }
  const year = yearOf(cost.date)
  const others = costs.filter((c) => c.id !== cost.id || !cost.id)
  const p = projectYear(profile, records, year, today, 0, others)
  const base = profile.expensesFromCosts ? p.estimate.expenses : Math.max(0, profile.annualExpenses)
  const without = estimateYear({ ...profile, annualExpenses: base }, year, p.projected).total
  const withIt = estimateYear({ ...profile, annualExpenses: base + cost.amountRon }, year, p.projected).total
  return { saving: Math.max(0, round2(without - withIt)), note: null }
}

/** What the gap reads as: never "ahead" by nothing. */
export const gapLabel = (gap: number): string => (gap > 0 ? 'Still to set aside' : gap < 0 ? 'Ahead of your reserve by' : 'Nothing more to set aside')

/** Said beside the estimate when refunds exceed the year's recorded income (D5). */
export const REFUNDS_EXCEED_NOTE = "Refunds this year exceed the taxable income recorded, so the estimate counts this year's taxable income as 0. How a refund larger than the year's income is treated is a question for your accountant."

/**
 * Where this year's tax stands, so far: what the year's income to date owes at the year's
 * effective rate, what payers withheld, what is stored as set aside, and the gap ("still to set
 * aside" when positive, "ahead" when negative). One definition for the Tax report, the printable
 * report and Available to spend.
 */
export interface TaxPosition {
  year: number
  rate: number
  owed: number
  withheld: number
  reserved: number
  gap: number
  /** The year's taxable income as recorded, refunds included: below zero when they exceed it. */
  rawTaxable: number
  /** Refunds exceed the year's recorded taxable income: the estimate treats it as zero (D5). */
  refundsExceedIncome: boolean
}

export function taxPosition(profile: TaxProfile, records: IncomeRecord[], year: number, today: string, costs: CostRecord[] = []): TaxPosition {
  const p = projectYear(profile, records, year, today, 0, costs)
  const yr = records.filter((r) => r.status === 'received' && yearOf(r.date) === year && r.date <= today)
  const rawTaxable = taxableGross(records, year, today)
  // Never a negative tax: a refund larger than the year's income is not a credit here (D5).
  const owed = Math.round(Math.max(0, rawTaxable) * p.rate)
  const withheld = round2(yr.reduce((s, r) => s + (r.taxWithheld || 0), 0))
  const reserved = round2(yr.reduce((s, r) => s + (r.taxReserve ?? 0), 0))
  return { year, rate: p.rate, owed, withheld, reserved, gap: Math.round(owed - withheld - reserved), rawTaxable, refundsExceedIncome: rawTaxable < 0 }
}
