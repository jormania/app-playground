/**
 * Labels for every closed value, and the exact Notion select option each one
 * is stored as. The Notion names must match the options registered on the
 * databases (INFLOW.md, "Notion"): writing an unregistered option makes Notion
 * reject the whole page write. Add an option in Notion first, then here.
 */
import type {
  Category, ClientCountry, ClientKind, Currency, PaymentStatus, SourceTaxDefault,
  SourceType, TaxHandling, Taxability, TaxProfileId, VatTreatment, VenueType,
} from './types'

export const CURRENCIES: Currency[] = [
  'RON', 'EUR', 'USD', 'GBP', 'CHF', 'HUF', 'PLN', 'CZK', 'SEK', 'NOK', 'DKK', 'CAD', 'AUD', 'JPY', 'TRY',
]

export const TAXABILITY: Record<Taxability, string> = {
  taxable: 'Taxable',
  non_taxable: 'Non-taxable',
  review: 'Needs review',
}

export const TAX_HANDLING: Record<TaxHandling, string> = {
  withheld: 'Withheld at source',
  self_declared: 'Self-declared',
  none: 'No tax due',
  other: 'Other',
}

export const VAT: Record<VatTreatment, string> = {
  applicable: 'Applicable',
  not_applicable: 'Not applicable',
  exempt: 'Exempt',
  reverse_charge: 'Reverse charge',
  undetermined: 'Undetermined',
}

/** Short forms for the status labels on a list row. */
export const VAT_SHORT: Record<VatTreatment, string> = {
  applicable: 'VAT',
  not_applicable: 'No VAT',
  exempt: 'VAT exempt',
  reverse_charge: 'Reverse charge',
  undetermined: 'VAT ?',
}

export const STATUS: Record<PaymentStatus, string> = { received: 'Received', expected: 'Expected' }

export const CATEGORY: Record<Category, string> = {
  coaching_1on1: '1:1 coaching',
  group_coaching: 'Group coaching',
  workshop: 'Workshop',
  retreat: 'Retreat',
  speaking: 'Speaking',
  content: 'Content',
  reimbursement: 'Reimbursement',
  other: 'Other',
}

export const CLIENT_KIND: Record<ClientKind, string> = { individual: 'Individual', business: 'Business' }
export const CLIENT_COUNTRY: Record<ClientCountry, string> = { RO: 'Romania', EU: 'EU', NON_EU: 'Outside EU' }

export const SOURCE_TYPE: Record<SourceType, string> = {
  direct: 'Direct',
  agency: 'Agency',
  platform: 'Platform',
  referral: 'Referral',
  recurring: 'Recurring',
  royalties: 'Royalties',
  other: 'Other',
}

export const SOURCE_TAX_DEFAULT: Record<SourceTaxDefault, string> = {
  profile: 'Profile default',
  withheld: 'Withheld at source',
  non_taxable: 'Non-taxable',
  review: 'Needs review',
}

export const VENUE_TYPE: Record<VenueType, string> = {
  in_person: 'In person',
  online: 'Online',
  hybrid: 'Hybrid',
  client_site: 'Client site',
}

export const PROFILE: Record<TaxProfileId, string> = {
  pfa_real: 'PFA — sistem real',
  pfa_norma: 'PFA — normă de venit',
  srl_micro: 'SRL — microîntreprindere',
  custom: 'Other / custom rate',
}

/** Reverse lookup: Notion option name → our key. Unknown names give `fallback`. */
export function fromLabel<K extends string>(map: Record<K, string>, label: string | null | undefined, fallback: K): K {
  if (!label) return fallback
  const hit = (Object.keys(map) as K[]).find((k) => map[k] === label)
  return hit ?? fallback
}

export function options<K extends string>(map: Record<K, string>): { value: K; label: string }[] {
  return (Object.keys(map) as K[]).map((value) => ({ value, label: map[value] }))
}
