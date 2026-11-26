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
import {
  DATE_FILLER, DIRECTION_HEADERS, DIRECTION_IN, DIRECTION_OUT, fold, FROM_PHRASES, HEADER_WORDS, MONTH_WORDS, PAYEE_HEADERS, PAYER_HEADERS, STATE_WORDS, TO_PHRASES, TYPE_WORDS, type StateWord,
} from './locale'

export type Field =
  | 'type' | 'product' | 'started' | 'completed' | 'description' | 'counterparty' | 'amount' | 'moneyIn' | 'moneyOut'
  | 'fee' | 'feeCurrency' | 'currency' | 'state' | 'balance' | 'id' | 'reference' | 'rate' | 'origAmount' | 'origCurrency' | 'direction'

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
  direction: [],
}

/**
 * Every name a field is known by: English and Romanian above, the other languages from
 * `locale.ts`, and the direction column's names. Folded.
 */
export const ALL_ALIASES: Record<Field, string[]> = Object.fromEntries((Object.keys(ALIASES) as Field[]).map((f) => [f, [...new Set([
  ...ALIASES[f], ...(HEADER_WORDS[f] ?? []), ...(f === 'direction' ? DIRECTION_HEADERS : []),
].map(fold))]])) as Record<Field, string[]>

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
  origAmount: 'Original amount', origCurrency: 'Original currency', direction: 'Direction (in / out)',
}

const norm = fold

/** A time-zone name Intl knows ("Europe/Bucharest"), as written; null otherwise. */
function ianaZone(label: string): string | null {
  const t = label.trim()
  if (!/^[A-Za-z_]+\/[A-Za-z_\-/+0-9]+$/.test(t)) return null
  try { new Intl.DateTimeFormat('en-GB', { timeZone: t }); return t } catch { return null }
}

/**
 * "Date started (UTC)" → { base: "date started", zone: "UTC" }; "Date started (Europe/London)" →
 * zone "Europe/London"; "Bedrag (EUR)" → { base: "bedrag", currency: "EUR" }.
 */
function headerName(h: string): { base: string; zone: string | null; currency: Currency | null } {
  const m = h.match(/^(.*?)\s*[([]([^)\]]*)[)\]]\s*$/)
  if (!m) return { base: norm(h), zone: null, currency: null }
  const inner = m[2].trim()
  return {
    base: norm(m[1]),
    zone: norm(inner) === 'utc' || norm(inner) === 'gmt' ? 'UTC' : ianaZone(inner),
    currency: (CURRENCIES as string[]).includes(inner.toUpperCase()) ? inner.toUpperCase() as Currency : null,
  }
}

export type Columns = Partial<Record<Field, number>>

/** Which side a counterparty column names: the payer (for money in), the payee (for money out), or either. */
export type PartySide = 'payer' | 'payee' | 'any'

export interface ColumnMap {
  columns: Columns
  /** Columns that may hold the other party, each with its side. */
  counterparties: { i: number; side: PartySide }[]
  /** The time zone the chosen date columns are labelled with ("UTC", "Europe/London"), if any. */
  zones: { started?: string; completed?: string }
  /** Headers no field claimed: shown, never used. */
  unknown: string[]
  /** Headers recognised and deliberately not used ("Total amount", "Card number"…). */
  unused: string[]
  /** What the file lacks to be read at all. */
  missing: string[]
  /** Two columns that claim one meaning; the file can't be read until you say which. */
  conflicts: string[]
  /** A currency named in the amount's header ("Bedrag (EUR)"), used when there is no currency column. */
  headerCurrency?: Currency
}

export const REQUIRED_NOTE = {
  date: 'a date (e.g. "Started Date", "Completed Date" or "Date")',
  amount: 'an amount (e.g. "Amount", "Betrag", "Montant", or "Money in" and "Money out")',
  currency: 'a currency (a "Currency" column, or choose the file\'s currency)',
}

function check(columns: Columns, header: string[], opts: { fileCurrency?: Currency; headerCurrency?: Currency }): { missing: string[]; conflicts: string[] } {
  const missing: string[] = []
  const conflicts: string[] = []
  if (columns.started === undefined && columns.completed === undefined) missing.push(REQUIRED_NOTE.date)
  const hasSigned = columns.amount !== undefined
  const hasInOut = columns.moneyIn !== undefined || columns.moneyOut !== undefined
  if (!hasSigned && !hasInOut) missing.push(REQUIRED_NOTE.amount)
  if (columns.direction !== undefined && hasInOut) conflicts.push(`A direction column ("${header[columns.direction]}") and money in / money out columns: use one or the other.`)
  if (columns.direction !== undefined && !hasSigned) conflicts.push(`A direction column ("${header[columns.direction]}") needs an Amount column beside it.`)
  if (hasSigned && hasInOut) conflicts.push(`Both a signed amount ("${header[columns.amount!]}") and money in / money out columns: use one or the other.`)
  if (columns.currency === undefined && !opts.fileCurrency && !opts.headerCurrency) missing.push(REQUIRED_NOTE.currency)
  // One column can't mean two things.
  const used = new Map<number, Field>()
  for (const [f, i] of Object.entries(columns) as [Field, number][]) {
    if (i === undefined) continue
    if (used.has(i)) conflicts.push(`"${header[i]}" is mapped as both ${FIELD_LABEL[used.get(i)!].toLowerCase()} and ${FIELD_LABEL[f].toLowerCase()}.`)
    else used.set(i, f)
  }
  return { missing, conflicts }
}

const PAYER = new Set(PAYER_HEADERS.map(fold))
const PAYEE = new Set(PAYEE_HEADERS.map(fold))
const sideOf = (base: string): PartySide => (PAYER.has(base) ? 'payer' : PAYEE.has(base) ? 'payee' : 'any')

