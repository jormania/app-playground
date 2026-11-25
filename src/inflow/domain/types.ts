/**
 * InFlow's data model. Four kinds of thing, kept apart on purpose:
 *
 *   IncomeRecord — one payment, received or expected
 *   Client       — who paid
 *   Source       — how the work arrived (direct, agency, platform, …)
 *   Venue        — where the work happened (a room, Zoom, a client's office)
 *
 * The same four live as four Notion databases (see INFLOW.md); the select
 * values below are a closed vocabulary mirrored there.
 */

export type Currency =
  | 'RON' | 'EUR' | 'USD' | 'GBP' | 'CHF' | 'HUF' | 'PLN' | 'CZK'
  | 'SEK' | 'NOK' | 'DKK' | 'CAD' | 'AUD' | 'JPY' | 'TRY'

export type Taxability = 'taxable' | 'non_taxable' | 'review'
export type TaxHandling = 'withheld' | 'self_declared' | 'none' | 'other'
export type VatTreatment = 'applicable' | 'not_applicable' | 'exempt' | 'reverse_charge' | 'undetermined'
export type PaymentStatus = 'received' | 'expected'
export type Category =
  | 'coaching_1on1' | 'group_coaching' | 'workshop' | 'retreat'
  | 'speaking' | 'content' | 'reimbursement' | 'other'

export type ClientKind = 'individual' | 'business'
export type ClientCountry = 'RO' | 'EU' | 'NON_EU'
export type SourceType = 'direct' | 'agency' | 'platform' | 'referral' | 'recurring' | 'royalties' | 'other'
/** What a source usually means for tax; feeds the suggestion, never overrides the user. */
export type SourceTaxDefault = 'profile' | 'withheld' | 'non_taxable' | 'review'
export type VenueType = 'in_person' | 'online' | 'hybrid' | 'client_site'

export interface IncomeRecord {
  id: string
  description: string
  amount: number
  currency: Currency
  /** RON per one unit of `currency` on the day received. 1 for RON. */
  fxRate: number
  /** amount × fxRate, rounded to bani. Every total is built from this. */
  amountRon: number
  /** YYYY-MM-DD, local. */
  date: string
  status: PaymentStatus
  clientId: string | null
  sourceId: string | null
  venueId: string | null
  category: Category | null
  recurring: boolean
  notes: string

  taxability: Taxability
  taxHandling: TaxHandling
  vat: VatTreatment
  /** 'suggested' until the user changes or confirms a tax field. */
  classification: 'suggested' | 'confirmed'
  /** Stored, never recomputed behind the user's back. null = no reserve set. */
  taxReserve: number | null
  reserveSource: 'suggested' | 'manual' | null
  /** Tax actually withheld by the payer, or paid, for this payment (RON). */
  taxWithheld: number
  /** The ruleset that produced the stored suggestion, e.g. "RO-2026". */
  taxRules: string
  demo?: boolean
}

export interface Client {
  id: string
  name: string
  kind: ClientKind
  country: ClientCountry
  contact: string
  notes: string
  archived: boolean
  demo?: boolean
}

export interface Source {
  id: string
  name: string
  type: SourceType
  description: string
  active: boolean
  taxDefault: SourceTaxDefault
  demo?: boolean
}

export interface Venue {
  id: string
  name: string
  type: VenueType
  location: string
  notes: string
  archived: boolean
  demo?: boolean
}

export interface InflowData {
  records: IncomeRecord[]
  clients: Client[]
  sources: Source[]
  venues: Venue[]
}

export type TaxProfileId = 'pfa_real' | 'pfa_norma' | 'srl_micro' | 'custom'

export interface TaxProfile {
  id: TaxProfileId
  /** Registered for VAT (art. 316). Off = the small-business exemption (art. 310). */
  vatRegistered: boolean
  /** Salaried (≥ 6 minimum wages), pensioner, or otherwise insured: the CASS minimum base doesn't apply. */
  cassCoveredElsewhere: boolean
  /** Exempt from CAS (e.g. pensioner). */
  casExempt: boolean
  /** Pay CAS on 12 minimum wages even when net income is below the threshold. */
  casOptIn: boolean
  /** PFA real: deductible expenses expected for the year, RON. SRL: company expenses. */
  annualExpenses: number
  /** PFA normă: the annual income norm after adjustments, RON. */
  annualNorm: number
  /** SRL micro: override of the ruleset's micro rate, as a fraction. null = ruleset default. */
  microRate: number | null
  /** SRL: share of after-tax profit paid out as dividends (0–1). */
  dividendPayout: number
  /** Custom: flat reserve, as a fraction of taxable income. */
  customRate: number
  /**
   * Expected taxable income for the year, RON. 0 = project it from the year so
   * far. The effective rate behind every reserve suggestion is read at this figure,
   * because the thresholds make the rate depend on the whole year, not one payment.
   */
  expectedAnnualIncome: number
}

export type ThemeChoice = 'system' | 'light' | 'dark'
export type DataMode = 'device' | 'notion'

export interface Settings {
  theme: ThemeChoice
  mode: DataMode
  notionToken: string
  incomeDbId: string
  tax: TaxProfile
  /** Monthly income target in RON; 0 = none. */
  monthlyTarget: number
  /** An entry this many times the typical (median) amount gets flagged. */
  largeMultiple: number
  /** Device mode only: demo data was seeded once, so an emptied list stays empty. */
  demoSeeded: boolean
  /**
   * Tax is optional. Off: no reserves, no tax panels, no tax tab — just the
   * money flow. Records still carry a suggested classification, quietly, so
   * switching it on later has something to start from.
   */
  trackTax: boolean
  /** Show the welcome tour when the app opens. The tour's own checkbox sets it. */
  showTour: boolean
}
