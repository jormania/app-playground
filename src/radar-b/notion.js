// Notion ⇄ Radar-B model mapping, for both databases Radar-B reads.
//
// Radar-B is overwhelmingly a READER of Notion. It writes exactly two things:
//   1. A new Findings row, when you save an event (see wanderlist.js).
//   2. `Dismissed` / `Dismissed At` on a Radar row — and NOTHING else on it.
//
// (2) is a deliberate, narrow exception to the old "Radar-B never writes Radar"
// rule. Dismissal is *user state*, not event content: it has to survive a phone
// being closed and reappear on the laptop, which localStorage can't do. Those two
// columns are the app's alone — the skill never writes them, and the app never
// touches a content column. Two writers to one table is only dangerous when they
// write the same columns.

import { normalizeEvent } from './model.js'
import { formatTime } from './dates.js'

export const NOTION_VERSION = '2022-06-28'

function plain(prop) {
  if (!prop) return null
  const parts = prop.rich_text ?? prop.title ?? []
  const text = parts.map((p) => p.plain_text ?? '').join('').trim()
  return text || null
}

function select(prop) {
  const name = prop?.select?.name
  return name ? name.trim().toLowerCase() : null
}

function multi(prop) {
  return (prop?.multi_select ?? []).map((o) => o.name.trim().toLowerCase())
}

function url(prop) {
  return prop?.url?.trim() || null
}

function number(prop) {
  return typeof prop?.number === 'number' ? prop.number : null
}

function checkbox(prop) {
  return prop?.checkbox === true
}

function dateStart(prop) {
  return prop?.date?.start ?? null
}

function hasFiles(prop) {
  return (prop?.files ?? []).length > 0
}

/** Split a Notion date `start` into a bare day key + optional 'HH:MM'.
 *
 *  The time is read as a LOCAL wall clock, not sliced out of the string. Notion
 *  preserves whatever offset a value was written with, so the same 19:00 concert
 *  can come back as `…T19:00:00.000+03:00` or as `…T16:00:00.000Z` depending on
 *  who wrote the row — and slicing characters 11–16 turns the second one into a
 *  16:00 concert. `formatTime` is what the WHEN row already uses for the event's
 *  own start, so going through it also makes the two times on screen agree by
 *  construction instead of by both happening to be +03:00. */
export function splitStart(start) {
  if (!start) return { date: null, time: null }
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(start))
  if (!m) return { date: null, time: null }
  if (!hasTimeOf(start)) return { date: m[1], time: null }
  const d = new Date(start)
  // A local render can cross midnight relative to the stored day — the day key
  // has to come from the same instant as the time, or a 00:30 event lands on the
  // wrong date.
  if (Number.isNaN(d.getTime())) return { date: m[1], time: null }
  const localDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { date: localDay, time: formatTime(start) }
}

/** Notion writes a bare `YYYY-MM-DD` when no time is set and a full ISO datetime
 *  when one is. That single character difference is the whole "do we know the
 *  time" question — never infer a time from a bare date. */
export function hasTimeOf(start) {
  return Boolean(start && String(start).length > 10)
}

/** `Sources` is stored as plain text, one mention per line:
 *      Curatorial │ https://… │ 2026-07-31
 *  Deliberately not a relation: it has to be writable by a skill in one property
 *  patch, readable by a human editing the page directly, and tolerant of a
 *  half-filled line. A `*` prefix marks a mention that is a RECOMMENDATION rather
 *  than a passing reference. */
export function parseSources(text) {
  if (!text) return []
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const recommended = line.startsWith('*')
      const parts = (recommended ? line.slice(1) : line).split(/\s*[│|]\s*/)
      const [name, href, date] = parts
      if (!name) return null
      return {
        name: name.trim(),
        url: href && /^https?:\/\//i.test(href.trim()) ? href.trim() : null,
        date: date && /^\d{4}-\d{2}-\d{2}/.test(date.trim()) ? date.trim().slice(0, 10) : null,
        kind: recommended ? 'recommendation' : 'editorial',
      }
    })
    .filter(Boolean)
}

