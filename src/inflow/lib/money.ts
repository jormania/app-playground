/**
 * Money: rounding, display and the RON conversion.
 *
 * RON is the base. Romanian income is declared in lei at the BNR rate of the
 * day received; the rate offered here comes from the ECB (Frankfurter), which
 * is close but not the BNR figure, so it is only ever a suggestion the user
 * can overwrite. The stored `fxRate` is the source of truth for that record.
 */
import type { Currency } from '../domain/types'

export const BASE: Currency = 'RON'

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function toRon(amount: number, fxRate: number): number {
  return round2((Number(amount) || 0) * (Number(fxRate) || 0))
}

const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const exact = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** "12,450 lei" — whole lei, for dashboards. */
export function lei(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return `${whole.format(Math.round(n))} lei`
}

/** "12.4k" for chart axes and tight spaces. */
export function compact(n: number): string {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `${round1(n / 1_000_000)}M`
  if (a >= 10_000) return `${Math.round(n / 1000)}k`
  if (a >= 1000) return `${round1(n / 1000)}k`
  return String(Math.round(n))
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

/** "€450" / "450 lei" / "1,200 USD" in the record's own currency. */
export function money(amount: number, currency: Currency): string {
  const v = exact.format(amount)
  switch (currency) {
    case 'RON': return `${v} lei`
    case 'EUR': return `€${v}`
    case 'USD': return `$${v}`
    case 'GBP': return `£${v}`
    default: return `${v} ${currency}`
  }
}

export function percent(fraction: number, digits = 0): string {
  if (!Number.isFinite(fraction)) return '—'
  return `${(fraction * 100).toFixed(digits)}%`
}

/**
 * "+12%" / "−8%" / "new" when there was nothing to compare against. Under 1% the figure keeps one
 * decimal ("+0.4%"), so a real change never reads as none; "±0%" only when nothing changed. Below
 * 0.5% the direction stays `flat`, so summaries still call it about the same.
 */
export function delta(current: number, previous: number): { text: string; direction: 'up' | 'down' | 'flat' | 'new' } {
  if (previous <= 0) return current > 0 ? { text: 'new', direction: 'new' } : { text: '—', direction: 'flat' }
  const d = (current - previous) / previous
  if (d === 0) return { text: '±0%', direction: 'flat' }
  const sign = d > 0 ? '+' : '−'
  const pct = Math.abs(d) * 100
  // 0.95% and above rounds to a whole 1%, as larger changes do.
  const text = pct < 0.95 ? `${sign}${pct < 0.05 ? '<0.1' : pct.toFixed(1)}%` : `${sign}${Math.round(pct)}%`
  return { text, direction: Math.abs(d) < 0.005 ? 'flat' : d > 0 ? 'up' : 'down' }
}

/**
 * The ECB reference rate for `currency` → RON on `date` (or the last business
 * day before it). Frankfurter sends CORS headers and needs no key — the same
 * host WhereItWent uses, so no new serverless function.
 */
export async function fetchRonRate(currency: Currency, date: string, fetcher: typeof fetch = fetch): Promise<number | null> {
  if (currency === 'RON') return 1
  const key = `${currency}|${date}`
  try {
    const res = await fetcher(`https://api.frankfurter.dev/v1/${date}?base=${currency}&symbols=RON`)
    if (!res.ok) return cachedRate(key)
    const body = await res.json() as { rates?: { RON?: number } }
    const r = body.rates?.RON
    if (!(typeof r === 'number' && r > 0)) return cachedRate(key)
    const rate = Math.round(r * 10000) / 10000
    rememberRate(key, rate)
    return rate
  } catch {
    // Offline: a rate fetched for that day before still holds; the ECB never revises a published one.
    return cachedRate(key)
  }
}

const FX_CACHE = 'inflow:fx-rates'
function readRates(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(FX_CACHE) ?? '{}') as Record<string, number> } catch { return {} }
}
function cachedRate(key: string): number | null {
  const r = readRates()[key]
  return typeof r === 'number' && r > 0 ? r : null
}
function rememberRate(key: string, rate: number) {
  try {
    // The most recent 300 lookups are plenty; older ones are on the payments themselves.
    const entries = Object.entries({ ...readRates(), [key]: rate }).slice(-300)
    localStorage.setItem(FX_CACHE, JSON.stringify(Object.fromEntries(entries)))
  } catch { /* storage off: the rate is still used, just not kept */ }
}
