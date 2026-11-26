/**
 * Bank statements (Revolut first), read into plain bank transactions (Release 2, experimental).
 *
 * What is known, and how well (INFLOW.md, "Statement formats", has the sources):
 *  - Revolut documents **no** CSV layout for Revolut Pro.
 *  - Revolut's help centre says Business statements use UTC times by default, that CSV statements
 *    can carry both local and UTC times, and lists for the Business *expenses* CSV: started and
 *    completed times (UTC and local), transaction ID, status, type, description, original currency
 *    and amount, payment currency, amount and fee.
 *  - Open-source importers written against real *personal* exports agree on: Type, Product,
 *    Started Date, Completed Date, Description, Amount, Fee, Currency, State, Balance (ISO dates
 *    with time, dot decimals, money out negative, the fee separate and on top).
 * Everything else (Romanian names, money in / money out, day-first dates…) is an assumption from
 * common bank CSVs, accepted only where the file itself leaves no doubt.
 *
 * The rule throughout: never guess. A column is used only when its name is known and no other
 * column claims the same meaning; otherwise the result asks for manual mapping. A value that
 * could mean two things ("1.250", "03/04/2026" in a file with no day after the 12th) is not read
 * as either. A row that can't be read is reported with its line and why; none is dropped silently,
 * and nothing missing is read as zero.
 */
import type { Currency } from '../../domain/types'
import { CURRENCIES } from '../../domain/vocabulary'
import { round2 } from '../money'
import type { CsvTable } from './csv'

export type Field =
  | 'type' | 'product' | 'started' | 'completed' | 'description' | 'counterparty' | 'amount' | 'moneyIn' | 'moneyOut'
  | 'fee' | 'feeCurrency' | 'currency' | 'state' | 'balance' | 'id' | 'reference' | 'rate' | 'origAmount' | 'origCurrency'

/**
 * Header names each field is known by, compared without case, accents, spaces or punctuation, and
 * without a trailing time zone in brackets ("Date started (UTC)" is "date started").
 */
export const ALIASES: Record<Field, string[]> = {
  type: ['type', 'transaction type', 'tip', 'tip tranzactie'],
  product: ['product', 'produs'],
  started: ['started date', 'date started', 'start date', 'transaction started', 'started', 'date', 'transaction date', 'created', 'data inceput', 'data', 'data tranzactiei'],
  completed: ['completed date', 'date completed', 'transaction completed', 'completed', 'booking date', 'data finalizare', 'data decontarii'],
  description: ['description', 'details', 'narrative', 'descriere', 'detalii'],
  counterparty: ['counterparty', 'merchant', 'payee', 'payer', 'beneficiary', 'name', 'nume', 'beneficiar', 'platitor'],
  amount: ['amount', 'amount in payment currency', 'payment amount', 'suma'],
  moneyIn: ['money in', 'paid in', 'credit', 'incoming', 'intrari', 'incasari'],
  moneyOut: ['money out', 'paid out', 'debit', 'outgoing', 'iesiri', 'plati'],
  fee: ['fee', 'fees', 'comision'],
  feeCurrency: ['fee currency', 'moneda comision'],
  currency: ['currency', 'payment currency', 'moneda', 'valuta'],
  state: ['state', 'status', 'stare'],
  balance: ['balance', 'sold'],
  id: ['id', 'transaction id', 'id tranzactie'],
  reference: ['reference', 'payment reference', 'referinta'],
  rate: ['exchange rate', 'fx rate', 'rate', 'curs', 'curs de schimb'],
  origAmount: ['orig amount', 'original amount', 'suma originala'],
  origCurrency: ['orig currency', 'original currency', 'moneda originala'],
}

/**
 * Names known and deliberately not used. "Total amount" may include the fee, so it is never taken
 * for the amount: a file with only that needs mapping by hand.
 */
export const KNOWN_UNUSED = ['total amount', 'card number', 'card label', 'card state', 'mcc', 'account', 'beneficiary account number',
  'beneficiary sort code or routing number', 'beneficiary iban', 'beneficiary bic', 'related transaction id', 'spend program', 'category', 'notes', 'tags']