/** The currency all amount headers agree on ("Bedrag (EUR)"), if any. */
function amountHeaderCurrency(columns: Columns, named: ReturnType<typeof headerName>[]): Currency | undefined {
  const cur = (['amount', 'moneyIn', 'moneyOut'] as Field[]).map((f) => columns[f]).filter((i): i is number => i !== undefined).map((i) => named[i].currency).filter((x): x is Currency => !!x)
  return cur.length && cur.every((x) => x === cur[0]) ? cur[0] : undefined
}

const zonesOf = (columns: Columns, named: ReturnType<typeof headerName>[]): ColumnMap['zones'] => {
  const z: ColumnMap['zones'] = {}
  if (columns.started !== undefined && named[columns.started].zone) z.started = named[columns.started].zone!
  if (columns.completed !== undefined && named[columns.completed].zone) z.completed = named[columns.completed].zone!
  return z
}

/**
 * Finds each field's column by name. Two columns with one meaning are a conflict (asked, never
 * picked), except a UTC and a local time of the same date (the local one is used, converted from
 * its labelled zone if it has one) and several columns for the other party (each with its side).
 */
export function mapHeader(header: string[], opts: { fileCurrency?: Currency } = {}): ColumnMap {
  const named = header.map(headerName)
  const found: Partial<Record<Field, { i: number; utc: boolean }[]>> = {}
  const claimed = new Set<number>()
  const seenNames = new Map<string, number>()
  const conflicts: string[] = []
  named.forEach(({ base, zone }, i) => {
    if (!base) return
    const f = (Object.keys(ALL_ALIASES) as Field[]).find((k) => ALL_ALIASES[k].includes(base))
    if (!f) return
    // The very same header twice ("Amount", "Amount") is a conflict for any field, the other party included.
    const full = `${base}|${zone ?? ''}`
    if (seenNames.has(full)) conflicts.push(`Two columns are both called "${header[i]}".`)
    seenNames.set(full, i)
    ;(found[f] ??= []).push({ i, utc: zone === 'UTC' })
    claimed.add(i)
  })
  const columns: Columns = {}
  let counterparties: ColumnMap['counterparties'] = []
  for (const [f, hits] of Object.entries(found) as [Field, { i: number; utc: boolean }[]][]) {
    if (f === 'counterparty') {
      counterparties = hits.map((h) => ({ i: h.i, side: sideOf(named[h.i].base) }))
      columns.counterparty = hits[0].i
      // Two columns for the same side (two "Name" columns) can't be told apart.
      const sides = counterparties.map((x) => x.side)
      if (new Set(sides).size !== sides.length) conflicts.push(`${hits.map((h) => `"${header[h.i]}"`).join(' and ')} could each be the other party.`)
      continue
    }
    if (hits.length === 1) { columns[f] = hits[0].i; continue }
    const local = hits.filter((h) => !h.utc)
    if ((f === 'started' || f === 'completed') && local.length === 1 && hits.length === 2) { columns[f] = local[0].i; continue }
    conflicts.push(`${hits.map((h) => `"${header[h.i]}"`).join(' and ')} could each be the ${FIELD_LABEL[f].toLowerCase()}.`)
  }
  const headerCurrency = amountHeaderCurrency(columns, named)
  const c = check(columns, header, { ...opts, headerCurrency })
  const unusedSet = new Set(KNOWN_UNUSED)
  return {
    columns,
    counterparties,
    zones: zonesOf(columns, named),
    unknown: header.map((h, i) => (h.trim() ? h : `Column ${i + 1} (no name)`)).filter((_, i) => !claimed.has(i) && !unusedSet.has(named[i].base)),
    unused: header.filter((_, i) => !claimed.has(i) && unusedSet.has(named[i].base)),
    missing: c.missing,
    conflicts: [...new Set([...conflicts, ...c.conflicts])],
    ...(headerCurrency ? { headerCurrency } : {}),
  }
}

/** A mapping made by hand (the UI's column pickers): checked the same way, nothing inferred but the header's own labels. */
export function manualMap(header: string[], columns: Columns, opts: { fileCurrency?: Currency } = {}): ColumnMap {
  const clean: Columns = {}
  const bad: string[] = []
  for (const [f, i] of Object.entries(columns) as [Field, number | undefined][]) {
    if (i === undefined) continue
    if (Number.isInteger(i) && i >= 0 && i < header.length) clean[f] = i
    else bad.push(`${FIELD_LABEL[f]} points at a column the file doesn't have.`)
  }
  const named = header.map(headerName)
  const headerCurrency = amountHeaderCurrency(clean, named)
  const c = check(clean, header, { ...opts, headerCurrency })
  const used = new Set(Object.values(clean))
  return {
    columns: clean,
    counterparties: clean.counterparty === undefined ? [] : [{ i: clean.counterparty, side: 'any' }],
    zones: zonesOf(clean, named),
    unknown: header.filter((h, i) => !used.has(i) && h.trim() !== ''),
    unused: [],
    missing: c.missing,
    conflicts: [...bad, ...c.conflicts],
    ...(headerCurrency ? { headerCurrency } : {}),
  }
}

// ── numbers ─────────────────────────────────────────────────────────────────

export type Decimal = '.' | ','

export type Money = { ok: true; value: number } | { ok: false; error: string }

