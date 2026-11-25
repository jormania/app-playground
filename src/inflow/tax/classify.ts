/**
 * Suggested tax classification for a record: taxability, how the tax is
 * handled, and VAT, each with the reason behind it. Suggestions only — the
 * form shows them as such and the user's choice is what gets stored.
 *
 * Income tax and VAT are deliberately separate questions: a payment can be
 * fully taxable income and still carry no VAT (the small-business exemption),
 * or carry reverse-charge VAT the client accounts for.
 */
import type { Category, Client, Source, TaxHandling, TaxProfile, Taxability, VatTreatment } from '../domain/types'

export interface ClassificationSuggestion {
  taxability: Taxability
  taxHandling: TaxHandling
  vat: VatTreatment
  reasons: { taxability: string; taxHandling: string; vat: string }
}

export interface ClassifyInput {
  category: Category | null
  client: Client | null
  source: Source | null
}

export function suggestClassification(input: ClassifyInput, profile: TaxProfile): ClassificationSuggestion {
  const { category, client, source } = input
  let taxability: Taxability = 'taxable'
  let taxHandling: TaxHandling = 'self_declared'
  let tReason = 'Payment for your services: taxable income.'
  let hReason = profile.id === 'srl_micro'
    ? 'Revenue of the company, declared by the SRL.'
    : 'No tax withheld by the payer: you declare it in the Declarația unică.'

  if (category === 'reimbursement') {
    taxability = 'non_taxable'
    taxHandling = 'none'
    tReason = 'Reimbursed costs passed on at cost are usually not income. If you invoiced them with a margin, change this.'
    hReason = 'Nothing to declare if it is a pure reimbursement.'
  } else if (source?.taxDefault === 'non_taxable') {
    taxability = 'non_taxable'
    taxHandling = 'none'
    tReason = `"${source.name}" is set as non-taxable.`
    hReason = 'No tax due on non-taxable income.'
  } else if (source?.taxDefault === 'review') {
    taxability = 'review'
    taxHandling = 'other'
    tReason = `"${source.name}" is marked for review: decide this one case by case.`
    hReason = 'Undecided until you review it.'
  } else if (source?.taxDefault === 'withheld' || source?.type === 'royalties') {
    taxHandling = 'withheld'
    hReason = source.type === 'royalties'
      ? 'Royalties (drepturi de autor) usually have 10% tax withheld by the payer.'
      : `"${source.name}" withholds tax at source.`
  } else if (profile.id === 'pfa_norma') {
    hReason = 'Under normă de venit the tax follows the norm; this income is still declared.'
  }

  const vat = suggestVat(client, profile)
  return {
    taxability,
    taxHandling,
    vat: taxability === 'non_taxable' ? 'not_applicable' : vat.vat,
    reasons: {
      taxability: tReason,
      taxHandling: hReason,
      vat: taxability === 'non_taxable' ? 'Not a supply of services, so no VAT.' : vat.reason,
    },
  }
}

function suggestVat(client: Client | null, profile: TaxProfile): { vat: VatTreatment; reason: string } {
  const b2b = client?.kind === 'business'
  if (!profile.vatRegistered) {
    if (client?.country === 'EU' && b2b) {
      return { vat: 'reverse_charge', reason: 'EU business client: they account for the VAT. You need a VAT code for intra-EU services (art. 317).' }
    }
    return { vat: 'exempt', reason: 'Not VAT-registered: the small-business exemption applies below 395,000 lei a year (art. 310).' }
  }
  if (!client) return { vat: 'undetermined', reason: 'Pick a client to work out the place of supply.' }
  if (client.country === 'RO') return { vat: 'applicable', reason: 'VAT-registered, client in Romania: VAT applies (21% standard rate).' }
  if (client.country === 'EU') {
    return b2b
      ? { vat: 'reverse_charge', reason: 'EU business client: reverse charge, the client accounts for the VAT.' }
      : { vat: 'applicable', reason: 'EU private client: Romanian VAT applies under the general rule.' }
  }
  return b2b
    ? { vat: 'not_applicable', reason: 'Business client outside the EU: place of supply is outside Romania.' }
    : { vat: 'applicable', reason: 'Private client outside the EU: check the place of supply; the general rule taxes it here.' }
}

/** The 10% usually withheld when a payer withholds income tax. A starting figure, editable. */
export function suggestedWithholding(amountRon: number): number {
  return Math.round(amountRon * 0.10)
}