/** Field names as a person reads them, for a manual mapping and for messages. */
export const FIELD_LABEL: Record<Field, string> = {
  started: 'Date', completed: 'Completed date', amount: 'Amount (signed: money out negative)', moneyIn: 'Money in', moneyOut: 'Money out',
  currency: 'Currency', description: 'Description', counterparty: 'Other party', fee: 'Fee', feeCurrency: 'Fee currency', state: 'State',
  type: 'Type', reference: 'Reference', balance: 'Balance', id: 'Transaction ID', product: 'Product', rate: 'Exchange rate',
  origAmount: 'Original amount', origCurrency: 'Original currency',
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** "Date started (UTC)" → { base: "date started", utc: true }. */
function headerName(h: string): { base: string; utc: boolean } {
  const m = h.match(/^(.*?)\s*\(([^)]*)\)\s*$/)
  return m ? { base: norm(m[1]), utc: norm(m[2]) === 'utc' } : { base: norm(h), utc: false }
}

export type Columns = Partial<Record<Field, number>>

export interface ColumnMap {
  columns: Columns
  /** Columns that may each hold the other party (a Payer and a Beneficiary column); the first filled one is used. */
  counterparties: number[]
  /** Headers no field claimed: shown, never used. */
  unknown: string[]
  /** Headers recognised and deliberately not used ("Total amount", "Card number"…). */
  unused: string[]
  /** What the file lacks to be read at all. */
  missing: string[]
  /** Two columns that claim one meaning; the file can't be read until you say which. */
  conflicts: string[]
}

export const REQUIRED_NOTE = {
  date: 'a date (e.g. "Started Date", "Completed Date" or "Date")',
  amount: 'an amount (e.g. "Amount", or "Money in" and "Money out")',
  currency: 'a currency (a "Currency" column, or choose the file\'s currency)',
}

function check(columns: Columns, header: string[], opts: { fileCurrency?: Currency }): { missing: string[]; conflicts: string[] } {
  const missing: string[] = []
  const conflicts: string[] = []
  if (columns.started === undefined && columns.completed === undefined) missing.push(REQUIRED_NOTE.date)
  const hasSigned = columns.amount !== undefined
  const hasInOut = columns.moneyIn !== undefined || columns.moneyOut !== undefined
  if (!hasSigned && !hasInOut) missing.push(REQUIRED_NOTE.amount)
  if (hasSigned && hasInOut) conflicts.push(`Both a signed amount ("${header[columns.amount!]}") and money in / money out columns: use one or the other.`)
  if (columns.currency === undefined && !opts.fileCurrency) missing.push(REQUIRED_NOTE.currency)
  // One column can't mean two things.
  const used = new Map<number, Field>()
  for (const [f, i] of Object.entries(columns) as [Field, number][]) {
    if (i === undefined) continue
    if (used.has(i)) conflicts.push(`"${header[i]}" is mapped as both ${FIELD_LABEL[used.get(i)!].toLowerCase()} and ${FIELD_LABEL[f].toLowerCase()}.`)
    else used.set(i, f)
  }
  return { missing, conflicts }
}

/**
 * Finds each field's column by name. Two columns with one meaning are a conflict (asked, never
 * picked), except a UTC and a local time of the same date (the local one is used: it is the day
 * the money moved where you are) and several columns for the other party.
 */