/** Strips what surrounds a number: spaces, currency symbols or codes, a sign written either side, brackets. */
function bare(raw: string): { s: string; negative: boolean; signs: number } | null {
  // Spaces of every width and apostrophes group thousands; U+2212 is a minus sign as typeset.
  let s = raw.trim().replace(/[\s\u00A0\u202F'\u2019]/g, '').replace(/\u2212/g, '-')
  if (!s) return null
  // Currency symbols or codes around the number, in any language ("€", "lei", "zł", "RON").
  s = s.replace(/^[^\d.,+(-]+|[^\d.,)-]+$/g, '')
  // Each way of writing a sign is counted: two at once ("(-12.50)", "-12.50-") is malformed, never cancelled out.
  let negative = false
  let signs = 0
  if (/^\(.*\)$/.test(s)) { negative = true; signs++; s = s.slice(1, -1) }
  if (/-$/.test(s)) { negative = true; signs++; s = s.slice(0, -1) }
  if (s.startsWith('-')) { negative = true; signs++; s = s.slice(1) } else if (s.startsWith('+')) { signs++; s = s.slice(1) }
  return { s, negative, signs }
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
  if (b.signs > 1) return { ok: false, error: `"${raw.trim()}" has more than one sign` }
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
  // Beyond 13 whole digits a number can't be held to the ban.
  if ((int || '0').split(t).join('').replace(/^0+/, '').length > 13) return { ok: false, error: `"${raw.trim()}" is too large to be read exactly` }
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

export type DateOrder = 'dmy' | 'mdy'

const pad = (n: number) => String(n).padStart(2, '0')
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
const valid = (y: number, m: number, d: number) => y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m)

/** A time of day anywhere in the text: "14:05", "14:05:22", "2:05 PM". `ok` is false for an impossible time (25:00). */
function timeIn(s: string): { time: string; rest: string; has: boolean; ok: boolean } {
  const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*([ap])\.?\s?m\b\.?/i) ?? s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?/)
  if (!m) return { time: '00:00:00', rest: s, has: false, ok: true }
  let h = Number(m[1])
  const ampm = m[4]?.toLowerCase()
  const ok = Number(m[2]) < 60 && Number(m[3] ?? 0) < 60 && (ampm ? h >= 1 && h <= 12 : h < 24)
  if (ampm === 'p' && h < 12) h += 12
  if (ampm === 'a' && h === 12) h = 0
  return { time: `${pad(h)}:${m[2]}:${m[3] ?? '00'}`, rest: s.replace(m[0], ' '), has: true, ok }
}

/** "Z", "+02:00", "-0500" at the end of a timestamp, in minutes east of UTC; null when there is none. */
function offsetIn(rest: string): number | null {
  const m = rest.trim().match(/(?:^|[\d\s])(Z|[+-]\d{2}:?\d{2})$/i)
  if (!m) return null
  if (m[1].toUpperCase() === 'Z') return 0
  const sign = m[1][0] === '-' ? -1 : 1
  const digits = m[1].slice(1).replace(':', '')
  return sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2)))
}

export interface ParsedDate {
  /** As written in the file, before any time zone is applied. */
  date: string
  time: string
  /** The value had a time of day (a date alone has none). */
  hasTime: boolean
  /** An explicit offset in the value (Z, +02:00), in minutes east of UTC; null when none was written. */
  offset: number | null
}

/**
 * A date and time as banks write them, in any of the supported languages:
 *  - "2026-03-01 14:05:22" (Revolut), "2026-03-01T14:05:00Z", "2026-03-01T14:05:00+02:00",
 *    "2026/03/01", "2026.03.01.", "20260301"
 *  - "01.03.2026" (day first: the dotted form is European)
 *  - "01/03/2026", "01-03-2026": by `order`; null when the order isn't known and it reads both ways
 *  - a month in words, in any order around the day and year: "1 Mar 2026", "1. März 2026",
 *    "1 de marzo de 2026", "Mar 1, 2026", "1 mars 2026", "2026. márc. 1.", "1 marca 2026"
 *  - with a time in 24 or 12 hours ("2:05 PM").
 * The values are returned as written; `readStatement` applies the time zone. Two-digit years and
 * impossible dates or times are not read. Null when not certain.
 */
export function parseDateTime(raw: string, order: DateOrder | null = 'dmy'): ParsedDate | null {
  const s = raw.trim()
  if (!s) return null
  const make = (y: number, mo: number, d: number, rest = ''): ParsedDate | null => {
    if (!valid(y, mo, d)) return null
    const t = timeIn(rest)
    if (!t.ok) return null
    return { date: `${y}-${pad(mo)}-${pad(d)}`, time: t.time, hasTime: t.has, offset: t.has ? offsetIn(rest) : null }
  }
  // Compact "20260903" (ING and others): unambiguous when it is a real date.
  let m = s.match(/^(\d{4})(\d{2})(\d{2})(?:[T\s](.*))?$/)
  if (m) return make(+m[1], +m[2], +m[3], m[4])
  m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\.?(?:[T\s,]+(.*))?$/)
  if (m) return make(+m[1], +m[2], +m[3], m[4])
  m = s.match(/^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})\.?(?:[\s,]+(.*))?$/)
  if (m) return make(+m[3], +m[2], +m[1], m[4])
  m = s.match(/^(\d{1,2})([/-])(\d{1,2})\2(\d{4})(?:[\s,T]+(.*))?$/)
  if (m) {
    const a = +m[1], b = +m[3]
    const o: DateOrder | null = a === b ? 'dmy' : a > 12 ? 'dmy' : b > 12 ? 'mdy' : order
    if (!o) return null
    const [d, mo] = o === 'dmy' ? [a, b] : [b, a]
    return make(+m[4], mo, d, m[5])
  }
  // A month in words: exactly one year, one month and one day, whatever their order.
  const t = timeIn(s)
  if (!t.ok) return null
  const tokens = fold(t.rest).split(' ').filter((w) => w && !DATE_FILLER.has(w))
  const years = tokens.filter((w) => /^\d{4}$/.test(w))
  const days = tokens.filter((w) => /^\d{1,2}$/.test(w))
  const months = tokens.filter((w) => !/^\d+$/.test(w)).map((w) => MONTH_WORDS[w] ?? MONTH_WORDS[w.slice(0, 3)] ?? MONTH_WORDS[w.slice(0, 4)])
  if (years.length !== 1 || days.length !== 1 || months.length !== 1 || !months[0]) return null
  if (tokens.length !== 3) return null
  const [y, mo, d] = [+years[0], months[0], +days[0]]
  return valid(y, mo, d) ? { date: `${y}-${pad(mo)}-${pad(d)}`, time: t.time, hasTime: t.has, offset: null } : null
}

