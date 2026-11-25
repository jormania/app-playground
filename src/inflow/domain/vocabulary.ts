/**
 * Labels for every closed value, and the exact Notion select option each one
 * is stored as. The Notion names must match the options registered on the
 * databases (INFLOW.md, "Notion"): writing an unregistered option makes Notion
 * reject the whole page write. Add an option in Notion first, then here.
 */
import type {
  Category, ClientCountry, CostCategory, CostGroup, CostStatus, DealType, ClientKind, Currency, PaymentStatus, SourceTaxDefault,
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

/** "Activity" in the interface: the kind of work. Same map, the name people use. */
export const ACTIVITY = CATEGORY

export const COST_GROUP: Record<CostGroup, string> = {
  direct: 'Direct cost (COGS)',
  operating: 'Operating cost (SG&A)',
  depreciation: 'Depreciation',
  interest: 'Interest',
  tax: 'Tax on profit',
  investment: 'Investment',
  financing: 'Financing',
}

/** Short group names for P&L rows and tags. */
export const COST_GROUP_SHORT: Record<CostGroup, string> = {
  direct: 'Direct',
  operating: 'Operating',
  depreciation: 'Depreciation',
  interest: 'Interest',
  tax: 'Tax',
  investment: 'Investment',
  financing: 'Financing',
}

export const COST_GROUP_HINT: Record<CostGroup, string> = {
  direct: 'Exists because a piece of work happened: facilitator, room hired for it, materials, travel.',
  operating: 'Paid whatever the month brings: rent, software, the accountant, marketing.',
  depreciation: 'Spreads an equipment purchase over its life. In the P&L, never in cash flow.',
  interest: 'Interest on loans. Below operating profit.',
  tax: 'Income tax, CAS, CASS, micro or profit tax paid. Below profit before tax.',
  investment: 'Buying equipment: cash out, not a P&L cost (record its depreciation instead).',
  financing: 'Loan repayments, owner drawings, dividends: cash out, not a P&L cost.',
}

export const COST_CATEGORY: Record<CostCategory, string> = {
  facilitator: 'Facilitators & co-trainers',
  venue_hire: 'Room or venue hire',
  materials: 'Materials & refreshments',
  travel: 'Travel & accommodation',
  platform_fees: 'Platform & payment fees',
  rent: 'Rent',
  utilities: 'Utilities',
  software: 'Software & subscriptions',
  marketing: 'Marketing',
  accounting: 'Accounting & legal',
  phone_internet: 'Phone & internet',
  training: 'Training & certification',
  insurance: 'Insurance',
  bank_fees: 'Bank fees',
  other_operating: 'Other',
  depreciation: 'Equipment depreciation',
  loan_interest: 'Loan interest',
  income_tax: 'Income or profit tax',
  contributions: 'CAS & CASS',
  equipment: 'Equipment',
  loan_repayment: 'Loan repayment',
  owner_drawings: 'Owner drawings & dividends',
}

/** Which categories belong to which group; the form offers only these. */
export const CATEGORIES_BY_GROUP: Record<CostGroup, CostCategory[]> = {
  direct: ['facilitator', 'venue_hire', 'materials', 'travel', 'platform_fees'],
  operating: ['rent', 'utilities', 'software', 'marketing', 'accounting', 'phone_internet', 'training', 'insurance', 'bank_fees', 'travel', 'other_operating'],
  depreciation: ['depreciation'],
  interest: ['loan_interest'],
  tax: ['income_tax', 'contributions'],
  investment: ['equipment'],
  financing: ['loan_repayment', 'owner_drawings'],
}

export const COST_STATUS: Record<CostStatus, string> = { paid: 'Paid', due: 'Due' }

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

export const DEAL: Record<DealType, string> = {
  fixed: 'Fixed fee',
  share: 'Revenue share',
  hybrid: 'Fixed + share',
  monthly: 'Monthly rent',
  none: 'No venue cost',
}

export const DEAL_HINT: Record<DealType, string> = {
  fixed: 'You pay the venue a set amount per session, whatever the session brings in.',
  share: 'The venue receives a set percentage of each session\'s revenue.',
  hybrid: 'A fee per session plus a share of the takings.',
  monthly: 'Rent per month, used as often as you like.',
  none: 'No venue cost: online, the client\'s office, or an agency pays the room.',
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