export function mapHeader(header: string[], opts: { fileCurrency?: Currency } = {}): ColumnMap {
  const named = header.map(headerName)
  const found: Partial<Record<Field, { i: number; utc: boolean }[]>> = {}
  const claimed = new Set<number>()
  named.forEach(({ base, utc }, i) => {
    if (!base) return
    const f = (Object.keys(ALIASES) as Field[]).find((k) => ALIASES[k].includes(base))
    if (!f) return
    ;(found[f] ??= []).push({ i, utc })
    claimed.add(i)
  })
  const columns: Columns = {}
  const conflicts: string[] = []
  let counterparties: number[] = []
  for (const [f, hits] of Object.entries(found) as [Field, { i: number; utc: boolean }[]][]) {
    if (f === 'counterparty') { counterparties = hits.map((h) => h.i); columns.counterparty = hits[0].i; continue }
    if (hits.length === 1) { columns[f] = hits[0].i; continue }
    const local = hits.filter((h) => !h.utc)
    if ((f === 'started' || f === 'completed') && local.length === 1 && hits.length === 2) { columns[f] = local[0].i; continue }
    conflicts.push(`${hits.map((h) => `"${header[h.i]}"`).join(' and ')} could each be the ${FIELD_LABEL[f].toLowerCase()}.`)
  }
  const c = check(columns, header, opts)
  const unusedSet = new Set(KNOWN_UNUSED)
  return {
    columns,
    counterparties,
    unknown: header.filter((h, i) => !claimed.has(i) && h.trim() !== '' && !unusedSet.has(named[i].base)),
    unused: header.filter((_, i) => !claimed.has(i) && unusedSet.has(named[i].base)),
    missing: c.missing,
    conflicts: [...conflicts, ...c.conflicts],
  }
}

/** A mapping made by hand (the UI's column pickers): checked the same way, nothing inferred. */
export function manualMap(header: string[], columns: Columns, opts: { fileCurrency?: Currency } = {}): ColumnMap {
  const clean: Columns = {}
  for (const [f, i] of Object.entries(columns) as [Field, number | undefined][]) if (i !== undefined && i >= 0 && i < header.length) clean[f] = i
  const c = check(clean, header, opts)
  const used = new Set(Object.values(clean))
  return {
    columns: clean,
    counterparties: clean.counterparty === undefined ? [] : [clean.counterparty],
    unknown: header.filter((h, i) => !used.has(i) && h.trim() !== ''),
    unused: [],
    missing: c.missing,
    conflicts: c.conflicts,
  }
}

// ── numbers ─────────────────────────────────────────────────────────────────

export type Decimal = '.' | ','

export type Money = { ok: true; value: number } | { ok: false; error: string }

/** Strips what surrounds a number: spaces, currency symbols or codes, a sign written either side, brackets. */
function bare(raw: string): { s: string; negative: boolean } | null {
  let s = raw.trim().replace(/[\s\u00A0\u202F']/g, '')
  if (!s) return null
  let negative = false
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1) }
  if (/-$/.test(s)) { negative = !negative; s = s.slice(0, -1) }
  s = s.replace(/^[^\d.,+-]+|[^\d.,]+$/g, '')
  if (s.startsWith('-')) { negative = !negative; s = s.slice(1) } else if (s.startsWith('+')) s = s.slice(1)
  return { s, negative }
}

const grouped = (s: string, t: string) => (s.includes(t) ? new RegExp(`^\\d{1,3}(\\${t}\\d{3})+$`).test(s) : /^\d+$/.test(s))

/** What a value says by itself about the decimal mark, if anything. */
export function decimalEvidence(raw: string): Decimal | null {
  const b = bare(raw)
  if (!b || !/^[\d.,]+$/.test(b.s)) return null
  const { s } = b
  const dot = s.lastIndexOf('.')
  const comma = s.lastIndexOf(',')
  if (dot !== -1 && comma !== -1) return dot > comma ? '.' : ','
  const sep = dot !== -1 ? '.' : comma !== -1 ? ',' : null
  if (!sep) return null
  const parts = s.split(sep)
  if (parts.length === 2 && parts[1].length >= 1 && parts[1].length <= 2) return sep
  // "1.234.567" says the other mark is the decimal, but only if it is well grouped ("12.5.0" says nothing).
  if (parts.length > 2 && grouped(s, sep)) return sep === '.' ? ',' : '.'
  return null
}