// ── time zones ──────────────────────────────────────────────────────────────

/** InFlow's accounting time zone: a transaction belongs to the day it happened in Bucharest. */
export const ACCOUNTING_ZONE = 'Europe/Bucharest'

const zoneParts = (ms: number, zone: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms))
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') }
}

/** An instant as the date and time on the wall in `zone`. */
export function wallClock(ms: number, zone = ACCOUNTING_ZONE): { date: string; time: string } {
  const p = zoneParts(ms, zone)
  return { date: `${p.y}-${pad(p.mo)}-${pad(p.d)}`, time: `${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}` }
}

/** The instant a wall-clock date and time in `zone` names (the earlier one in a DST fold). */
export function instantOf(date: string, time: string, zone: string): number {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi, se] = time.split(':').map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi, se)
  if (zone === 'UTC') return guess
  const offset = (ms: number) => { const p = zoneParts(ms, zone); return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - ms }
  const first = guess - offset(guess)
  return guess - offset(first)
}

/** The order of numeric slash or dash dates in a file: what any date with a part above 12 says; null if none says; 'mixed' if they disagree. */
export function detectDateOrder(values: string[]): DateOrder | null | 'mixed' {
  const seen = new Set<DateOrder>()
  for (const v of values) {
    const m = v.trim().match(/^(\d{1,2})([/-])(\d{1,2})\2\d{4}/)
    if (!m) continue
    if (+m[1] > 12) seen.add('dmy')
    else if (+m[3] > 12) seen.add('mdy')
  }
  return seen.size > 1 ? 'mixed' : seen.size === 1 ? [...seen][0] : null
}

/** A numeric slash or dash date whose day and month could be swapped. */
export const undecidedDate = (v: string): boolean => {
  const m = v.trim().match(/^(\d{1,2})([/-])(\d{1,2})\2\d{4}/)
  return !!m && +m[1] !== +m[3] && +m[1] <= 12 && +m[3] <= 12
}

// ── currencies ──────────────────────────────────────────────────────────────

/** Symbols and local names; "$" and "kr" are refused: each is several currencies. */
const SYMBOLS: Record<string, Currency> = {
  '€': 'EUR', 'EURO': 'EUR', 'EUROS': 'EUR', '£': 'GBP', 'LEI': 'RON', 'LEU': 'RON', 'ZŁ': 'PLN', 'ZL': 'PLN', 'ZLOTY': 'PLN',
  'KČ': 'CZK', 'KC': 'CZK', 'FT': 'HUF', 'FORINT': 'HUF', 'FR.': 'CHF', 'SFR': 'CHF', '¥': 'JPY', '円': 'JPY', '₺': 'TRY', 'TL': 'TRY',
}

/** A currency cell as InFlow's code, or null. "$" is refused: it is several currencies. */
export function readCurrency(raw: string): Currency | null {
  const s = raw.trim().toUpperCase()
  if ((CURRENCIES as string[]).includes(s)) return s as Currency
  return SYMBOLS[s] ?? null
}

// ── transactions ────────────────────────────────────────────────────────────

/** A bank transaction, as read: nothing from InFlow yet. */
export interface BankTx {
  /**
   * Its identity in any export: the bank's id ("rv:id:…") when the file has one, else `fp`.
   * See `fingerprint`.
   */
  key: string
  /** Its content fingerprint, whether or not it has a bank id: finds it again in a layout without ids. */
  fp: string
  /** More than 1 when identical rows in this file can't be told apart (no id, no balance): each needs a decision. */
  twins: number
  line: number
  /** The accounting date: the day it was completed, else started, in Bucharest (see `ACCOUNTING_ZONE`). */
  date: string
  /** When it started, Bucharest time ("YYYY-MM-DD HH:MM:SS"), for display. */
  startedAt: string
  direction: 'in' | 'out'
  /** Positive, in `currency`. The fee is not in it. */
  amount: number
  /** Positive; charged on top of `amount`. 0 when the file says 0; null when it says nothing or can't be read. */
  fee: number | null
  currency: Currency
  /** Revolut's English code ("CARD_PAYMENT"), or the type as written in capitals when unknown. Empty with no type. */
  type: string
  /**
   * COMPLETED, PENDING, REVERTED, DECLINED, FAILED, CANCELLED; UNKNOWN when the file's state cell
   * is empty. Only COMPLETED is ever imported.
   */
  state: string
  /** As in the file (outer spaces trimmed). */
  description: string
  /** The other party: a counterparty column on the right side, else read from the description. */
  counterparty: string
  /** As in the file; empty when there is none. */
  reference: string
  balance: number | null
  product: string
  /** The bank's own transaction id, when the file has one. */
  bankId: string
  /** An exchange rate in the file, kept only for the record; InFlow uses the day's rate. */
  fileRate: number | null
  /** The amount before conversion, when the file gives one (Business-style "Orig amount"). For the record only, never imported. */
  original: { amount: number; currency: Currency } | null
}

export interface ParseIssue { line: number; message: string }

