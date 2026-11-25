import { describe, expect, it } from 'vitest'
import type { IncomeRecord, TaxProfile } from '../domain/types'
import { casFor, cassFor, dividendCassFor, estimateYear, projectYear, suggestReserve, taxableGross } from './estimate'
import { rulesFor, RULESETS } from './rules'

const base: TaxProfile = {
  id: 'pfa_real', vatRegistered: false, cassCoveredElsewhere: false, casExempt: false, casOptIn: false,
  annualExpenses: 0, annualNorm: 0, microRate: null, dividendPayout: 1, customRate: 0.2, expectedAnnualIncome: 0, expensesFromCosts: false,
}
const R2026 = rulesFor(2026).rules
const R2025 = rulesFor(2025).rules

function rec(p: Partial<IncomeRecord>): IncomeRecord {
  return {
    id: Math.random().toString(36), description: '', amount: 0, currency: 'RON', fxRate: 1, amountRon: 0,
    date: '2026-03-01', status: 'received', clientId: null, sourceId: null, venueId: null, category: null,
    recurring: false, notes: '', attendees: null, sessions: 1, hours: null, taxability: 'taxable', taxHandling: 'self_declared', vat: 'exempt',
    classification: 'confirmed', taxReserve: null, reserveSource: null, taxWithheld: 0, taxRules: 'RO-2026', ...p,
  }
}

describe('rulesets', () => {
  it('are versioned by year and never share an id', () => {
    expect(new Set(RULESETS.map((r) => r.id)).size).toBe(RULESETS.length)
    expect(R2026.cassMaxWages).toBe(72)
    expect(R2025.cassMaxWages).toBe(60)
    expect(R2026.dividendTaxRate).toBe(0.16)
    expect(R2025.dividendTaxRate).toBe(0.10)
  })

  it('stand in the nearest year, flagged provisional, when a year has none', () => {
    expect(rulesFor(2027)).toEqual({ rules: R2026, provisional: true })
    expect(rulesFor(2020).provisional).toBe(true)
    expect(rulesFor(2026).provisional).toBe(false)
  })
})

describe('CAS thresholds (12 / 24 minimum wages = 48,600 / 97,200 lei)', () => {
  it('is not due below 12 minimum wages', () => {
    expect(casFor(48_599, R2026, base).amount).toBe(0)
  })
  it('is 25% of 48,600 from 12 up to 24 minimum wages', () => {
    expect(casFor(48_600, R2026, base).amount).toBe(12_150)
    expect(casFor(97_199, R2026, base).amount).toBe(12_150)
  })
  it('is 25% of 97,200 from 24 minimum wages, however much more you earn', () => {
    expect(casFor(97_200, R2026, base).amount).toBe(24_300)
    expect(casFor(1_000_000, R2026, base).amount).toBe(24_300)
  })
  it('respects opting in below the threshold, and an exemption', () => {
    expect(casFor(20_000, R2026, { ...base, casOptIn: true }).amount).toBe(12_150)
    expect(casFor(200_000, R2026, { ...base, casExempt: true }).amount).toBe(0)
  })
})

describe('CASS (10%, between 6 and 72 minimum wages in 2026)', () => {
  it('tops a small net income up to the 6-minimum-wage base', () => {
    expect(cassFor(10_000, R2026, base).amount).toBe(2_430)
  })
  it('does not top up when insured elsewhere (salary, pension)', () => {
    expect(cassFor(10_000, R2026, { cassCoveredElsewhere: true }).amount).toBe(1_000)
  })
  it('is nothing on no income', () => {
    expect(cassFor(0, R2026, base).amount).toBe(0)
  })
  it('is capped at 72 minimum wages in 2026 and 60 in 2025', () => {
    expect(cassFor(500_000, R2026, base).amount).toBe(29_160)
    expect(cassFor(500_000, R2025, base).amount).toBe(24_300)
  })
})

describe('PFA sistem real', () => {
  it('reproduces ANAF\'s own worked example (net 57,000 lei)', () => {
    // ANAF Cluj, 22.04.2026: venit net 57,000 → CAS 12,150, CASS 5,700, impozit 3,915.
    const e = estimateYear({ ...base, annualExpenses: 38_000 }, 2025, 95_000)
    expect(e.base).toBe(57_000)
    expect(e.lines.map((l) => l.amount)).toEqual([12_150, 5_700, 3_915])
    expect(e.total).toBe(21_765)
  })

  it('deducts expenses before thresholds are tested', () => {
    const e = estimateYear({ ...base, annualExpenses: 20_000 }, 2026, 60_000)
    expect(e.base).toBe(40_000)
    expect(e.lines[0].amount).toBe(0) // under 48,600 net: no CAS
  })
})

describe('PFA normă de venit', () => {
  it('follows the norm, not what was earned (ANAF example: norm 42,150)', () => {
    const p = { ...base, id: 'pfa_norma' as const, annualNorm: 42_150 }
    const low = estimateYear(p, 2025, 10_000)
    const high = estimateYear(p, 2025, 300_000)
    expect(low.total).toBe(high.total)
    expect(low.lines.map((l) => l.amount)).toEqual([0, 4_215, 4_215])
  })
})

