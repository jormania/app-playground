// The venue model, and every rule Settings enforces about it.
//
// A venue is three decisions: WHERE to look (Programme URL), WHO reads it
// (Adapter), and WHETHER to look at all right now (Status). Everything else on
// the row is presentation or carried through to a Wanderlist save.
//
// Pure — no Notion, no React, no fetch. notion.js maps this shape to and from
// Notion rows; SettingsPanel.jsx drives these functions from the UI.

import { matchAdapter, getAdapter, parseUrl } from './adapters.js'

/** Wanderlist's closed Category vocabulary, narrowed to what a venue can be.
 *  Must stay a subset of the real one — a save has to be lossless. */
export const CATEGORIES = ['play', 'movie', 'concert', 'event', 'art', 'culture']
export const AREAS = ['centru', 'cotroceni', 'floreasca', 'dorobanti', 'tineretului', 'carol']
export const STATUSES = ['active', 'paused']

export const DEFAULT_CATEGORY = 'event'

/** Fill in the optional half of a venue so the rest of the app never has to
 *  guard for it. `id` is the Notion page id and is absent for a draft. */
export function normalizeVenue(raw = {}) {
  const status = STATUSES.includes(raw.status) ? raw.status : 'active'
  return {
    id: raw.id ?? null,
    name: String(raw.name ?? '').trim(),
    url: String(raw.url ?? '').trim(),
    adapter: raw.adapter ?? null,
    config: raw.config ?? null,
    status,
    category: CATEGORIES.includes(raw.category) ? raw.category : DEFAULT_CATEGORY,
    area: AREAS.includes(raw.area) ? raw.area : null,
    address: raw.address ?? null,
    lastChecked: raw.lastChecked ?? null,
    lastResult: raw.lastResult ?? null,
    notes: raw.notes ?? null,
  }
}

export function isActive(venue) {
  return normalizeVenue(venue).status === 'active'
}

/** The venues a scan should actually fetch. Pausing is the whole point of this
 *  function: a paused venue keeps its row, its notes and its place in the list,
 *  and is simply not asked for. */
export function scannable(venues) {
  return (venues ?? []).filter((v) => isActive(v) && v.url && v.adapter && v.adapter !== 'unsupported')
}

export function togglePaused(venue) {
  return { ...normalizeVenue(venue), status: isActive(venue) ? 'paused' : 'active' }
}

/** Alphabetical by name, Romanian collation (so Ț sorts as T, not after Z).
 *
 *  Paused venues stay in place rather than sinking to the bottom: the list is
 *  short and you look things up in it by name, so a stable A–Z beats a status
 *  grouping that moves a venue the moment you pause it. Paused rows are still
 *  obvious — dimmed, with a chip. */
export function sortVenues(venues) {
  return [...(venues ?? [])].sort((a, b) =>
    String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ro'))
}

/** Two URLs point at the same programme if they differ only in scheme, `www.`,
 *  a trailing slash or the query string's order. Used to refuse a duplicate. */
export function sameProgramme(a, b) {
  const ua = parseUrl(a)
  const ub = parseUrl(b)
  if (!ua || !ub) return false
  const key = (u) =>
    `${u.hostname.toLowerCase().replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}${[...u.searchParams].sort().map(([k, v]) => `${k}=${v}`).join('&')}`
  return key(ua) === key(ub)
}

/**
 * Everything Settings needs to decide whether "Add" may proceed, in one call.
 *
 * Returns `{ ok, venue, problems, warnings }`. `problems` block the add;
 * `warnings` don't — they are the honest caveats (see MARQUEE.md §8): a venue
 * with no built-in adapter can still be added against the generic JSON-LD
 * reader, but the user is told it may find nothing until an adapter is written.
 *
 * Each problem carries the `field` it belongs to, so the form can put it under
 * the input that caused it. That used to be inferred from the message text, and
 * "already watches that page" duly matched the pattern meant for the URL field.
 * Say which field you mean; don't ask a regex to guess.
 */
export function validateVenue(draft, existing = []) {
  const venue = normalizeVenue(draft)
  const problems = []
  const warnings = []
  const fail = (field, message) => problems.push({ field, message })

  if (!venue.name) fail('name', 'Give the venue a name.')

  const url = parseUrl(venue.url)
  if (!venue.url) fail('url', 'Paste the venue’s programme page URL.')
  else if (!url) fail('url', 'That doesn’t look like a URL.')
  else if (url.protocol !== 'https:') warnings.push('This page is served over plain HTTP.')

  const clash = existing.find((v) => v.id !== venue.id && sameProgramme(v.url, venue.url))
  if (clash) fail('url', `${clash.name} already watches that page.`)

  // The adapter is resolved from the URL, never typed. An explicit choice on the
  // draft wins only when it names a real adapter — a stale id from an edited
  // Notion row must not silently become the parser.
  const matched = url ? matchAdapter(venue.url) : null
  const explicit = venue.adapter && venue.adapter !== 'unsupported' ? getAdapter(venue.adapter) : null
  const resolved = matched ?? (explicit ? { adapter: explicit.id, config: venue.config, rung: explicit.rung, label: explicit.label } : null)

  if (resolved) {
    venue.adapter = resolved.adapter
    venue.config = resolved.config ?? null
  } else if (url) {
    venue.adapter = 'jsonld'
    venue.config = null
    warnings.push(
      'No built-in reader for this site. Marquee will try the generic schema.org reader; if the page doesn’t publish structured events, this venue needs a small adapter written before it can be scanned.',
    )
  }

  return {
    ok: problems.length === 0,
    venue,
    problems,
    warnings,
    matched: Boolean(matched),
    /** The first problem on one field, for that field's error slot. */
    problemFor: (field) => problems.find((p) => p.field === field)?.message,
  }
}

/** A best-effort venue name from the URL, so the name field starts filled in.
 *  `eventbook.ro/hall/cinema-union` → `Cinema Union`. */
export function suggestName(rawUrl) {
  const url = parseUrl(rawUrl)
  if (!url) return ''
  const matched = matchAdapter(rawUrl)
  const slug = matched?.config ?? url.pathname.split('/').filter(Boolean).pop() ?? ''
  if (slug && /[a-z]/i.test(slug)) {
    return slug
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim()
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '').split('.')[0]
  return host.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
