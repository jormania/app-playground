/**
 * What each bank transaction is, and whether InFlow already has it (Release 2, experimental).
 *
 * Revolut provides transaction data; InFlow provides business context. Nothing here guesses
 * business context from a description: a client is suggested only when the counterparty's name is
 * a client's name (accents and punctuation aside) or a rule you saved says so; a venue only by a
 * rule; deductibility only as a manually entered cost of that kind would get it.
 *
 * Precedence, highest first: your choice on the row > a rule for this exact counterparty > a rule
 * for words in the description (longest first) > the plain reading of the transaction's type.
 */
import type {
  Category, CostCategory, CostGroup, InflowData, IncomeRecord,
} from '../../domain/types'
import { CATEGORIES_BY_GROUP, deductibleByDefault } from '../../domain/vocabulary'
import { fold } from '../clients'
import { refundable } from '../refunds'
import type { BankTx } from './revolut'

export type Direction = 'in' | 'out'
/** What a transaction is. `review` means nobody has said yet. */
export type Kind =
  | 'income' | 'recovery' | 'refundReceived'
  | 'cost' | 'fee' | 'refundIssued'
  | 'transfer' | 'personal' | 'ignore'
  | 'review'

export const KIND_LABEL: Record<Kind, string> = {
  income: 'Income for your work',
  recovery: 'Money back for a cost (reimbursement)',
  refundReceived: 'Refund from a supplier',
  cost: 'Business cost',
  fee: 'Bank fee',
  refundIssued: 'Refund to a client',
  transfer: 'Transfer between your own accounts',
  personal: 'Personal, not business',
  ignore: 'Other: leave out',
  review: 'Needs a decision',
}

export const KINDS_IN: Kind[] = ['income', 'recovery', 'refundReceived', 'transfer', 'ignore', 'review']
export const KINDS_OUT: Kind[] = ['cost', 'fee', 'refundIssued', 'transfer', 'personal', 'ignore', 'review']

/** Kinds that never become a record: they are set aside, and remembered as set aside. */
export const SET_ASIDE: Kind[] = ['transfer', 'personal', 'ignore']

export type Action = 'import' | 'link' | 'receive' | 'skip'

/** The business context chosen for one row. */
export interface Choice {
  kind: Kind
  /** import: a new record; link: an existing record is this transaction; receive: an expected payment arrived; skip. */
  action: Action
  /** link: the record, cost or refund it is; receive: the expected payment. */
  target: string | null
  clientId: string | null
  sourceId: string | null
  venueId: string | null
  category: Category | null
  costGroup: CostGroup
  costCategory: CostCategory
  deductible: boolean
  /** recovery: the cost it pays back, if you say which. */
  repaysCostId: string | null
  /** refundIssued: the payment refunded. */
  paymentId: string | null
  /** A possible duplicate you've said to import all the same. */
  anyway: boolean
  /**
   * You have looked at the entry this row links to, the expected payment it settles or the
   * payment it refunds, and said it is the right one. A suggestion alone never is.
   */
  confirmed: boolean
}

export type Confidence = 'sure' | 'rule' | 'suggested' | 'none'

/** A saved, deterministic mapping rule: only ever made from a choice you confirmed. */
export interface Rule {
  id: string
  /** `counterparty`: the name equals this (folded); `contains`: the description contains it (folded). */
  match: 'counterparty' | 'contains'
  value: string
  direction: Direction
  kind: Kind
  clientId?: string | null
  sourceId?: string | null
  venueId?: string | null
  category?: Category | null
  costGroup?: CostGroup
  costCategory?: CostCategory
  created: string
}

/** What an earlier import decided for a transaction key. */
export interface LedgerEntry {
  batch: string
  /** `pending`: a save was started and its answer never came back; whether it landed is unknown. */
  outcome: 'created' | 'linked' | 'received' | 'skipped' | 'pending'
  kind: Kind
  /** The record, cost or refund created or linked. */
  target?: string
}

export type MatchStatus = 'exact' | 'likely' | 'possible' | 'new'

