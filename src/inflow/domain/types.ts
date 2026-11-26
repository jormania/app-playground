/**
 * InFlow's data model, kept apart on purpose:
 *
 *   IncomeRecord — one payment, received or expected
 *   CostRecord   — one cost, paid or due (optional: Settings → Track costs)
 *   Client       — who paid
 *   Source       — how the work arrived (direct, agency, platform, …)
 *   Venue        — where the work happened (a room, Zoom, a client's office)
 *
 * "Activity" in the interface is `category` here: the kind of work (1:1
 * coaching, a workshop, a retreat…). It is a dimension like the others.
 *
 * The same five live as five Notion databases (see INFLOW.md); the select
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

/**
 * Where a cost sits in the P&L. Direct costs (COGS) exist because a piece of
 * work happened — the facilitator, the room hired for it, materials. Operating
 * costs (SG&A) are paid regardless — rent, software, the accountant. The last
 * two never touch the P&L: they are cash movements only.
 */
export type CostGroup = 'direct' | 'operating' | 'depreciation' | 'interest' | 'tax' | 'investment' | 'financing'
export type CostCategory =
  | 'facilitator' | 'venue_hire' | 'materials' | 'travel' | 'platform_fees'
  | 'rent' | 'utilities' | 'software' | 'marketing' | 'accounting' | 'phone_internet'
  | 'training' | 'insurance' | 'bank_fees' | 'other_operating'
  | 'depreciation' | 'loan_interest' | 'income_tax' | 'contributions'
  | 'equipment' | 'loan_repayment' | 'owner_drawings'
export type CostStatus = 'paid' | 'due'

export type ClientKind = 'individual' | 'business'
export type ClientCountry = 'RO' | 'EU' | 'NON_EU'
export type SourceType = 'direct' | 'agency' | 'platform' | 'referral' | 'recurring' | 'royalties' | 'other'
/** What a source usually means for tax; feeds the suggestion, never overrides the user. */
export type SourceTaxDefault = 'profile' | 'withheld' | 'non_taxable' | 'review'
export type VenueType = 'in_person' | 'online' | 'hybrid' | 'client_site'
/**
 * How a venue is paid. Fixed: a fee per booking, paid whoever turns up.
 * Share: the venue takes a percentage of what the session brings in.
 * Fixed + share: both. Monthly: rent whatever happens. None: no venue cost
 * (online, the client's office, an agency that pays the room).
 */
export type DealType = 'fixed' | 'share' | 'hybrid' | 'monthly' | 'none'

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
  /** People who came to each session (paid seats, participants). Optional; feeds venue-deal analysis. */
  attendees: number | null
  /** Sessions this payment covers: a 4-session package is 4, a monthly platform payout its sessions. Default 1. */
  sessions: number
  /** Total hours of work it covers, if known; gives what an hour keeps you. */
  hours: number | null

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
  /**
   * The venue's deal as it stood when this payment was added (or its venue last changed), so
   * editing the venue later never rewrites what past sessions cost. null with no venue. Absent
   * only on data read before snapshots existed; see `termsFor` and INFLOW.md, "Venue deals".
   */
  dealTerms?: DealTerms | null
  /**
   * A reimbursement can name the cost it repays: a link for the reader, so the cost shows as
   * reimbursed. It changes no figure: the cost stays a cost, the money back stays cost recovery.
   */
  repaysCostId?: string | null
  /**
   * Derived, never stored: set on the adjustment rows `lib/refunds.ts` makes from refunds, to
   * the id of the payment refunded. A stored payment never has it.
   */
  refundOf?: string
  demo?: boolean
}

/** A venue's deal terms, on the venue and as snapshotted on each payment there. */
export interface DealTerms {
  deal: DealType
  feePerSession: number
  sharePct: number
  monthlyFee: number
}

/**
 * Money paid back against one received payment: its own transaction, dated when it was paid
 * back, never a negative payment and never a change to the original. A payment can have several;
 * together they can't exceed it. Counted in the refund's own period (see INFLOW.md, "Refunds").
 */
export interface Refund {
  id: string
  /** The received payment refunded. */
  paymentId: string
  /** YYYY-MM-DD: the day the money went back. */
  date: string
  /** In the payment's currency; positive. */
  amount: number
  currency: Currency
  /** RON per unit on the refund's date. */
  fxRate: number
  amountRon: number
  notes: string
  demo?: boolean
}

export interface CostRecord {
  id: string
  description: string
  amount: number
  currency: Currency
  fxRate: number
  amountRon: number
  date: string
  status: CostStatus
  group: CostGroup
  category: CostCategory
  /** Optional links, so margins can be read per venue, client and activity. */
  venueId: string | null
  clientId: string | null
  activity: Category | null
  recurring: boolean
  /** Counts as a deductible expense for the tax estimate (PFA sistem real, SRL). */
  deductible: boolean
  notes: string
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
  /** The deal with the venue. */
  deal: DealType
  /** Fee per booking, RON (fixed and hybrid deals). */
  feePerSession: number
  /** Share of a session's income the venue takes, 0–1 (share and hybrid deals). */
  sharePct: number
  /** Rent per month, RON (monthly deals). */
  monthlyFee: number
  demo?: boolean
}

export interface InflowData {
  records: IncomeRecord[]
  /** Optional in stored data written before costs existed; always present after load. */
  costs: CostRecord[]
  clients: Client[]
  sources: Source[]
  venues: Venue[]
  /** Refunds against received payments. Absent in data written before refunds; always present after load. */
  refunds: Refund[]
  /** Device data's shape version, for the migrations in `store/repo.ts`. Absent means 1. */
  schema?: number
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
  /**
   * With costs tracked, read deductible expenses from the recorded costs
   * (annualised like income) instead of `annualExpenses`.
   */
  expensesFromCosts: boolean
}

export type FeatureKey = 'tax' | 'costs' | 'deals' | 'insights' | 'expected' | 'currencies' | 'printable' | 'refunds'

export type Features = Record<FeatureKey, boolean>

export type ThemeChoice = 'system' | 'light' | 'dark'
export type DataMode = 'device' | 'notion'

export type Workspace = 'demo' | 'mine'

export interface Settings {
  theme: ThemeChoice
  mode: DataMode
  notionToken: string
  incomeDbId: string
  tax: TaxProfile
  /** Monthly income target in RON; 0 = none. */
  monthlyTarget: number
  /** An entry this many times the typical (median) amount gets flagged; 0 = don't flag. */
  largeMultiple: number
  /** Device mode only: demo data was seeded once, so an emptied list stays empty. */
  demoSeeded: boolean
  /**
   * What the screens show: the demo practice or your own data (this device or
   * Notion). Never both. null until decided on first load.
   */
  workspace: Workspace | null
  /** Show the welcome tour when the app opens. The tour's own checkbox sets it. */
  showTour: boolean
  /** Optional parts of the app; off hides them from screens and sums alike. A new user starts simple. */
  features: Features
  /** A new user's simple start is announced once on the Overview, until dismissed. */
  simpleStartNotice: boolean
  /** Explanations under form fields. On until someone knows their way around; live figures show either way. */
  showHints: boolean
  /** Cash in hand and in the bank on `openingCashDate`, the cash-flow starting point. */
  openingCash: number
  openingCashDate: string
}
