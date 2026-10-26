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

/**
 * What each request was for, by job, in its own key so the tally by model keeps
 * its shape. Kept as requests and estimated dollars: the job's model is
 * already counted above.
 */
const OPS_KEY = 'long-listen:usage:ops'
type OpMonths = Record<string, Record<string, { requests: number; dollars: number }>>

/** The primary things the curator is asked for, each job under one of them. */
export const CATEGORIES: { label: string; ops: string[] }[] = [
  { label: 'Directions and programmes', ops: ['themes', 'programme', 'sketch'] },
  { label: 'Notes on the music', ops: ['explain', 'compare', 'companion', 'tags', 'define', 'portrait', 'season'] },
  { label: 'Further reading', ops: ['resources'] },
  { label: 'Concerts', ops: ['concert', 'prepare'] },
  { label: 'Learning your taste', ops: ['taste', 'continuity'] },
]
const OTHER = 'Other (key tests)'

export function categoryOf(op: string): string {
  return CATEGORIES.find((c) => c.ops.includes(op))?.label ?? OTHER
}

const keepTwelve = <T>(all: Record<string, T>) => Object.fromEntries(Object.keys(all).sort().slice(-12).map((k) => [k, all[k]]))

/** Add one response's usage, and what it was for. Never throws: accounting must not break a job. */
export function recordUsage(model: string, usage: unknown, now = new Date(), op?: string): void {
  const u = (usage ?? {}) as AnthropicUsage
  const one: Tally = {
    requests: 1,
    input: u.input_tokens ?? 0,
    output: u.output_tokens ?? 0,
    cacheRead: u.cache_read_input_tokens ?? 0,
    cacheWrite: u.cache_creation_input_tokens ?? 0,
    searches: u.server_tool_use?.web_search_requests ?? 0,
  }
  const all = readJson<Months>(KEY, {})
  const month = (all[monthKey(now)] ??= {})
  const t = (month[model] ??= empty())
  for (const k of Object.keys(one) as (keyof Tally)[]) t[k] += one[k]
  // Keep the last twelve months.
  writeJson(KEY, keepTwelve(all))
  if (!op) return
  const ops = readJson<OpMonths>(OPS_KEY, {})
  const o = ((ops[monthKey(now)] ??= {})[op] ??= { requests: 0, dollars: 0 })
  o.requests += 1
  o.dollars += costOf(model, one) ?? 0
  writeJson(OPS_KEY, keepTwelve(ops))
}

/** Estimated dollars for a tally on a model; null when the model has no price here. */
export function costOf(model: string, t: Tally): number | null {
  const p = (PRICES as Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }>)[model]
  if (!p) return null
  return (t.input * p.input + t.output * p.output + t.cacheRead * p.cacheRead + t.cacheWrite * p.cacheWrite) / 1_000_000
    + t.searches * WEB_SEARCH_PRICE
}

/** A model id as a person reads it: family and version, as in "Sonnet 5.5". */
export function modelLabel(model: string): string {
  const m = /^claude-([a-z]+)-(\d+(?:-\d+)*)/.exec(model)
  if (!m) return model
  return `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2].replace(/-/g, '.')}`
}

export interface MonthSummary {
  month: string
  requests: number
  dollars: number
  byModel: { model: string; requests: number; dollars: number | null }[]
  /**
   * The same month by what it was for, dearest first. Requests made before
   * jobs were counted (26 October 2026) appear as one "Earlier" line, so the
   * parts always add up to the total.
   */
  byCategory: { label: string; requests: number; dollars: number }[]
}

export function usageSummary(month = monthKey()): MonthSummary {
  const all = readJson<Months>(KEY, {})
  const byModel = Object.entries(all[month] ?? {})
    .map(([model, t]) => ({ model, requests: t.requests, dollars: costOf(model, t) }))
    .sort((a, b) => (b.dollars ?? 0) - (a.dollars ?? 0))
  const requests = byModel.reduce((n, m) => n + m.requests, 0)
  const dollars = byModel.reduce((n, m) => n + (m.dollars ?? 0), 0)
  const grouped = new Map<string, { label: string; requests: number; dollars: number }>()
  for (const [op, o] of Object.entries(readJson<OpMonths>(OPS_KEY, {})[month] ?? {})) {
    const label = categoryOf(op)
    const g = grouped.get(label) ?? { label, requests: 0, dollars: 0 }
    g.requests += o.requests
    g.dollars += o.dollars
    grouped.set(label, g)
  }
  const byCategory = [...grouped.values()].sort((a, b) => b.dollars - a.dollars)
  const earlier = requests - byCategory.reduce((n, c) => n + c.requests, 0)
  if (earlier > 0) byCategory.push({ label: 'Earlier, before it was counted by job', requests: earlier, dollars: Math.max(0, dollars - byCategory.reduce((n, c) => n + c.dollars, 0)) })
  return { month, requests, dollars, byModel, byCategory }
}