/** The file's decimal mark from every money value in it: null when nothing says, or values disagree. */
export function detectDecimal(values: string[]): { decimal: Decimal | null; mixed: boolean } {
  const seen = new Set<Decimal>()
  for (const v of values) { const e = decimalEvidence(v); if (e) seen.add(e) }
  return seen.size === 1 ? { decimal: [...seen][0], mixed: false } : { decimal: null, mixed: seen.size > 1 }
}

/**
 * A money value as banks write it: "1234.5", "-1,234.50", "1.234,50", "1'234.50", "(12.50)",
 * "12.50-", "€ 20". `decimal` is the file's mark when known. "1.250" with no way to tell whether
 * it is 1.25 or 1,250 is refused, as is a value with more decimals than money has (`maxDecimals`).
 */
export function readMoney(raw: string, decimal: Decimal | null = null, maxDecimals = 2): Money {
  const b = bare(raw)
  if (!b) return { ok: false, error: 'empty' }
  const { s, negative } = b
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return { ok: false, error: `"${raw.trim()}" is not a number` }
  const dot = s.lastIndexOf('.')
  const comma = s.lastIndexOf(',')
  const both = dot !== -1 && comma !== -1
  let d: Decimal | null
  if (both) d = dot > comma ? '.' : ','
  else {
    const sep: Decimal | null = dot !== -1 ? '.' : comma !== -1 ? ',' : null
    if (!sep) d = null
    else {
      const parts = s.split(sep)
      if (parts.length > 2) {
        // "1.234.567": thousands, if grouped in threes.
        if (!grouped(s, sep)) return { ok: false, error: `"${raw.trim()}" is not a well-formed number` }
        d = sep === '.' ? ',' : '.'
      } else if (parts[1].length === 3 && maxDecimals === 2) {
        if (!decimal) return { ok: false, error: `"${raw.trim()}" could be ${parts[0]}.${parts[1]} or ${parts[0]}${parts[1]}: the file doesn't say which mark is the decimal` }
        d = decimal
      } else d = sep
    }
  }
  if (d && decimal && d !== decimal && !both) {
    // A lone separator that contradicts the file: only acceptable as thousands grouping.
    if (!grouped(s, d)) return { ok: false, error: `"${raw.trim()}" doesn't fit this file's decimal mark "${decimal}"` }
    d = decimal
  }
  let int = s
  let frac = ''
  if (d && s.includes(d)) {
    const at = s.lastIndexOf(d)
    if (s.indexOf(d) !== at) return { ok: false, error: `"${raw.trim()}" has two decimal marks` }
    int = s.slice(0, at)
    frac = s.slice(at + 1)
  }
  const t = d === ',' ? '.' : ','
  if (!grouped(int || '0', t)) return { ok: false, error: `"${raw.trim()}" is not a well-formed number` }
  if (frac && !/^\d+$/.test(frac)) return { ok: false, error: `"${raw.trim()}" is not a well-formed number` }
  if (frac.length > maxDecimals) return { ok: false, error: `"${raw.trim()}" has more decimals than an amount of money` }
  const n = Number(`${(int || '0').split(t).join('')}${frac ? `.${frac}` : ''}`)
  if (!Number.isFinite(n)) return { ok: false, error: `"${raw.trim()}" is not a number` }
  return { ok: true, value: negative ? -n : n }
}

/** `readMoney` as a number: NaN when it can't be read for certain. */
export function parseAmount(raw: string, decimal: Decimal | null = null): number {
  const m = readMoney(raw, decimal)
  return m.ok ? m.value : NaN
}

// ── dates ───────────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  ian: 1, mai: 5, iun: 6, iul: 7, noi: 11 }

export type DateOrder = 'dmy' | 'mdy'

/**
 * A date and time as banks write them: "2026-03-01 14:05:22" (Revolut), "2026-03-01T14:05:00Z"
 * (the date as written; no time zone is applied), "2026/03/01", "01.03.2026" (day first: the
 * dotted form is European), "01/03/2026" (by `order`; null when the order isn't known and the
 * date reads both ways), "1 Mar 2026", "1 mar. 2026". Null otherwise.
 */