export const MATCH_LABEL: Record<MatchStatus, string> = {
  exact: 'Already in InFlow',
  likely: 'Probably already in InFlow',
  possible: 'Possible duplicate',
  new: 'New',
}

export interface Candidate { kind: 'record' | 'cost' | 'refund'; id: string; label: string; date: string; amount: number }

export interface Match {
  status: MatchStatus
  reason: string
  /** For exact: what holds it. For likely/possible: the closest existing entries, best first. */
  candidates: Candidate[]
}

export interface Row {
  tx: BankTx
  /** A fee row is made from its parent's Fee column; `parent` is the parent's key. */
  parent: string | null
  match: Match
  suggestion: Choice
  confidence: Confidence
  /** Why the suggestion is what it is, in plain words. */
  reason: string
  /** The rule behind the suggestion, if one applied. */
  rule: Rule | null
  /** Set when the row can never be imported (pending, declined, reverted). */
  locked: string | null
  /** Open expected payments this money might be. */
  expected: Candidate[]
  /** Received payments a refund to this counterparty could be against. */
  refundable: Candidate[]
}

export interface ClassifyContext {
  data: InflowData
  rules: Rule[]
  ledger: Record<string, LedgerEntry>
  /** Your own names and account names: money to or from them is a transfer. */
  ownNames: string[]
}

/** Days either side within which a manually entered payment or cost might be the same money. */
export const NEAR_DAYS = 3
const EPS = 0.005

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000)

/** Plain words for software and travel merchants: a category suggestion, never a decision. */
const COST_WORDS: [CostCategory, string[]][] = [
  ['software', ['zoom', 'google workspace', 'gsuite', 'notion', 'adobe', 'canva', 'dropbox', 'microsoft', 'slack', 'calendly', 'mailchimp', 'openai', 'anthropic', 'apple com bill', 'icloud', 'github', 'figma', 'squarespace', 'wix', 'kajabi', 'teachable']],
  ['travel', ['uber', 'bolt', 'taxi', 'cfr', 'wizz', 'ryanair', 'tarom', 'lufthansa', 'airbnb', 'booking com', 'hotel', 'flixbus', 'omv', 'petrom', 'mol ', 'rompetrol', 'lukoil']],
  ['phone_internet', ['vodafone', 'orange', 'digi', 'telekom', 'rcs rds']],
  ['marketing', ['facebk', 'facebook', 'meta ads', 'google ads', 'linkedin', 'instagram']],
  ['training', ['udemy', 'coursera', 'masterclass']],
  ['accounting', ['contabil', 'accounting', 'smartbill', 'oblio', 'keez']],
  ['materials', ['emag', 'dedeman', 'libraria', 'carturesti', 'office']],
]

export function costWordCategory(tx: Pick<BankTx, 'description' | 'counterparty'>): CostCategory | null {
  const text = ` ${fold(`${tx.counterparty} ${tx.description}`)} `
  for (const [cat, words] of COST_WORDS) if (words.some((w) => text.includes(` ${fold(w)}`))) return cat
  return null
}

/** A name as compared: folded, and with spaces and punctuation gone, so "ACME S.R.L." is "Acme SRL". Still exact, never fuzzy. */
export const nameKey = (s: string): string => fold(s).replace(/ /g, '')

const groupOf = (c: CostCategory): CostGroup =>
  (Object.entries(CATEGORIES_BY_GROUP) as [CostGroup, CostCategory[]][]).find(([, cs]) => cs.includes(c))?.[0] ?? 'operating'

const TRANSFER_WORDS = ['pocket', 'vault', 'savings', 'economii', 'own account', 'cont propriu', 'between accounts', 'exchanged to', 'exchanged from']

/** The rules that apply to a transaction, best first. */
export function rulesFor(tx: Pick<BankTx, 'counterparty' | 'description' | 'direction'>, rules: Rule[]): Rule[] {
  const cp = nameKey(tx.counterparty)
  const desc = fold(tx.description)
  const same = rules.filter((r) => r.direction === tx.direction)
  const exact = same.filter((r) => r.match === 'counterparty' && nameKey(r.value) === cp && cp !== '')
  const contains = same
    .filter((r) => r.match === 'contains' && fold(r.value) !== '' && desc.includes(fold(r.value)))
    .sort((a, b) => fold(b.value).length - fold(a.value).length || a.created.localeCompare(b.created))
  return [...exact, ...contains]
}

