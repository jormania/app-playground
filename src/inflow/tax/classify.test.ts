import { describe, expect, it } from 'vitest'
import type { Client, Source, TaxProfile } from '../domain/types'
import { suggestClassification } from './classify'

const profile: TaxProfile = {
  id: 'pfa_real', vatRegistered: false, cassCoveredElsewhere: false, casExempt: false, casOptIn: false,
  annualExpenses: 0, annualNorm: 0, microRate: null, dividendPayout: 1, customRate: 0.2, expectedAnnualIncome: 0,
}
const client = (kind: Client['kind'], country: Client['country']): Client =>
  ({ id: 'c', name: 'C', kind, country, contact: '', notes: '', archived: false })
const source = (p: Partial<Source>): Source =>
  ({ id: 's', name: 'S', type: 'direct', description: '', active: true, taxDefault: 'profile', ...p })

describe('suggestClassification', () => {
  it('defaults to taxable, self-declared, VAT-exempt for an unregistered PFA', () => {
    const s = suggestClassification({ category: 'coaching_1on1', client: client('individual', 'RO'), source: null }, profile)
    expect([s.taxability, s.taxHandling, s.vat]).toEqual(['taxable', 'self_declared', 'exempt'])
    expect(s.reasons.vat).toMatch(/395,000/)
  })

  it('treats reimbursements as non-taxable with no VAT', () => {
    const s = suggestClassification({ category: 'reimbursement', client: null, source: null }, profile)
    expect([s.taxability, s.taxHandling, s.vat]).toEqual(['non_taxable', 'none', 'not_applicable'])
  })

  it('takes withholding from the source', () => {
    expect(suggestClassification({ category: null, client: null, source: source({ type: 'royalties' }) }, profile).taxHandling).toBe('withheld')
    expect(suggestClassification({ category: null, client: null, source: source({ taxDefault: 'withheld' }) }, profile).taxHandling).toBe('withheld')
  })

  it('leaves a source marked for review undecided', () => {
    const s = suggestClassification({ category: null, client: null, source: source({ taxDefault: 'review' }) }, profile)
    expect(s.taxability).toBe('review')
  })

  it('keeps VAT separate from income tax when VAT-registered', () => {
    const reg = { ...profile, vatRegistered: true }
    expect(suggestClassification({ category: null, client: client('business', 'RO'), source: null }, reg).vat).toBe('applicable')
    expect(suggestClassification({ category: null, client: client('business', 'EU'), source: null }, reg).vat).toBe('reverse_charge')
    expect(suggestClassification({ category: null, client: client('individual', 'EU'), source: null }, reg).vat).toBe('applicable')
    expect(suggestClassification({ category: null, client: client('business', 'NON_EU'), source: null }, reg).vat).toBe('not_applicable')
    expect(suggestClassification({ category: null, client: null, source: null }, reg).vat).toBe('undetermined')
    // Income tax is unaffected by VAT status.
    expect(suggestClassification({ category: null, client: client('business', 'EU'), source: null }, reg).taxability).toBe('taxable')
  })

  it('flags reverse charge for an EU business client even when not VAT-registered', () => {
    expect(suggestClassification({ category: null, client: client('business', 'EU'), source: null }, profile).vat).toBe('reverse_charge')
  })
})