export function parseDateTime(raw: string, order: DateOrder | null = 'dmy'): { date: string; time: string } | null {
  const s = raw.trim()
  const pad = (n: number) => String(n).padStart(2, '0')
  const days = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
  const ok = (y: number, m: number, d: number) => y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= days(y, m)
  const t = (rest: string | undefined) => {
    const m = rest?.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
    return m ? `${pad(Number(m[1]))}:${m[2]}:${m[3] ?? '00'}` : '00:00:00'
  }
  const out = (y: number, m: number, d: number, rest?: string) => (ok(y, m, d) ? { date: `${y}-${pad(m)}-${pad(d)}`, time: t(rest) } : null)
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](.*))?$/)
  if (m) return out(+m[1], +m[2], +m[3], m[4])
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[\s,]+(.*))?$/)
  if (m) return out(+m[3], +m[2], +m[1], m[4])
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[\s,]+(.*))?$/)
  if (m) {
    const a = +m[1], b = +m[2]
    if (a === b) return out(+m[3], a, b, m[4])
    const o: DateOrder | null = a > 12 ? 'dmy' : b > 12 ? 'mdy' : order
    if (!o) return null
    return o === 'dmy' ? out(+m[3], b, a, m[4]) : out(+m[3], a, b, m[4])
  }
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})(?:[\s,]+(.*))?$/)
  if (m && MONTHS[m[2].toLowerCase()]) return out(+m[3], MONTHS[m[2].toLowerCase()], +m[1], m[4])
  return null
}

/** The order of slash dates in a file: what any date with a part above 12 says; null if none says; 'mixed' if they disagree. */
export function detectDateOrder(values: string[]): DateOrder | null | 'mixed' {
  const seen = new Set<DateOrder>()
  for (const v of values) {
    const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/\d{4}/)
    if (!m) continue
    if (+m[1] > 12) seen.add('dmy')
    else if (+m[2] > 12) seen.add('mdy')
  }
  return seen.size > 1 ? 'mixed' : seen.size === 1 ? [...seen][0] : null
}

// ── currencies ──────────────────────────────────────────────────────────────

const SYMBOLS: Record<string, Currency> = { '€': 'EUR', '£': 'GBP', LEI: 'RON', 'ZŁ': 'PLN', 'KČ': 'CZK', FT: 'HUF' }

/** A currency cell as InFlow's code, or null. "$" is refused: it is several currencies. */
export function readCurrency(raw: string): Currency | null {
  const s = raw.trim().toUpperCase()
  if ((CURRENCIES as string[]).includes(s)) return s as Currency
  return SYMBOLS[s] ?? null
}

// ── transactions ────────────────────────────────────────────────────────────

/** A bank transaction, as read: nothing from InFlow yet. */
export interface BankTx {
  /** A fingerprint that finds this same transaction in any later export (see `fingerprint`). */
  key: string
  line: number
  /** When it was booked: the completed date if there is one, else the started date. YYYY-MM-DD. */
  date: string
  /** The started timestamp, for display and the fingerprint. */
  startedAt: string
  direction: 'in' | 'out'
  /** Positive, in `currency`. The fee is not in it. */
  amount: number
  /** Positive; charged on top of `amount`. 0 when the file says 0; null when it says nothing. */
  fee: number | null
  currency: Currency
  /** Normalised: "Card Payment" → CARD_PAYMENT, "Topup" → TOPUP. Empty when the file has no type. */
  type: string
  /** Normalised: COMPLETED, PENDING, REVERTED, DECLINED… "COMPLETED" when the file has no state column. */
  state: string
  /** As in the file (outer spaces trimmed). */
  description: string
  /** The other party: a counterparty column, else read from "Payment from X" / "To X", else the description. */
  counterparty: string
  /** As in the file; empty when there is none. */
  reference: string
  balance: number | null
  product: string
  /** The bank's own transaction id, when the file has one. */
  bankId: string
  /** An exchange rate in the file, kept only for the record; InFlow uses the day's rate. */
  fileRate: number | null
  /** The amount before conversion, when the file gives one (Revolut Business "Orig amount"). For the record only. */
  original: { amount: number; currency: Currency } | null
}

