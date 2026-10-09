import { readJson, writeJson } from '../../shared/storage'
import { PRICES, WEB_SEARCH_PRICE } from '../../shared/models.js'

/**
 * What the curator has cost on this device, from the `usage` Anthropic returns
 * with every response — so a question like "where did the credit go?" has an
 * answer that isn't a guess. Kept per calendar month and model, in
 * localStorage (not the journey's store: it isn't part of the journey, and a
 * fresh start or a restored backup shouldn't touch it). Shown in Settings →
 * About. Estimated from list prices: the Console's figures are the bill.
 */
const KEY = 'long-listen:usage'

export interface Tally {
  requests: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  searches: number
}

type Months = Record<string, Record<string, Tally>>

interface AnthropicUsage {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
  server_tool_use?: { web_search_requests?: number }
}

const empty = (): Tally => ({ requests: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0 })

export function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Add one response's usage. Never throws: accounting must not break a job. */
export function recordUsage(model: string, usage: unknown, now = new Date()): void {
  const u = (usage ?? {}) as AnthropicUsage
  const all = readJson<Months>(KEY, {})
  const month = (all[monthKey(now)] ??= {})
  const t = (month[model] ??= empty())
  t.requests += 1
  t.input += u.input_tokens ?? 0
  t.output += u.output_tokens ?? 0
  t.cacheRead += u.cache_read_input_tokens ?? 0
  t.cacheWrite += u.cache_creation_input_tokens ?? 0
  t.searches += u.server_tool_use?.web_search_requests ?? 0
  // Keep the last twelve months.
  const keep = Object.keys(all).sort().slice(-12)
  writeJson(KEY, Object.fromEntries(keep.map((k) => [k, all[k]])))
}

/** Estimated dollars for a tally on a model; null when the model has no price here. */
export function costOf(model: string, t: Tally): number | null {
  const p = (PRICES as Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }>)[model]
  if (!p) return null
  return (t.input * p.input + t.output * p.output + t.cacheRead * p.cacheRead + t.cacheWrite * p.cacheWrite) / 1_000_000
    + t.searches * WEB_SEARCH_PRICE
}

export interface MonthSummary {
  month: string
  requests: number
  dollars: number
  byModel: { model: string; requests: number; dollars: number | null }[]
}

export function usageSummary(month = monthKey()): MonthSummary {
  const all = readJson<Months>(KEY, {})
  const byModel = Object.entries(all[month] ?? {}).map(([model, t]) => ({ model, requests: t.requests, dollars: costOf(model, t) }))
  return {
    month,
    requests: byModel.reduce((n, m) => n + m.requests, 0),
    dollars: byModel.reduce((n, m) => n + (m.dollars ?? 0), 0),
    byModel,
  }
}
