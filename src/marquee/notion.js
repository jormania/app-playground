// Notion ⇄ Marquee mapping for the "Marquee — Watched Venues" database
// (Dev → App Databases → Marquee — Watched Venues).
//
// Marquee OWNS this database — unlike Radar-B, which is a guest in a table the
// skill writes. Every column here is the app's to write, and the app is the only
// writer. That is why removing a venue archives its page rather than flagging it:
// there is no other reader to confuse.
//
// Property names are the contract. Change one here, change it in Notion and in
// MARQUEE.md, or in none of them.

import { normalizeVenue, CATEGORIES, AREAS, STATUSES } from './venues.js'

export const PROP = {
  name: 'Name',
  url: 'Programme URL',
  adapter: 'Adapter',
  config: 'Adapter Config',
  status: 'Status',
  category: 'Category Default',
  area: 'Area',
  address: 'Address',
  lastChecked: 'Last Checked',
  lastResult: 'Last Result',
  notes: 'Notes',
}

/** Notion's responses carry `plain_text`; the request shape this module writes
 *  carries `text.content`. Reading both means a value written by `toVenueProps`
 *  can be read straight back without a Notion round trip — which is what makes
 *  the mapping testable end to end instead of only in one direction. */
function plain(prop) {
  const parts = prop?.rich_text ?? prop?.title ?? []
  const text = parts.map((p) => p.plain_text ?? p.text?.content ?? '').join('').trim()
  return text || null
}

function select(prop) {
  const name = prop?.select?.name
  return name ? name.trim().toLowerCase() : null
}

/** Notion rich text has a 2000-character-per-chunk limit; these fields are all
 *  short by nature, so one chunk is always enough — but truncate rather than let
 *  a pasted essay in Notes 400 the whole patch. */
function richText(value) {
  const text = String(value ?? '').trim()
  return text ? [{ type: 'text', text: { content: text.slice(0, 2000) } }] : []
}

function selectOf(value, allowed) {
  const v = value ? String(value).trim().toLowerCase() : null
  return v && allowed.includes(v) ? { name: v } : null
}

export function fromVenuePage(page) {
  const p = page?.properties ?? {}
  return normalizeVenue({
    id: page?.id ?? null,
    name: plain(p[PROP.name]) ?? '',
    url: p[PROP.url]?.url?.trim() ?? '',
    adapter: select(p[PROP.adapter]),
    config: plain(p[PROP.config]),
    status: select(p[PROP.status]),
    category: select(p[PROP.category]),
    area: select(p[PROP.area]),
    address: plain(p[PROP.address]),
    lastChecked: p[PROP.lastChecked]?.date?.start ?? null,
    lastResult: plain(p[PROP.lastResult]),
    notes: plain(p[PROP.notes]),
  })
}

/** Properties for a create or a full update.
 *
 *  `Last Checked` / `Last Result` are deliberately NOT written here: they belong
 *  to a scan, not to editing a venue, and including them would blank a venue's
 *  scan history every time its name was corrected. See `scanResultProps`. */
export function toVenueProps(venue) {
  const v = normalizeVenue(venue)
  return {
    [PROP.name]: { title: richText(v.name) },
    [PROP.url]: { url: v.url || null },
    [PROP.adapter]: { select: selectOf(v.adapter, ['excelsior', 'eventbook', 'filarmonica', 'oveit', 'expirat', 'jsonld', 'unsupported']) },
    [PROP.config]: { rich_text: richText(v.config) },
    [PROP.status]: { select: selectOf(v.status, STATUSES) ?? { name: 'active' } },
    [PROP.category]: { select: selectOf(v.category, CATEGORIES) },
    [PROP.area]: { select: selectOf(v.area, AREAS) },
    [PROP.address]: { rich_text: richText(v.address) },
    [PROP.notes]: { rich_text: richText(v.notes) },
  }
}

/** The narrow patch a pause/resume needs — one column, so a toggle can never
 *  damage the rest of the row. */
export function statusProps(status) {
  return { [PROP.status]: { select: selectOf(status, STATUSES) ?? { name: 'active' } } }
}

/** What a scan writes back, and nothing else. */
export function scanResultProps({ checkedAt, result }) {
  return {
    [PROP.lastChecked]: { date: checkedAt ? { start: checkedAt } : null },
    [PROP.lastResult]: { rich_text: richText(result) },
  }
}