export interface ParseIssue { line: number; message: string }

export interface Statement {
  txs: BankTx[]
  /** Rows not read, each with why. With `txs`, every data row is accounted for. */
  issues: ParseIssue[]
  /** Rows read with something left out (a fee in another currency…), and remarks about the file. Line 0 is the file. */
  notes: ParseIssue[]
  map: ColumnMap
  /** The file's decimal mark, as detected or given. */
  decimal: Decimal | null
  dateOrder: DateOrder | null
  /**
   * What must be settled by hand before anything is read. While any is true, `txs` is empty:
   * nothing is read on a guess.
   */
  needs: { mapping: boolean; currency: boolean; dateOrder: boolean }
  summary: { rows: number; read: number; from: string | null; to: string | null; currencies: Currency[]; incoming: number; outgoing: number }
}

const upperSnake = (s: string) => {
  const u = s.trim().toUpperCase().replace(/[\s-]+/g, '_')
  return u === 'TOP_UP' ? 'TOPUP' : u
}

/** The other party, from Revolut's usual wording; the description itself otherwise (a card payment's merchant). */
export function counterpartyOf(description: string): string {
  const d = description.trim()
  const m = d.match(/^(?:payment from|transfer from|money added from|top-?up by|from|plat[aă] de la|de la)\s+(.+)$/i)
    ?? d.match(/^(?:swift transfer to|sepa transfer to|transfer to|payment to|to|c[aă]tre)\s+(.+)$/i)
  return (m ? m[1] : d).trim()
}

/** cyrb53: a small, fast, stable string hash (not for secrets). */
function hash(s: string): string {
  let h1 = 0xdeadbeef ^ 0
  let h2 = 0x41c6ce57 ^ 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}

/**
 * The same transaction's fingerprint in any export, whatever the file is called: the bank's id
 * when there is one; else its started timestamp (to the second), currency, product, type, signed
 * amount, fee, the balance after it and its description. The balance after the transaction is what
 * tells two otherwise identical coffees apart. Never the amount and date alone.
 */
export function fingerprint(t: Omit<BankTx, 'key'>): string {
  if (t.bankId) return `rv:id:${t.bankId}`
  const signed = (t.direction === 'out' ? -t.amount : t.amount).toFixed(2)
  return `rv:${hash([t.startedAt, t.currency, t.product.toLowerCase(), t.type, signed, (t.fee ?? 0).toFixed(2), t.balance === null ? '' : t.balance.toFixed(2), t.description.trim().toLowerCase(), t.reference.trim().toLowerCase()].join('|'))}`
}

export interface ReadOptions {
  /** The file's currency, when it has no currency column (one file per account and currency). */
  fileCurrency?: Currency
  /** Columns chosen by hand; replaces detection entirely. */
  columns?: Columns
  /** Slash dates' order, when the file doesn't show it. */
  dateOrder?: DateOrder
  /** The decimal mark, when the file doesn't show it. */
  decimal?: Decimal
}

const MONEY_FIELDS: Field[] = ['amount', 'moneyIn', 'moneyOut', 'fee', 'balance', 'origAmount']