export function fromRadarPage(page) {
  const p = page.properties ?? {}
  const start = dateStart(p.When)
  const sources = parseSources(plain(p.Sources))
  const signals = multi(p.Signals)
  // A row whose Sources carry a recommendation IS recommended — the signal and the
  // provenance can't be allowed to disagree just because one was filled in by hand.
  if (sources.some((s) => s.kind === 'recommendation') && !signals.includes('recommended')) {
    signals.push('recommended')
  }
  return normalizeEvent({
    id: page.id,
    key: plain(p.Key),
    name: plain(p.Name) ?? '(fără titlu)',
    start,
    end: p.When?.date?.end ?? null,
    hasTime: hasTimeOf(start),
    venue: plain(p.Venue),
    address: plain(p.Address),
    area: select(p.Area),
    category: select(p.Category),
    summary: plain(p.Summary),
    signals,
    cost: number(p.Cost),
    link: url(p.Link),
    tickets: url(p.Tickets),
    image: url(p.Image) ?? firstFileUrl(p.Image),
    organizer: plain(p.Organizer),
    sources,
    confidence: select(p.Confidence) ?? 'reported',
    checked: dateStart(p.Checked),
    origin: 'radar',
    dismissed: checkbox(p.Dismissed),
    dismissedAt: dateStart(p['Dismissed At']),
  })
}

function firstFileUrl(prop) {
  const file = (prop?.files ?? [])[0]
  return file?.external?.url ?? file?.file?.url ?? null
}

/** Wanderlist's Findings rows, read so Radar-B can tell what's already saved and
 *  never offer the same thing twice. Mapped into the SAME event shape, so a saved
 *  item takes part in dedupe as just another mention of an event. */
export function fromFindingsPage(page) {
  const p = page.properties ?? {}
  const planned = splitStart(dateStart(p['Planned Date']))
  const expiring = dateStart(p['Date Expiring'])
  const start = dateStart(p['Planned Date']) ?? expiring
  return normalizeEvent({
    id: page.id,
    name: plain(p.Name) ?? '(fără titlu)',
    start,
    hasTime: hasTimeOf(start),
    // `Place` in Findings is one field holding venue AND street AND city. It is
    // NOT split here into venue + address: doing so would render the same string
    // twice in the detail view. The venue is the whole of what we know.
    venue: plain(p.Place),
    address: null,
    category: select(p.Category),
    summary: plain(p.Description),
    signals: multi(p.Tags).filter((t) => ['free', 'ticketed', 'outdoor'].includes(t)),
    cost: number(p.Cost),
    link: url(p.Link),
    sources: [{ name: 'Wanderlist', url: page.url ?? null, date: dateStart(p['Date Added']), kind: 'saved' }],
    confidence: 'reported',
    checked: dateStart(p['Date Added']),
    origin: 'wanderlist',
    saved: true,
    // The decisions already made in Wanderlist, carried so Radar-B can show them
    // instead of sending you to another app for your own answer.
    attended: checkbox(p.Attended),
    going: checkbox(p.Going),
    plannedDate: planned.date,
    plannedTime: planned.time,
    dateExpiring: expiring,
    hasTickets: hasFiles(p.Tickets),
  })
}

/** The two user-state columns Radar-B is allowed to write on a Radar row, and
 *  nothing else — see this file's header. `null` clears the date when undoing. */
export function dismissalProps(dismissed, today = new Date()) {
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return {
    Dismissed: { checkbox: Boolean(dismissed) },
    'Dismissed At': { date: dismissed ? { start: iso } : null },
  }
}

/** The 🗓️ Suggested events page, kept in place and read for what it uniquely has:
 *  which SOURCE ARTICLES fed the current refresh. Radar-B shows these as the
 *  "where this week came from" line — the article-level provenance that the
 *  event-level Radar rows point back to. */
export function parseSuggestedPage(blocks) {
  const links = []
  let refreshedAt = null
  for (const block of blocks) {
    if (block.type === 'heading_2') {
      const text = (block.heading_2?.rich_text ?? []).map((t) => t.plain_text).join('').trim()
      if (text && !refreshedAt) refreshedAt = text // e.g. "31 iulie 2026"
    }
    const rows = block.type === 'table_row' ? [block.table_row] : []
    for (const row of rows) {
      const cells = (row.cells ?? []).map((cell) => cell.map((t) => t.plain_text).join('').trim())
      const href = (row.cells ?? []).flat().map((t) => t.href).find(Boolean)
      const [source, title] = cells
      if (!source || source.toLowerCase() === 'sursă') continue
      const pending = /nepublicat/i.test(title ?? '')
      links.push({ source: source.replace(/\*/g, '').trim(), title: title ?? '', url: href ?? null, pending })
    }
  }
  return { refreshedAt, links }
}