export interface Needs {
  /** Columns missing or in conflict: map them by hand. */
  mapping: boolean
  /** No currency column: name the file's currency. */
  currency: boolean
  /** Slash or dash dates that read both ways. */
  dateOrder: boolean
  /** Amounts whose decimal mark the amount column itself doesn't show ("1,250"). */
  decimal: boolean
  /** Times with no zone near midnight, whose day depends on whether they are UTC or Bucharest time. */
  timeZone: boolean
  /** No state column: are the rows all completed? */
  stateless: boolean
  /** Every amount positive, yet some rows are card payments or fees: is money out shown without a minus? */
  signs: boolean
  /** State values in no language InFlow knows (as written): say what each means. */
  states: string[]
  /** Direction values InFlow doesn't know (as written): say which is in and which is out. */
  directions: string[]
}

export interface Statement {
  txs: BankTx[]
  /** Rows not read, each with why. With `txs`, every data row is accounted for (while nothing is needed). */
  issues: ParseIssue[]
  /** Rows read with something left out (a fee that can't be read…), and remarks about the file. Line 0 is the file. */
  notes: ParseIssue[]
  map: ColumnMap
  /** The amount's decimal mark, as shown by the amount column or given. */
  decimal: Decimal | null
  dateOrder: DateOrder | null
  /** What must be settled by hand before anything is read. While any is set, `txs` is empty: nothing is read on a guess. */
  needs: Needs
  summary: { rows: number; read: number; from: string | null; to: string | null; currencies: Currency[]; incoming: number; outgoing: number }
}

export const waiting = (n: Needs): boolean =>
  n.mapping || n.currency || n.dateOrder || n.decimal || n.timeZone || n.stateless || n.signs || n.states.length > 0 || n.directions.length > 0

const upperSnake = (s: string) => {
  const u = s.trim().toUpperCase().replace(/[\s-]+/g, '_')
  return u === 'TOP_UP' ? 'TOPUP' : u
}

const STATE_INDEX = new Map(Object.entries(STATE_WORDS).flatMap(([k, ws]) => ws.map((w) => [fold(w), k as StateWord] as const)))
const TYPE_INDEX = new Map(Object.entries(TYPE_WORDS).flatMap(([k, ws]) => ws.map((w) => [fold(w), k] as const)))

/** A state in any supported language, as Revolut's English code; null when not known. */
export function readState(raw: string): StateWord | null {
  return STATE_INDEX.get(fold(raw)) ?? null
}

/** A type in any supported language, as Revolut's English code; unknown types are kept as written (upper case). */
export function readType(raw: string): string {
  return TYPE_INDEX.get(fold(raw)) ?? upperSnake(raw)
}

/** "Bij"/"Af", "Credit"/"Debit", "H"/"S"…: which way an unsigned amount went; null when not known. */
export function readDirection(raw: string): 'in' | 'out' | null {
  const f = fold(raw)
  return DIRECTION_IN.includes(f) ? 'in' : DIRECTION_OUT.includes(f) ? 'out' : null
}

const PHRASES = (list: string[]) => [...new Set(list.map(fold))].sort((a, b) => b.length - a.length)
const FROM = PHRASES(FROM_PHRASES)
const TO = PHRASES(TO_PHRASES)

/**
 * The other party, from the usual wording in any supported language ("Payment from X", "Plată de
 * la X", "Zahlung von X", "Virement de X", "To X", "Către X"); the description itself otherwise
 * (a card payment's merchant). The name keeps its own letters and case.
 */
