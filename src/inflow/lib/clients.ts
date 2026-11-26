/**
 * Which clients the picker offers, so years of one-off 1:1 clients never crowd it.
 *
 *  - Typing searches everyone not archived, quiet clients included, by the start of
 *    any word of the name, accents ignored ("ana" finds "Ana" and "Mihai & Ana").
 *  - With nothing typed: the clients paid most recently, then your businesses.
 *    Businesses come back over and over; individuals are reached by searching.
 *  - An individual with no payment for twelve months is "quiet": left out of the
 *    empty-box list, still found by a search, back as soon as they pay again.
 *    Nothing is hidden from reports and nothing is deleted.
 */
import type { Client, IncomeRecord } from '../domain/types'
import { addMonths } from './dates'

export const QUIET_AFTER_MONTHS = 12
const RECENT = 5
const SHOWN = 8

export interface ClientOption {
  client: Client
  /** Last payment received; null if none yet. */
  last: string | null
  quiet: boolean
}

/** Lowercase, accents and punctuation folded: "Ștefan-Andrei" → "stefan andrei". */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function clientOptions(clients: Client[], records: IncomeRecord[], today: string, includeArchived = false): ClientOption[] {
  const last = new Map<string, string>()
  // Paid means received: an invoice still expected (even one dated ahead) isn't a payment yet.
  for (const r of records) if (r.clientId && r.status === 'received' && r.date > (last.get(r.clientId) ?? '')) last.set(r.clientId, r.date)
  const cutoff = addMonths(today, -QUIET_AFTER_MONTHS)
  // Filters and statements reach archived clients too: their history is still there.
  return clients.filter((c) => includeArchived || !c.archived).map((c) => {
    const l = last.get(c.id) ?? null
    // A business stays on hand; so does a person added but not yet paid.
    return { client: c, last: l, quiet: c.kind === 'individual' && l !== null && l < cutoff }
  })
}

export interface ClientSuggestions {
  /** With nothing typed: recent first, then businesses. While typing: the matches. */
  recent: ClientOption[]
  businesses: ClientOption[]
  matches: ClientOption[]
  /** Typed text that matches no name exactly: offered as a new client. */
  addName: string | null
}

export function suggestClients(options: ClientOption[], query: string): ClientSuggestions {
  const q = fold(query)
  const byRecency = (a: ClientOption, b: ClientOption) => (b.last ?? '').localeCompare(a.last ?? '') || a.client.name.localeCompare(b.client.name)
  if (!q) {
    const recent = options.filter((o) => o.last && !o.quiet).sort(byRecency).slice(0, RECENT)
    const taken = new Set(recent.map((o) => o.client.id))
    const businesses = options.filter((o) => o.client.kind === 'business' && !taken.has(o.client.id))
      .sort((a, b) => a.client.name.localeCompare(b.client.name))
    return { recent, businesses, matches: [], addName: null }
  }
  const words = q.split(' ')
  const hits = options.filter((o) => {
    const name = fold(o.client.name)
    // Each typed word starts a word of the name: "an" finds Ana and Andreea, not Bank or Coachlane.
    return words.every((w) => name.split(' ').some((part) => part.startsWith(w)))
  })
  // Names that start with what was typed first, then the most recently paid.
  const starts = (o: ClientOption) => (fold(o.client.name).startsWith(q) ? 0 : 1)
  const matches = hits.sort((a, b) => starts(a) - starts(b) || byRecency(a, b)).slice(0, SHOWN)
  const exact = options.some((o) => fold(o.client.name) === q)
  return { recent: [], businesses: [], matches, addName: exact ? null : query.trim() }
}
