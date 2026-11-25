/**
 * Romanian tax rules, one frozen ruleset per fiscal year.
 *
 * A ruleset is never edited once a year has records against it: a correction
 * ships as a new id (RO-2026.1) and the old one stays, so a stored suggestion
 * can always be traced to the figures that produced it. Records keep the id
 * they were suggested under (`IncomeRecord.taxRules`) and their stored reserve
 * is never recomputed when rules change.
 *
 * Sources (read 2026-11-25):
 *  - ANAF, "Completarea și depunerea Declarației Unice privind impozitul pe
 *    venit și contribuțiile sociale datorate de persoanele fizice — activități
 *    independente" (AJFP Cluj, 22 Apr 2026): the 2025–2026 CAS/CASS table —
 *    CAS 25% on 12 or 24 minimum wages; CASS 10% between 6 and 60 (2025) /
 *    72 (2026) minimum wages; 4,050 lei reference wage; income tax 10% of
 *    (net income − CAS − CASS) in sistem real; normă: CASS on the adjusted
 *    norm, income tax 10% of the norm; the CASS-minimum exceptions (salary
 *    ≥ 6 minimum wages, pension, etc.).
 *    https://static.anaf.ro/static/10/Cluj/cj_DU_activ_indep_22apr2026.pdf
 *  - Legea 239/2025 (M.O. 1160/15.12.2025): CASS ceiling 60 → 72 minimum wages
 *    for independent activities from 2026 income.
 *  - Legea 141/2025: dividend tax 10% → 16% from 1 Jan 2026.
 *  - OUG 156/2024, OUG 89/2025: micro-enterprise threshold €250,000 (2025) →
 *    €100,000 (2026); single 1% rate from 2026.
 *  - OG 22/2025: VAT small-business exemption threshold 395,000 lei from
 *    1 Sep 2025 (art. 310 Cod fiscal). Standard VAT rate 21% from 1 Aug 2025.
 *  - HG 146/2026 raised the minimum wage to 4,325 lei from 1 Jul 2026; ANAF's
 *    2026 table still computes the thresholds on 4,050 lei, so that is used.
 */

export interface Ruleset {
  id: string
  year: number
  /** Minimum gross monthly wage the thresholds are counted in. */
  minWage: number
  incomeTaxRate: number
  casRate: number
  cassRate: number
  /** CAS base levels, in minimum wages: due from the first, capped at the second. */
  casLevels: [number, number]
  cassMinWages: number
  cassMaxWages: number
  /** CASS on investment income (dividends): flat bands, in minimum wages. */
  dividendCassBands: [number, number, number]
  dividendTaxRate: number
  microRate: number
  /** Note shown beside the micro rate, where it isn't the whole story. */
  microNote?: string
  microThresholdEur: number
  vatThresholdRon: number
  vatRate: number
  sources: string[]
}

const SOURCES_2026 = [
  'ANAF — Declarația unică, activități independente (Cluj, 22.04.2026)',
  'Legea 239/2025 — CASS ceiling 72 minimum wages',
  'Legea 141/2025 — dividend tax 16%',
  'OUG 156/2024, OUG 89/2025 — micro 1%, €100,000',
  'OG 22/2025 — VAT exemption threshold 395,000 lei',
]

export const RULESETS: Ruleset[] = [
  {
    id: 'RO-2025',
    year: 2025,
    minWage: 4050,
    incomeTaxRate: 0.10,
    casRate: 0.25,
    cassRate: 0.10,
    casLevels: [12, 24],
    cassMinWages: 6,
    cassMaxWages: 60,
    dividendCassBands: [6, 12, 24],
    dividendTaxRate: 0.10,
    microRate: 0.01,
    microNote: 'In 2025 some activities, consultancy among them, and revenue above €60,000 paid 3%. Check your CAEN code and set the rate in Settings.',
    microThresholdEur: 250_000,
    vatThresholdRon: 395_000,
    vatRate: 0.21,
    sources: [
      'ANAF — Declarația unică, activități independente (Cluj, 22.04.2026)',
      'OUG 156/2024 — micro thresholds',
      'OG 22/2025 — VAT exemption threshold 395,000 lei (300,000 before 1 Sep 2025)',
    ],
  },
  {
    id: 'RO-2026',
    year: 2026,
    minWage: 4050,
    incomeTaxRate: 0.10,
    casRate: 0.25,
    cassRate: 0.10,
    casLevels: [12, 24],
    cassMinWages: 6,
    cassMaxWages: 72,
    dividendCassBands: [6, 12, 24],
    dividendTaxRate: 0.16,
    microRate: 0.01,
    microThresholdEur: 100_000,
    vatThresholdRon: 395_000,
    vatRate: 0.21,
    sources: SOURCES_2026,
  },
]

export interface RulesetLookup {
  rules: Ruleset
  /** True when no ruleset exists for the year and the nearest one stands in. */
  provisional: boolean
}

/** The ruleset for a fiscal year; the nearest one, flagged provisional, when there is none. */
export function rulesFor(year: number): RulesetLookup {
  const exact = RULESETS.find((r) => r.year === year)
  if (exact) return { rules: exact, provisional: false }
  const sorted = [...RULESETS].sort((a, b) => a.year - b.year)
  const nearest = year < sorted[0].year ? sorted[0] : sorted[sorted.length - 1]
  return { rules: nearest, provisional: true }
}

export function rulesById(id: string): Ruleset | undefined {
  return RULESETS.find((r) => r.id === id)
}