describe('SRL micro', () => {
  it('is 1% of revenue plus 16% dividend tax and banded CASS in 2026', () => {
    const p = { ...base, id: 'srl_micro' as const, annualExpenses: 0, dividendPayout: 1 }
    const e = estimateYear(p, 2026, 200_000)
    const [micro, div, cass] = e.lines
    expect(micro.amount).toBe(2_000)
    expect(div.base).toBe(198_000)
    expect(div.amount).toBe(31_680)
    expect(cass.amount).toBe(9_720) // 24 minimum wages band
  })
  it('bands dividend CASS at 6 / 12 / 24 minimum wages', () => {
    expect(dividendCassFor(24_299, R2026).amount).toBe(0)
    expect(dividendCassFor(24_300, R2026).amount).toBe(2_430)
    expect(dividendCassFor(48_600, R2026).amount).toBe(4_860)
    expect(dividendCassFor(97_200, R2026).amount).toBe(9_720)
  })
  it('uses 10% dividend tax for 2025', () => {
    const e = estimateYear({ ...base, id: 'srl_micro' }, 2025, 100_000)
    expect(e.lines[1].rate).toBe(0.10)
  })
})

describe('taxable income', () => {
  it('counts received, taxable records only — never expected, non-taxable, review or no-tax-due', () => {
    const rs = [
      rec({ amountRon: 1000 }),
      rec({ amountRon: 500, status: 'expected' }),
      rec({ amountRon: 300, taxability: 'non_taxable', taxHandling: 'none' }),
      rec({ amountRon: 200, taxability: 'review' }),
      rec({ amountRon: 100, taxHandling: 'none' }),
      rec({ amountRon: 700, taxHandling: 'withheld', taxWithheld: 70 }),
      rec({ amountRon: 900, date: '2025-12-31' }),
    ]
    expect(taxableGross(rs, 2026)).toBe(1700)
  })
})

describe('projection and reserve suggestion', () => {
  it('annualises the run rate, but never from fewer than 60 days', () => {
    const rs = [rec({ amountRon: 10_000, date: '2026-01-10' })]
    const p = projectYear(base, rs, 2026, '2026-01-15')
    expect(p.method).toBe('run_rate')
    expect(p.projected).toBeCloseTo(10_000 * 365 / 60, 0)
  })

  it('uses the expected annual income when one is set', () => {
    const p = projectYear({ ...base, expectedAnnualIncome: 120_000 }, [], 2026, '2026-06-01')
    expect(p.projected).toBe(120_000)
    expect(p.rate).toBeCloseTo(p.estimate.total / 120_000, 6)
  })

  it('uses actual income for a year already over', () => {
    const p = projectYear(base, [rec({ amountRon: 80_000, date: '2025-05-01' })], 2025, '2026-03-01')
    expect(p.method).toBe('actual')
    expect(p.projected).toBe(80_000)
  })

  it('subtracts tax already withheld from the suggestion', () => {
    const profile = { ...base, expectedAnnualIncome: 120_000 }
    const a = suggestReserve({ amountRon: 1000, date: '2026-05-01', taxability: 'taxable', taxHandling: 'self_declared', taxWithheld: 0, status: 'received' }, [], profile, '2026-05-01')
    const b = suggestReserve({ amountRon: 1000, date: '2026-05-01', taxability: 'taxable', taxHandling: 'withheld', taxWithheld: 100, status: 'received' }, [], profile, '2026-05-01')
    expect(b.amount).toBe(Math.max(0, a.amount - 100))
    expect(a.rulesId).toBe('RO-2026')
  })

  it('never suggests more than 45% of a payment, even when fixed minimums outweigh a tiny income', () => {
    const p = projectYear({ ...base, expectedAnnualIncome: 1_000 }, [], 2026, '2026-06-01')
    expect(p.rawRate).toBeGreaterThan(1)
    expect(p.rate).toBe(0.45)
    expect(p.capped).toBe(true)
    expect(p.estimate.notes[0]).toMatch(/capped/)
    const s = suggestReserve({ amountRon: 1000, date: '2026-06-01', taxability: 'taxable', taxHandling: 'self_declared', taxWithheld: 0, status: 'received' }, [], { ...base, expectedAnnualIncome: 1_000 }, '2026-06-01')
    expect(s.amount).toBe(450)
  })

  it('suggests nothing for non-taxable income', () => {
    const s = suggestReserve({ amountRon: 5000, date: '2026-05-01', taxability: 'non_taxable', taxHandling: 'none', taxWithheld: 0, status: 'received' }, [], base, '2026-05-01')
    expect(s.amount).toBe(0)
  })

  it('is not a flat 10%: the effective rate moves with the year\'s income', () => {
    const low = projectYear({ ...base, expectedAnnualIncome: 40_000 }, [], 2026, '2026-06-01').rate
    const mid = projectYear({ ...base, expectedAnnualIncome: 100_000 }, [], 2026, '2026-06-01').rate
    const high = projectYear({ ...base, expectedAnnualIncome: 600_000 }, [], 2026, '2026-06-01').rate
    expect(new Set([low, mid, high].map((r) => r.toFixed(3))).size).toBe(3)
    expect(high).toBeLessThan(mid) // CAS and CASS are capped, so the rate falls at the top
  })
})

describe('what a deductible cost does to the tax', () => {
  it('lowers the estimate by about a fifth of it under sistem real, and not at all under normă', async () => {
    const { buildDemo, DEMO_SETTINGS_TAX: real } = await import('../data/demo')
    const { costTaxEffect } = await import('./estimate')
    const d = buildDemo('2026-11-25')
    const cost = { id: '', amountRon: 1000, date: '2026-11-20' }
    const e = costTaxEffect(real, d.records, d.costs, cost, '2026-11-25')
    // 10% CASS on the lower net income, then 10% income tax on what's left: about 190 lei.
    expect(e.saving).toBeGreaterThan(150)
    expect(e.saving).toBeLessThan(260)
    expect(e.note).toBeNull()
    const norma = costTaxEffect({ ...real, id: 'pfa_norma' }, d.records, d.costs, cost, '2026-11-25')
    expect(norma.saving).toBe(0)
    expect(norma.note).toMatch(/normă/)
  })
})