export function blankChoice(): Choice {
  return {
    kind: 'review', action: 'import', target: null,
    clientId: null, sourceId: null, venueId: null, category: null,
    costGroup: 'operating', costCategory: 'other_operating', deductible: deductibleByDefault('operating'),
    repaysCostId: null, paymentId: null, anyway: false, confirmed: false,
  }
}

const recordLabel = (r: IncomeRecord, data: InflowData) => {
  const client = data.clients.find((c) => c.id === r.clientId)?.name
  return [r.description, client].filter(Boolean).join(' · ') || 'Payment'
}

type Held = Candidate & { key: string; fp?: string }

/** Every entry an import made or matched, with the identity it carries. */
function heldEntries(data: InflowData): Held[] {
  const out: Held[] = []
  for (const r of data.records) if (r.importMeta?.key) out.push({ kind: 'record', id: r.id, label: recordLabel(r, data), date: r.date, amount: r.amount, key: r.importMeta.key, fp: r.importMeta.fp })
  for (const c of data.costs) if (c.importMeta?.key) out.push({ kind: 'cost', id: c.id, label: c.description, date: c.date, amount: c.amount, key: c.importMeta.key, fp: c.importMeta.fp })
  for (const f of data.refunds) if (f.importMeta?.key) out.push({ kind: 'refund', id: f.id, label: 'Refund', date: f.date, amount: f.amount, key: f.importMeta.key, fp: f.importMeta.fp })
  return out
}

const isBankId = (key: string) => key.startsWith('rv:id:')

/**
 * Where a transaction already lives in the data: by its key (the bank id, or the content
 * fingerprint); else by its content fingerprint, so an export with ids finds rows imported from one
 * without, and the other way round. Two different bank ids are never the same transaction.
 */
function holder(tx: Pick<BankTx, 'key' | 'fp'>, held: Held[]): Candidate | null {
  const byKey = held.find((h) => h.key === tx.key)
  if (byKey) return byKey
  return held.find((h) => h.fp === tx.fp && !(isBankId(tx.key) && isBankId(h.key))) ?? null
}

/** Rows read from bank transactions: a fee row joins each completed transaction that carries one. */
export function expandFees(txs: BankTx[]): { tx: BankTx; parent: string | null }[] {
  const out: { tx: BankTx; parent: string | null }[] = []
  for (const tx of txs) {
    out.push({ tx, parent: null })
    if (tx.fee !== null && tx.fee > 0 && tx.state === 'COMPLETED') {
      out.push({
        parent: tx.key,
        tx: {
          ...tx, key: `${tx.key}:fee`, fp: `${tx.fp}:fee`, direction: 'out', amount: tx.fee, fee: 0, type: 'FEE',
          description: `Bank fee: ${tx.description}`, counterparty: 'Revolut', balance: null,
        },
      })
    }
  }
  return out
}

const STATE_WORD: Record<string, string> = {
  UNKNOWN: 'the file gives no state for it, so whether the money moved is unknown',
  PENDING: 'still pending at the bank',
  DECLINED: 'declined',
  REVERTED: 'reversed by the bank',
  REVERSED: 'reversed by the bank',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
}