/** Reads a statement table into bank transactions, reporting every row it couldn't read. */
export function readStatement(table: CsvTable, opts: ReadOptions = {}): Statement {
  const map = opts.columns ? manualMap(table.header, opts.columns, opts) : mapHeader(table.header, opts)
  const c = map.columns
  const notes: ParseIssue[] = []
  const issues: ParseIssue[] = []
  const txs: BankTx[] = []
  const cellAt = (cells: string[], i: number | undefined) => (i === undefined ? '' : (cells[i] ?? '').trim())
  const cell = (cells: string[], f: Field) => cellAt(cells, c[f])

  // What the file's values say about decimals and date order, before any row is read.
  const moneyCols = MONEY_FIELDS.map((f) => c[f]).filter((i): i is number => i !== undefined)
  const dec = detectDecimal(table.rows.flatMap((r) => moneyCols.map((i) => r.cells[i] ?? '')))
  const decimal = opts.decimal ?? dec.decimal
  if (dec.mixed && !opts.decimal) notes.push({ line: 0, message: 'Amounts in this file use both "." and "," as the decimal mark. Each is read as written; any that could be read either way is left out.' })
  const dateCols = [c.started, c.completed].filter((i): i is number => i !== undefined)
  const detected = detectDateOrder(table.rows.flatMap((r) => dateCols.map((i) => r.cells[i] ?? '')))
  const anySlashUndecided = detected === null && table.rows.some((r) => dateCols.some((i) => {
    const m = (r.cells[i] ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/\d{4}/)
    return !!m && +m[1] !== +m[2]
  }))
  const dateOrder: DateOrder | null = opts.dateOrder ?? (detected === 'mixed' ? null : detected)

  const needs = {
    mapping: map.conflicts.length > 0 || map.missing.some((m) => m !== REQUIRED_NOTE.currency),
    currency: map.missing.includes(REQUIRED_NOTE.currency),
    dateOrder: !opts.dateOrder && (detected === 'mixed' || anySlashUndecided),
  }
  const summaryOf = (): Statement['summary'] => {
    const dates = txs.map((t) => t.date).sort()
    return {
      rows: table.rows.length, read: txs.length, from: dates[0] ?? null, to: dates.at(-1) ?? null,
      currencies: [...new Set(txs.map((t) => t.currency))],
      incoming: txs.filter((t) => t.direction === 'in').length, outgoing: txs.filter((t) => t.direction === 'out').length,
    }
  }
  if (needs.mapping || needs.currency || needs.dateOrder) {
    if (detected === 'mixed') notes.push({ line: 0, message: 'Some dates are day first and some month first.' })
    return { txs, issues, notes, map, decimal, dateOrder, needs, summary: summaryOf() }
  }

  // Columns a row can't do without: a row that stops before one of them is cut short.
  const required = [c.started ?? c.completed, c.amount, c.moneyIn, c.moneyOut, c.currency].filter((i): i is number => i !== undefined)
  const lastRequired = Math.max(...required)
  const money = (raw: string, what: string, line: number): number | null | undefined => {
    if (!raw) return null
    const m = readMoney(raw, decimal)
    if (m.ok) return m.value
    issues.push({ line, message: `${what}: ${m.error}.` })
    return undefined
  }
  const seen = new Map<string, number>()
  let positives = 0
  for (const { line, cells } of table.rows) {
    if (cells.length > table.header.length) { issues.push({ line, message: `${cells.length} values for ${table.header.length} columns: a comma inside an unquoted value? Not read, so nothing lands in the wrong column.` }); continue }
    if (cells.length <= lastRequired) { issues.push({ line, message: 'The row stops before its date, amount or currency: it looks cut short.' }); continue }

    const startedRaw = cell(cells, 'started')
    const completedRaw = cell(cells, 'completed')
    const started = startedRaw ? parseDateTime(startedRaw, dateOrder) : null
    const completed = completedRaw ? parseDateTime(completedRaw, dateOrder) : null
    if (startedRaw && !started) { issues.push({ line, message: `Unreadable date "${startedRaw}".` }); continue }
    if (completedRaw && !completed) { issues.push({ line, message: `Unreadable completed date "${completedRaw}".` }); continue }
    const when = completed ?? started
    if (!when) { issues.push({ line, message: 'No date.' }); continue }

    let signed: number
    if (c.amount !== undefined) {
      const a = money(cell(cells, 'amount'), 'Amount', line)
      if (a === undefined) continue
      if (a === null) { issues.push({ line, message: 'No amount.' }); continue }
      signed = a
    } else {
      const inn = money(cell(cells, 'moneyIn'), 'Money in', line)
      if (inn === undefined) continue
      const out = money(cell(cells, 'moneyOut'), 'Money out', line)
      if (out === undefined) continue
      if (inn === null && out === null) { issues.push({ line, message: 'No amount: money in and money out are both empty.' }); continue }
      if (inn !== null && inn < 0) { issues.push({ line, message: `Money in is negative (${cell(cells, 'moneyIn')}): which way did it go?` }); continue }
      const i = inn ?? 0
      const o = Math.abs(out ?? 0)
      if (i && o) { issues.push({ line, message: 'Both money in and money out on one row.' }); continue }
      signed = i ? i : -o
    }
    if (signed === 0) { issues.push({ line, message: 'The amount is zero: nothing moved.' }); continue }

    const currencyRaw = cell(cells, 'currency')
    const currency = currencyRaw ? readCurrency(currencyRaw) : opts.fileCurrency ?? null
    if (!currency) { issues.push({ line, message: currencyRaw ? `"${currencyRaw}" isn't a currency InFlow keeps.` : 'No currency.' }); continue }

    const feeRaw = cell(cells, 'fee')
    const feeRead = money(feeRaw, 'Fee', line)
    if (feeRead === undefined) continue
    let fee: number | null = feeRead === null ? null : round2(Math.abs(feeRead))
    const feeCur = cell(cells, 'feeCurrency')
    if (fee && feeCur && readCurrency(feeCur) !== currency) {
      notes.push({ line, message: `The fee (${feeRaw} ${feeCur}) is in another currency than the transaction: not imported; add it by hand if it was charged.` })
      fee = null
    }

    const balanceRaw = cell(cells, 'balance')
    const balance = balanceRaw ? readMoney(balanceRaw, decimal) : null
    if (balance && !balance.ok) notes.push({ line, message: `Balance not read: ${balance.error}.` })
    const rateRaw = cell(cells, 'rate')
    const rate = rateRaw ? readMoney(rateRaw, decimal, 10) : null
    const origRaw = cell(cells, 'origAmount')
    const orig = origRaw ? readMoney(origRaw, decimal) : null
    const origCur = readCurrency(cell(cells, 'origCurrency'))

    const description = cell(cells, 'description')
    const counterparty = map.counterparties.map((i) => cellAt(cells, i)).find(Boolean) || counterpartyOf(description)
    if (signed > 0) positives++
    const base: Omit<BankTx, 'key'> = {
      line,
      date: when.date,
      startedAt: started ? `${started.date} ${started.time}` : `${when.date} ${when.time}`,
      direction: signed < 0 ? 'out' : 'in',
      amount: round2(Math.abs(signed)),
      fee,
      currency,
      type: upperSnake(cell(cells, 'type')),
      state: c.state === undefined || !cell(cells, 'state') ? 'COMPLETED' : upperSnake(cell(cells, 'state')),
      description,
      counterparty,
      reference: cell(cells, 'reference'),
      balance: balance?.ok ? round2(balance.value) : null,
      product: cell(cells, 'product'),
      bankId: cell(cells, 'id'),
      fileRate: rate?.ok && rate.value > 0 ? rate.value : null,
      original: orig?.ok && origCur ? { amount: round2(Math.abs(orig.value)), currency: origCur } : null,
    }
    // Two genuinely identical rows in one file (same second, amount, balance…) stay two.
    let key = fingerprint(base)
    const n = (seen.get(key) ?? 0) + 1
    seen.set(key, n)
    if (n > 1) key = `${key}#${n}`
    txs.push({ ...base, key })
  }
  if (c.amount !== undefined && txs.length >= 5 && positives === txs.length) {
    notes.push({ line: 0, message: 'Every amount in this file is positive. If money out is shown without a minus sign, it would be read as money in: check, or map Money in and Money out by hand.' })
  }
  return { txs, issues, notes, map, decimal, dateOrder, needs, summary: summaryOf() }
}