export function counterpartyOf(description: string): string {
  const d = description.trim().normalize('NFC')
  // Accents removed letter for letter, so positions match the original.
  const plain = d.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  for (const phrase of [...FROM, ...TO]) {
    const re = new RegExp(`^${phrase.split(' ').map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s-]+')}[\\s:]+`, 'u')
    const m = plain.match(re)
    if (m && m[0].length < d.length) return d.slice(m[0].length).trim()
  }
  return d
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
 * The content fingerprint of a transaction: the instant it started (UTC, to the second; the date
 * when the file has no time), its currency and signed amount, and then the balance after it, or,
 * when the file has no balance, its description and reference. Not the type, product or fee (they
 * change with the app's language and layout), and never the file name. The balance after a
 * transaction is what tells two otherwise identical coffees apart; without it, identical rows
 * can't be told apart (see `BankTx.twins`).
 */
export function fingerprint(t: { instant: string; currency: string; signed: number; balance: number | null; description: string; reference: string }): string {
  const tail = t.balance !== null ? `b:${t.balance.toFixed(2)}` : `d:${fold(t.description)}|${fold(t.reference)}`
  return `rv:${hash([t.instant, t.currency, t.signed.toFixed(2), tail].join('|'))}`
}

export interface ReadOptions {
  /** The file's currency, when it has no currency column (one file per account and currency). */
  fileCurrency?: Currency
  /** Columns chosen by hand; replaces detection entirely. */
  columns?: Columns
  /** Slash dates' order, when the file doesn't show it. */
  dateOrder?: DateOrder
  /** The amount's decimal mark, when the amount column doesn't show it. */
  decimal?: Decimal
  /** What times with no zone in the file are: Bucharest time, or UTC. */
  timeZone?: 'local' | 'utc'
  /** The file has no state column, and every row in it is a completed transaction. */
  allCompleted?: boolean
  /** Every amount is positive, and that is right: they are all money in. */
  positivesConfirmed?: boolean
  /** What state values InFlow doesn't know mean, by the value folded (see `fold`). */
  states?: Record<string, StateWord>
  /** Which way direction values InFlow doesn't know go, by the value folded. */
  directions?: Record<string, 'in' | 'out'>
}

const OUT_TYPES = new Set(['CARD_PAYMENT', 'FEE', 'ATM'])

/** Reads a statement table into bank transactions, reporting every row it couldn't read. */
export function readStatement(table: CsvTable, opts: ReadOptions = {}): Statement {
  const map = opts.columns ? manualMap(table.header, opts.columns, opts) : mapHeader(table.header, opts)
  const c = map.columns
  const notes: ParseIssue[] = []
  const issues: ParseIssue[] = []
  let txs: BankTx[] = []
  const cellAt = (cells: string[], i: number | undefined) => (i === undefined ? '' : (cells[i] ?? '').trim())
  const cell = (cells: string[], f: Field) => cellAt(cells, c[f])
  // Only well-formed rows speak for the file as a whole.
  const sound = table.rows.filter((r) => !r.error && r.cells.length === table.header.length)
  const column = (i: number | undefined) => (i === undefined ? [] : sound.map((r) => (r.cells[i] ?? '').trim()).filter(Boolean))

  // Decimal marks: the amount's from the amount columns alone; each optional column from its own values.
  const amountValues = [c.amount, c.moneyIn, c.moneyOut].flatMap(column)
  const amountDec = detectDecimal(amountValues)
  const decimal = opts.decimal ?? amountDec.decimal
  const ambiguous = (v: string) => { const m = readMoney(v, null); return !m.ok && /could be/.test(m.error) }
  if (amountDec.mixed && !opts.decimal) notes.push({ line: 0, message: 'Amounts in this file use both "." and "," as the decimal mark. Each is read as written.' })
  const decimalOf = (f: Field) => opts.decimal ?? detectDecimal(column(c[f])).decimal

  // Dates: their order, and their time zone.
  const dateCols = [c.started, c.completed].filter((i): i is number => i !== undefined)
  const dateValues = dateCols.flatMap(column)
  const detected = detectDateOrder(dateValues)
  const dateOrder: DateOrder | null = opts.dateOrder ?? (detected === 'mixed' ? null : detected)
  const zoneFor = (f: 'started' | 'completed'): string | null => map.zones[f] ?? null
  /** The instant a date cell names, and whether its zone is still unknown (a naive time). */
  const instant = (p: ParsedDate, f: 'started' | 'completed'): { ms: number | null; naive: boolean } => {
    if (!p.hasTime) return { ms: null, naive: false }
    if (p.offset !== null) return { ms: instantOf(p.date, p.time, 'UTC') - p.offset * 60_000, naive: false }
    const z = zoneFor(f)
    if (z) return { ms: instantOf(p.date, p.time, z), naive: false }
    return { ms: instantOf(p.date, p.time, opts.timeZone === 'utc' ? 'UTC' : ACCOUNTING_ZONE), naive: true }
  }
  // Naive times whose Bucharest day would differ if they were UTC: the zone must be said.
  const zoneMatters = !opts.timeZone && sound.some((r) => (['started', 'completed'] as const).some((f) => {
    const raw = cellAt(r.cells, c[f])
    const p = raw ? parseDateTime(raw, dateOrder ?? 'dmy') : null
    if (!p || !p.hasTime || p.offset !== null || zoneFor(f)) return false
    return wallClock(instantOf(p.date, p.time, 'UTC')).date !== p.date
  }))

  function distinct(col: number | undefined, unknown: (v: string) => boolean): string[] {
    if (col === undefined) return []
    const out = new Map<string, string>()
    for (const r of sound) { const v = (r.cells[col] ?? '').trim(); if (v && unknown(v) && !out.has(fold(v))) out.set(fold(v), v) }
    return [...out.values()]
  }
  const needs: Needs = {
    mapping: map.conflicts.length > 0 || map.missing.some((m) => m !== REQUIRED_NOTE.currency),
    currency: map.missing.includes(REQUIRED_NOTE.currency),
    dateOrder: !opts.dateOrder && (detected === 'mixed' || (detected === null && dateValues.some(undecidedDate))),
    // Asked only when the amount column shows no decimal mark of its own and some amount reads two ways.
    decimal: !opts.decimal && !amountDec.decimal && amountValues.some(ambiguous),
    timeZone: zoneMatters,
    stateless: c.state === undefined && !opts.allCompleted,
    signs: false,
    states: distinct(c.state, (v) => !readState(v) && !opts.states?.[fold(v)]),
    directions: distinct(c.direction, (v) => !readDirection(v) && !opts.directions?.[fold(v)]),
  }
  const summaryOf = (): Statement['summary'] => {
    const dates = txs.map((t) => t.date).sort()
    return {
      rows: table.rows.length, read: txs.length, from: dates[0] ?? null, to: dates.at(-1) ?? null,
      currencies: [...new Set(txs.map((t) => t.currency))],
      incoming: txs.filter((t) => t.direction === 'in').length, outgoing: txs.filter((t) => t.direction === 'out').length,
    }
  }
  if (detected === 'mixed') notes.push({ line: 0, message: 'Some dates are day first and some month first.' })
  if (waiting(needs)) return { txs: [], issues: [], notes, map, decimal, dateOrder, needs, summary: summaryOf() }

  // Fees: one sign convention per file, or none is trusted.
  const feeSigns = new Set(column(c.fee).map((v) => readMoney(v, decimalOf('fee'))).filter((m) => m.ok && m.value !== 0).map((m) => (m.ok && m.value < 0 ? '-' : '+')))
  const feesUnclear = feeSigns.size > 1
  if (feesUnclear) notes.push({ line: 0, message: 'Fees in this file are both positive and negative, so which are charges can\'t be told: no fee is imported. Add them by hand.' })

  // Columns a row can't do without: a row that stops before one of them is cut short.
  const required = [c.started ?? c.completed, c.amount, c.moneyIn, c.moneyOut, c.currency, c.direction].filter((i): i is number => i !== undefined)
  const lastRequired = Math.max(...required)
  /** A core money value: undefined when unreadable (the row is reported), null when empty. */
  const money = (raw: string, what: string, line: number): number | null | undefined => {
    if (!raw) return null
    const m = readMoney(raw, decimal)
    if (m.ok) return m.value
    issues.push({ line, message: `${what}: ${m.error}.` })
    return undefined
  }
  /** An optional money value: never stops the row; an unreadable one is noted and left unknown. */
  const optional = (cells: string[], f: Field, what: string, line: number, maxDecimals = 2): number | null => {
    const raw = cell(cells, f)
    if (!raw) return null
    const m = readMoney(raw, decimalOf(f), maxDecimals)
    if (m.ok) return m.value
    notes.push({ line, message: `${what} not read: ${m.error}. The transaction is kept without it.` })
    return null
  }

  const byId = new Map<string, { line: number; fp: string }>()
  const heldIds = new Set<string>()
  const prepared: (Omit<BankTx, 'key' | 'twins'> & { instantKey: string })[] = []
  for (const { line, cells, error } of table.rows) {
    if (error) { issues.push({ line, message: error }); continue }
    if (cells.length > table.header.length) { issues.push({ line, message: `${cells.length} values for ${table.header.length} columns: a delimiter inside an unquoted value? Not read, so nothing lands in the wrong column.` }); continue }
    if (cells.length <= lastRequired) { issues.push({ line, message: 'The row stops before its date, amount or currency: it looks cut short.' }); continue }

    const startedRaw = cell(cells, 'started')
    const completedRaw = cell(cells, 'completed')
    const started = startedRaw ? parseDateTime(startedRaw, dateOrder) : null
    const completed = completedRaw ? parseDateTime(completedRaw, dateOrder) : null
    if (startedRaw && !started) { issues.push({ line, message: `Unreadable date "${startedRaw}".` }); continue }
    if (completedRaw && !completed) { issues.push({ line, message: `Unreadable completed date "${completedRaw}".` }); continue }
    if (!started && !completed) { issues.push({ line, message: 'No date.' }); continue }
    // Each date, as the day and time it was in Bucharest.
    const local = (p: ParsedDate | null, f: 'started' | 'completed') => {
      if (!p) return null
      const at = instant(p, f)
      return { ...(at.ms === null ? { date: p.date, time: p.time } : wallClock(at.ms)), ms: at.ms }
    }
    const s0 = local(started, 'started')
    const c0 = local(completed, 'completed')
    const when = (c0 ?? s0)!
    const begin = (s0 ?? c0)!
    if (s0?.ms != null && c0?.ms != null && c0.ms < s0.ms) notes.push({ line, message: 'It completed before it started, by the file\'s own times: the completed date is used.' })

    let signed: number
    if (c.amount !== undefined) {
      const a = money(cell(cells, 'amount'), 'Amount', line)
      if (a === undefined) continue
      if (a === null) { issues.push({ line, message: 'No amount.' }); continue }
      signed = a
      if (c.direction !== undefined) {
        // An unsigned amount with its direction beside it ("Af"/"Bij", "Debit"/"Credit").
        const raw = cell(cells, 'direction')
        const way = raw ? readDirection(raw) ?? opts.directions?.[fold(raw)] ?? null : null
        if (!way) { issues.push({ line, message: raw ? `Unknown direction "${raw}".` : 'No direction (in or out) for this amount.' }); continue }
        if (a < 0) { issues.push({ line, message: `The amount is negative and has a direction ("${raw}") too: which way did it go?` }); continue }
        signed = way === 'in' ? a : -a
      }
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
    const currency = currencyRaw ? readCurrency(currencyRaw) : opts.fileCurrency ?? map.headerCurrency ?? null
    if (!currency) { issues.push({ line, message: currencyRaw ? `"${currencyRaw}" isn't a currency InFlow keeps.` : 'No currency.' }); continue }

    // Optional values: unreadable ones are noted and left unknown; the transaction stays.
    let fee: number | null = feesUnclear ? null : optional(cells, 'fee', 'Fee', line)
    if (fee !== null) fee = round2(Math.abs(fee))
    const feeCur = cell(cells, 'feeCurrency')
    if (fee && feeCur && readCurrency(feeCur) !== currency) {
      notes.push({ line, message: `The fee (${cell(cells, 'fee')} ${feeCur}) is in another currency than the transaction: not imported; add it by hand if it was charged.` })
      fee = null
    }
    const balance = optional(cells, 'balance', 'Balance', line)
    const rateRaw = cell(cells, 'rate')
    const rate = rateRaw ? readMoney(rateRaw, decimalOf('rate'), 10) : null
    if (rate && !rate.ok) notes.push({ line, message: `Exchange rate not read: ${rate.error}.` })
    const orig = optional(cells, 'origAmount', 'Original amount', line)
    const origCurRaw = cell(cells, 'origCurrency')
    const origCur = origCurRaw ? readCurrency(origCurRaw) : null
    if (orig !== null && !origCur) notes.push({ line, message: `Original amount kept out: its currency ("${origCurRaw}") isn't known.` })

    const description = cell(cells, 'description')
    const way: 'in' | 'out' = signed < 0 ? 'out' : 'in'
    // The other party from a column on the right side: the payer for money in, the payee for money out.
    const fromColumns = map.counterparties
      .filter((x) => x.side === 'any' || x.side === (way === 'in' ? 'payer' : 'payee'))
      .sort((a, b) => (a.side === 'any' ? 1 : 0) - (b.side === 'any' ? 1 : 0))
      .map((x) => cellAt(cells, x.i)).find(Boolean)
    const counterparty = fromColumns || counterpartyOf(description)

    const stateRaw = cell(cells, 'state')
    const state = c.state === undefined ? 'COMPLETED' : !stateRaw ? 'UNKNOWN' : readState(stateRaw) ?? opts.states![fold(stateRaw)]
    const bankId = cell(cells, 'id')
    const instantKey = begin.ms !== null ? new Date(begin.ms).toISOString().slice(0, 19) : begin.date
    const reference = cell(cells, 'reference')
    const fp = fingerprint({ instant: instantKey, currency, signed, balance: balance === null ? null : round2(balance), description, reference })

    // The same bank id twice: the same transaction listed twice (read once), or a contradiction (held back).
    if (bankId) {
      const seen = byId.get(bankId)
      if (seen) {
        if (seen.fp === fp) { issues.push({ line, message: `The same transaction ID as line ${seen.line} ("${bankId}"), with the same details: listed twice, read once.` }); continue }
        issues.push({ line, message: `The same transaction ID as line ${seen.line} ("${bankId}") but different details: neither row is read. Check the export.` })
        heldIds.add(bankId)
        continue
      }
      byId.set(bankId, { line, fp })
    }
    prepared.push({
      fp, instantKey, line, date: when.date, startedAt: `${begin.date} ${begin.time}`, direction: way,
      amount: round2(Math.abs(signed)), fee, currency, type: cell(cells, 'type') ? readType(cell(cells, 'type')) : '', state,
      description, counterparty, reference, balance: balance === null ? null : round2(balance), product: cell(cells, 'product'), bankId,
      fileRate: rate?.ok && rate.value > 0 ? rate.value : null,
      original: orig !== null && origCur ? { amount: round2(Math.abs(orig)), currency: origCur } : null,
    })
  }
  // Rows held back for a contradictory id: the first one too.
  for (const p of prepared.filter((x) => x.bankId && heldIds.has(x.bankId))) issues.push({ line: p.line, message: `The same transaction ID ("${p.bankId}") appears again with different details: neither row is read. Check the export.` })
  const kept = prepared.filter((x) => !(x.bankId && heldIds.has(x.bankId)))
  issues.sort((a, b) => a.line - b.line)

  // Identical rows without an id: numbered in order (#2, #3) and marked as twins, so each needs a decision.
  const groups = new Map<string, number>()
  for (const p of kept) if (!p.bankId) groups.set(p.fp, (groups.get(p.fp) ?? 0) + 1)
  const nth = new Map<string, number>()
  txs = kept.map(({ instantKey: _i, ...p }) => {
    const n = p.bankId ? 1 : (nth.get(p.fp) ?? 0) + 1
    if (!p.bankId) nth.set(p.fp, n)
    const fp = n > 1 ? `${p.fp}#${n}` : p.fp
    return { ...p, fp, key: p.bankId ? `rv:id:${p.bankId}` : fp, twins: p.bankId ? 1 : groups.get(p.fp)! }
  })

  // A signed layout where every amount is positive, yet some rows are of kinds that take money out.
  if (c.amount !== undefined && c.direction === undefined && !opts.positivesConfirmed && txs.length > 0 && txs.every((t) => t.direction === 'in') && txs.some((t) => OUT_TYPES.has(t.type))) {
    needs.signs = true
    return { txs: [], issues: [], notes, map, decimal, dateOrder, needs, summary: { ...summaryOf(), read: 0 } }
  }
  return { txs, issues, notes, map, decimal, dateOrder, needs, summary: summaryOf() }
}

/**
 * For the manual mapping only: which column each still-unmapped field *looks* like, from what the
 * column holds (dates, money with both signs, currency codes, states, types, the most varied text).
 * Never applied on its own: the person sees the picks and confirms them. `taken` are columns
 * already mapped by name.
 */
export function suggestColumns(table: CsvTable, taken: Columns): Columns {
  const used = new Set(Object.values(taken))
  const out: Columns = {}
  const sample = table.rows.filter((r) => r.cells.length === table.header.length).slice(0, 60)
  const values = (i: number) => sample.map((r) => (r.cells[i] ?? '').trim()).filter(Boolean)
  const mostly = (vs: string[], test: (v: string) => boolean) => vs.length > 0 && vs.filter(test).length >= Math.ceil(vs.length * 0.9)
  const free = table.header.map((_, i) => i).filter((i) => !used.has(i))
  const give = (f: Field, i: number | undefined) => { if (i !== undefined && taken[f] === undefined && out[f] === undefined) { out[f] = i; used.add(i) } }
  const isDate = (v: string) => !!(parseDateTime(v, 'dmy') ?? parseDateTime(v, 'mdy'))
  const dates = free.filter((i) => mostly(values(i), isDate))
  if (taken.started === undefined && taken.completed === undefined) { give('started', dates[0]); give('completed', dates[1]) }
  give('currency', free.find((i) => !used.has(i) && mostly(values(i), (v) => !!readCurrency(v))))
  give('state', free.find((i) => !used.has(i) && mostly(values(i), (v) => !!readState(v))))
  give('type', free.find((i) => !used.has(i) && mostly(values(i), (v) => TYPE_INDEX.has(fold(v)))))
  const numeric = free.filter((i) => !used.has(i) && mostly(values(i), (v) => decimalEvidence(v) !== null || /^[+\-−(]?\s*\d[\d\s.,']*\)?$/.test(v)))
  const signs = (i: number) => new Set(values(i).map((v) => (/^[-−(]|-$/.test(v.trim()) ? '-' : '+')))
  if (taken.amount === undefined && taken.moneyIn === undefined && taken.moneyOut === undefined) give('amount', numeric.find((i) => signs(i).size === 2))
  const text = free.filter((i) => !used.has(i) && !numeric.includes(i) && values(i).length)
    .sort((a, b) => new Set(values(b)).size - new Set(values(a)).size)
  give('description', text[0])
  return out
}
