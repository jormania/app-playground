/**
 * The two rules INFLOW.md calls delicate, made to fail loudly:
 * a year's ruleset is frozen once it exists, and a stored reserve is never
 * recomputed. A slip in either gives a believable wrong number, not a crash.
 */
import { describe, expect, it } from 'vitest'
import { RULESETS } from './rules'

// Copied by hand from rules.ts when each year was published. Do not update these to make the
// test pass: a correction ships as a new id (RO-2026.1) and the old one stays exactly as it was.
const FROZEN = {
  'RO-2025': { year: 2025, minWage: 4050, incomeTaxRate: 0.1, casRate: 0.25, cassRate: 0.1, casLevels: [12, 24], cassMinWages: 6, cassMaxWages: 60, dividendCassBands: [6, 12, 24], dividendTaxRate: 0.1, microRate: 0.01, microThresholdEur: 250000, vatThresholdRon: 395000, vatRate: 0.21 },
  'RO-2026': { year: 2026, minWage: 4050, incomeTaxRate: 0.1, casRate: 0.25, cassRate: 0.1, casLevels: [12, 24], cassMinWages: 6, cassMaxWages: 72, dividendCassBands: [6, 12, 24], dividendTaxRate: 0.16, microRate: 0.01, microThresholdEur: 100000, vatThresholdRon: 395000, vatRate: 0.21 },
}

describe('published rulesets are frozen', () => {
  for (const [id, figures] of Object.entries(FROZEN)) {
    it(`${id} has not been edited in place`, () => {
      const r = RULESETS.find((x) => x.id === id)
      expect(r, `${id} was removed; records still point at it`).toBeTruthy()
      const { sources: _s, microNote: _m, id: _id, ...now } = r!
      expect(now, `${id} changed. Ship a corrected ruleset under a new id instead.`).toEqual(figures)
    })
  }

  it('every rate is a share between 0 and 1, and thresholds are positive', () => {
    for (const r of RULESETS) {
      for (const k of ['incomeTaxRate', 'casRate', 'cassRate', 'dividendTaxRate', 'microRate', 'vatRate'] as const) {
        expect(r[k], `${r.id}.${k}`).toBeGreaterThanOrEqual(0)
        expect(r[k], `${r.id}.${k} looks like a percentage, not a share`).toBeLessThan(1)
      }
      expect(r.minWage).toBeGreaterThan(1000)
      expect(r.cassMaxWages).toBeGreaterThan(r.cassMinWages)
    }
  })
})