/** Reads one transaction against everything InFlow holds. Pure. */
export function classify(rows: { tx: BankTx; parent: string | null }[], ctx: ClassifyContext): Row[] {
  const { data } = ctx
  const own = ctx.ownNames.map(nameKey).filter(Boolean)
  // Clients by name; two whose names fold the same are never told apart for you.
  const clientsByName = new Map<string, typeof data.clients>()
  for (const c of data.clients) { const k = nameKey(c.name); if (k) clientsByName.set(k, [...(clientsByName.get(k) ?? []), c]) }
  const held = heldEntries(data)
  const exists = {
    client: new Set(data.clients.map((x) => x.id)), source: new Set(data.sources.map((x) => x.id)), venue: new Set(data.venues.map((x) => x.id)),
  }
  const received = data.records.filter((r) => r.status === 'received')
  const expectedOpen = data.records.filter((r) => r.status === 'expected')

  return rows.map(({ tx, parent }, i): Row => {
    const base = blankChoice()
    const cp = nameKey(tx.counterparty)
    const named = cp ? clientsByName.get(cp) ?? [] : []
    const client = named.length === 1 ? named[0] : null
    const sameName = named.length > 1 ? ` ${named.length} clients are called "${tx.counterparty}", so none is picked: choose.` : ''

    // Never imported: the money didn't (or didn't stay) move.
    const locked = tx.state !== 'COMPLETED'
      ? `Not imported: ${STATE_WORD[tx.state] ?? `state "${tx.state}"`}. Only completed transactions become records.`
      : null

    // Already here? The fingerprint first; then what an earlier import decided.
    let match: Match = { status: 'new', reason: 'Not seen before.', candidates: [] }
    const found = holder(tx, held)
    const past = ctx.ledger[tx.key] ?? ctx.ledger[tx.fp]
    if (found) match = { status: 'exact', reason: 'Imported before: this transaction is already in InFlow.', candidates: [{ kind: found.kind, id: found.id, label: found.label, date: found.date, amount: found.amount }] }
    else if (past?.outcome === 'pending') {
      // A save of this row started in an earlier import and never answered: it may be in Notion already.
      match = { status: 'possible', reason: 'An earlier import was saving this transaction when it stopped, so it may already be in InFlow. Look for it before importing it again.', candidates: [] }
    } else if (past && past.outcome !== 'skipped') {
      // The ledger says it was imported, but the record has since gone: deleted by you.
      match = { status: 'exact', reason: 'Imported before and since deleted in InFlow; it stays out unless you import it anyway.', candidates: [] }
    }

    // Manually entered money that might be this transaction: same currency and amount, close in time.
    if (match.status === 'new' && !locked) {
      // Entries typed by hand, and entries imported before content fingerprints existed (their old keys
      // can't be recognised): either might be this transaction.
      const near = <T extends { date: string; amount: number; currency: string; importMeta?: { fp?: string } | null }>(xs: T[]) =>
        xs.filter((x) => (!x.importMeta || !x.importMeta.fp) && x.currency === tx.currency && Math.abs(x.amount - tx.amount) < EPS && Math.abs(dayDiff(x.date, tx.date)) <= NEAR_DAYS)
          .sort((a, b) => Math.abs(dayDiff(a.date, tx.date)) - Math.abs(dayDiff(b.date, tx.date)))
      let cands: Candidate[] = []
      let sameDayName = false
      if (tx.direction === 'in') {
        const rs = near(received)
        cands = rs.map((r) => ({ kind: 'record' as const, id: r.id, label: recordLabel(r, data), date: r.date, amount: r.amount }))
        sameDayName = rs.some((r) => r.date === tx.date && !!client && r.clientId === client.id)
      } else {
        const cs = near(data.costs)
        const fs = near(data.refunds)
        cands = [
          ...cs.map((c) => ({ kind: 'cost' as const, id: c.id, label: c.description, date: c.date, amount: c.amount })),
          ...fs.map((f) => ({ kind: 'refund' as const, id: f.id, label: 'Refund', date: f.date, amount: f.amount })),
        ]
        sameDayName = cs.some((c) => c.date === tx.date && cp !== '' && nameKey(c.description).includes(cp))
      }
      if (cands.length) {
        match = sameDayName && cands.length === 1
          ? { status: 'likely', reason: `Same amount, day and name as an entry you added by hand.`, candidates: cands }
          : { status: 'possible', reason: `Same amount within ${NEAR_DAYS} days of ${cands.length === 1 ? 'an entry' : `${cands.length} entries`} you added by hand.`, candidates: cands }
      }
      // Identical rows with nothing (no id, no balance) to tell them apart: each needs a decision.
      if (match.status === 'new' && tx.twins > 1) {
        match = { status: 'possible', reason: `${tx.twins} rows in this file are identical and have no transaction ID or balance, so InFlow can't tell them apart from each other or from a later export. Import each one only if it really happened.`, candidates: [] }
      }
      // The same money twice in this file (different second or balance): worth a look.
      if (match.status === 'new' && !parent) {
        const twin = rows.slice(0, i).find((o) => !o.parent && o.tx.date === tx.date && o.tx.direction === tx.direction && o.tx.currency === tx.currency && Math.abs(o.tx.amount - tx.amount) < EPS && nameKey(o.tx.counterparty) === cp && o.tx.state === 'COMPLETED')
        if (twin) match = { status: 'possible', reason: `Looks the same as line ${twin.tx.line} of this file. Both may be real (two identical payments); check before importing both.`, candidates: [] }
      }
    }

    // Open expected payments this might settle: the same client, or the same amount.
    const expected: Candidate[] = tx.direction === 'in' && !parent
      ? expectedOpen
        .filter((r) => r.currency === tx.currency && tx.amount <= r.amount + EPS && ((client && r.clientId === client.id) || Math.abs(r.amount - tx.amount) < EPS))
        .sort((a, b) => Math.abs(dayDiff(a.date, tx.date)) - Math.abs(dayDiff(b.date, tx.date)))
        .map((r) => ({ kind: 'record' as const, id: r.id, label: recordLabel(r, data), date: r.date, amount: r.amount }))
      : []
    // Payments a refund to this counterparty could be against: theirs, same currency, enough left.
    const refundCands: Candidate[] = tx.direction === 'out' && client
      ? received
        .filter((r) => r.clientId === client.id && r.currency === tx.currency && refundable(r, data.refunds) + EPS >= tx.amount && r.date <= tx.date)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((r) => ({ kind: 'record' as const, id: r.id, label: recordLabel(r, data), date: r.date, amount: r.amount }))
      : []

    const out = (choice: Choice, confidence: Confidence, reason: string, rule: Rule | null = null): Row =>
      ({ tx, parent, match, suggestion: choice, confidence, reason, rule, locked, expected, refundable: refundCands })

    if (locked) return out({ ...base, kind: 'ignore', action: 'skip' }, 'sure', locked)
    if (match.status === 'exact') return out({ ...base, kind: past?.kind ?? 'ignore', action: 'skip', target: match.candidates[0]?.id ?? null }, 'sure', match.reason)
    if (match.status === 'likely') {
      const c = match.candidates[0]
      return out({ ...base, kind: tx.direction === 'in' ? 'income' : c.kind === 'refund' ? 'refundIssued' : 'cost', action: 'link', target: c.id }, 'suggested', 'Linking keeps your entry as it is and marks it as this transaction.')
    }
    // An earlier import set this aside: the same decision again.
    if (past?.outcome === 'skipped') return out({ ...base, kind: past.kind, action: 'skip' }, 'rule', `Set aside in an earlier import as "${KIND_LABEL[past.kind].toLowerCase()}".`)

    // A fee row from the Fee column: always the bank's fee.
    if (parent) {
      return out({ ...base, kind: 'fee', costGroup: 'operating', costCategory: 'bank_fees', deductible: deductibleByDefault('operating') }, 'sure', 'The fee the bank charged on this transaction, from its Fee column: a cost of its own, never part of the payment.')
    }

    // A saved rule: the best one, unless rules of the same standing disagree.
    const ranked = rulesFor(tx, ctx.rules)
    const top = ranked[0]
    const tied = top ? ranked.filter((r) => r.match === top.match && (r.match === 'counterparty' || fold(r.value).length === fold(top.value).length)) : []
    const say = (r: Rule) => JSON.stringify([r.kind, r.clientId ?? null, r.sourceId ?? null, r.venueId ?? null, r.category ?? null, r.costGroup ?? null, r.costCategory ?? null])
    const disagree = tied.length > 1 && new Set(tied.map(say)).size > 1
    const rule = top && !disagree ? top : null
    if (disagree) {
      return out({ ...base }, 'none', `Your rules disagree about "${tx.counterparty}" (${tied.map((r) => KIND_LABEL[r.kind].toLowerCase()).join(' / ')}), so none is applied: decide here, and tidy the rules in Settings.`)
    }
    if (rule) {
      const group = rule.costGroup ?? (rule.costCategory ? groupOf(rule.costCategory) : base.costGroup)
      const choice: Choice = {
        ...base,
        kind: rule.kind,
        action: SET_ASIDE.includes(rule.kind) ? 'skip' : 'import',
        // A client, source or venue the rule names but that no longer exists is not used.
        clientId: rule.clientId && exists.client.has(rule.clientId) ? rule.clientId : rule.clientId ? null : (client?.id ?? null),
        sourceId: rule.sourceId && exists.source.has(rule.sourceId) ? rule.sourceId : null,
        venueId: rule.venueId && exists.venue.has(rule.venueId) ? rule.venueId : null,
        category: rule.category ?? (rule.kind === 'recovery' ? 'reimbursement' : null),
        costGroup: group,
        costCategory: rule.costCategory ?? base.costCategory,
        deductible: deductibleByDefault(group),
      }
      if (rule.kind === 'refundIssued') choice.paymentId = refundCands[0]?.id ?? null
      const how = rule.match === 'counterparty' ? `"${rule.value}"` : `descriptions containing "${rule.value}"`
      const gone = [rule.clientId && !exists.client.has(rule.clientId) ? 'client' : '', rule.sourceId && !exists.source.has(rule.sourceId) ? 'source' : '', rule.venueId && !exists.venue.has(rule.venueId) ? 'venue' : ''].filter(Boolean)
      return out(choice, 'rule', `Your rule for ${how}.${gone.length ? ` The ${gone.join(' and ')} it names no longer exist${gone.length === 1 ? 's' : ''}: choose again.` : ''}`, rule)
    }

    const text = fold(`${tx.counterparty} ${tx.description}`)
    // Exchanges, pockets and your own names: your money moving, not income or cost.
    if (tx.type === 'EXCHANGE') return out({ ...base, kind: 'transfer', action: 'skip' }, 'sure', 'A currency exchange inside your account: not income or a cost.')
    if (own.some((n) => cp === n)) return out({ ...base, kind: 'transfer', action: 'skip' }, 'suggested', 'To or from a name you listed as yours: a transfer between your accounts.')
    if (TRANSFER_WORDS.some((w) => text.includes(fold(w)))) return out({ ...base, kind: 'transfer', action: 'skip' }, 'suggested', 'Reads like a move between your own pockets or accounts.')
    if (tx.type === 'ATM') return out({ ...base, kind: 'transfer', action: 'skip' }, 'suggested', 'A cash withdrawal: money moving, not a cost until you spend it.')

    if (tx.direction === 'in') {
      if (tx.type === 'TOPUP') return out({ ...base, kind: 'transfer', action: 'skip' }, 'suggested', 'A top-up: usually money you added yourself.')
      if (tx.type === 'CARD_REFUND' || tx.type === 'REFUND') return out({ ...base, kind: 'refundReceived', action: 'skip' }, 'suggested', 'A card refund from a merchant. InFlow has no place yet for money a supplier pays back, so it is left out; adjust the cost by hand if needed.')
      if (expected.length && client) {
        const e = data.records.find((r) => r.id === expected[0].id)!
        return out({ ...base, kind: 'income', action: 'receive', target: e.id, clientId: client.id, sourceId: e.sourceId, venueId: e.venueId, category: e.category }, 'suggested', `${client.name} had a payment expected: marked received with this money.`)
      }
      if (client) {
        // The client's last received payment gives source and activity, as the payment form does. Never the venue.
        const last = [...received].filter((r) => r.clientId === client.id).sort((a, b) => b.date.localeCompare(a.date))[0]
        return out({ ...base, kind: 'income', clientId: client.id, sourceId: last?.sourceId ?? null, category: last?.category ?? null }, 'suggested', `From ${client.name}, a client of yours.`)
      }
      // Money from a name that is no client: income, money back or your own money? Yours to say.
      return out({ ...base }, 'none', `Money in from "${tx.counterparty || 'an unnamed sender'}", who isn't a client of yours: income, money back for a cost, or a transfer? You decide.${sameName}`)
    }

    // Money out.
    if (tx.type === 'FEE' || tx.type === 'CHARGE') {
      return out({ ...base, kind: 'fee', costGroup: 'operating', costCategory: 'bank_fees', deductible: deductibleByDefault('operating') }, 'suggested', 'A charge from the bank (a plan or service fee).')
    }
    if (client && refundCands.length) {
      return out({ ...base, kind: 'refundIssued', clientId: client.id, paymentId: refundCands[0].id }, 'suggested', `To ${client.name}, a client: perhaps a refund. Check the payment it's against.`)
    }
    const cat = costWordCategory(tx)
    if (cat) {
      const g = groupOf(cat)
      return out({ ...base, kind: 'review', costGroup: g, costCategory: cat, deductible: deductibleByDefault(g) }, 'none', `Money out. If it was for the business, it looks like ${cat.replace('_', ' ')}; you decide.`)
    }
    return out(base, 'none', 'Money out: business or personal is yours to say.')
  })
}

/** The choice in force for a row: yours where you made one, else the suggestion. */
export function effective(row: Row, override: Partial<Choice> | undefined): Choice {
  if (!override) return row.suggestion
  const merged = { ...row.suggestion, ...override }
  // A kind that is set aside is skipped; picking an importable kind after a skip imports it.
  if (override.kind && SET_ASIDE.includes(override.kind) && override.action === undefined) merged.action = 'skip'
  if (override.kind && !SET_ASIDE.includes(override.kind) && override.kind !== 'review' && override.action === undefined && row.suggestion.action === 'skip') merged.action = 'import'
  if (override.costGroup && !override.costCategory && !CATEGORIES_BY_GROUP[override.costGroup].includes(merged.costCategory)) merged.costCategory = CATEGORIES_BY_GROUP[override.costGroup][0]
  if (override.costGroup && override.deductible === undefined) merged.deductible = deductibleByDefault(override.costGroup)
  return merged
}

export type RowFilter = 'all' | 'in' | 'out' | 'duplicates' | 'unclassified' | 'transfers' | 'refunds'

export function rowMatches(row: Row, choice: Choice, f: RowFilter): boolean {
  switch (f) {
    case 'all': return true
    case 'in': return row.tx.direction === 'in'
    case 'out': return row.tx.direction === 'out'
    case 'duplicates': return row.match.status !== 'new'
    case 'unclassified': return !row.locked && row.match.status !== 'exact' && choice.kind === 'review'
    case 'transfers': return choice.kind === 'transfer'
    case 'refunds': return choice.kind === 'refundIssued' || choice.kind === 'refundReceived'
  }
}

/**
 * Whether a rule may be saved from this row: only from a completed, new transaction, with a
 * counterparty, a decided kind, and no doubt about duplicates.
 */
export function canRemember(row: Row, choice: Choice): boolean {
  return !row.locked && !row.parent && row.match.status === 'new' && nameKey(row.tx.counterparty) !== ''
    && choice.kind !== 'review' && choice.kind !== 'refundIssued' && choice.action !== 'link' && choice.action !== 'receive'
}

export function ruleFrom(row: Row, choice: Choice, id: string, created: string): Rule {
  const r: Rule = { id, match: 'counterparty', value: row.tx.counterparty.trim(), direction: row.tx.direction, kind: choice.kind, created }
  if (choice.kind === 'income' || choice.kind === 'recovery') Object.assign(r, { clientId: choice.clientId, sourceId: choice.sourceId, venueId: choice.venueId, category: choice.category })
  if (choice.kind === 'cost' || choice.kind === 'fee') Object.assign(r, { costGroup: choice.costGroup, costCategory: choice.costCategory, venueId: choice.venueId, clientId: choice.clientId })
  return r
}
