// Pure mapping between Notion's wire shapes and Wanderlist's clean app model.
// No network, no React — the part that gets the heaviest test coverage, mirroring
// Journal of Delights' notion.js. Wanderlist reads/writes the "Findings" database
// (see WANDERLIST.md): a backlog of city things-to-do you triage and check off.
//
// App model for one item:
//   { id, name, description, link, category, place, placeUrl, tags[], attended,
//     dateAdded, dateExpiring, plannedDate, pending? }
// where `plannedDate` is the day you plan to go (drives the calendar's Planned marker) and
// `dateExpiring` is the deadline to act (the Expiring marker).
// where every date is a 'YYYY-MM-DD' string | null, `category` is a single string
// | null, `place` is a resolved place name string, `placeUrl` is a Maps link, and
// `tags` is a freeform multi-select.

// Notion caps a single rich_text object's `content` at 2000 characters, so any long
// text we WRITE (Description) is split into a sequence of <=2000-char chunks; reading
// is the reverse (concatenate). Identical to JoD — kept here so the app is standalone.
export const RICH_TEXT_LIMIT = 2000

// Join an array of Notion rich_text objects back into one plain string.
export function richTextToPlain(richText) {
  if (!Array.isArray(richText)) return ''
  return richText.map(rt => (rt && rt.plain_text != null ? rt.plain_text : (rt?.text?.content ?? ''))).join('')
}

// Split a plain string into Notion rich_text objects, none exceeding RICH_TEXT_LIMIT.
// Empty string -> [] (Notion clears the property).
export function plainToRichText(text, limit = RICH_TEXT_LIMIT) {
  const str = text == null ? '' : String(text)
  if (str.length === 0) return []
  const chunks = []
  for (let i = 0; i < str.length; i += limit) {
    chunks.push({ text: { content: str.slice(i, i + limit) } })
  }
  return chunks
}

// Read a Notion page object into our app model. Defensive throughout: a property can
// be missing or a different type if the schema drifts, and we'd rather render a
// half-empty item than throw on the whole list.
export function toEntry(page) {
  const props = (page && page.properties) || {}
  const titleProp = props.Name || props.Title || {}
  return {
    id: page?.id ?? null,
    name: richTextToPlain(titleProp.title),
    description: richTextToPlain(props.Description?.rich_text),
    link: props.Link?.url ?? '',
    category: props.Category?.select?.name ?? null,
    place: richTextToPlain(props.Place?.rich_text),
    placeUrl: props.Map?.url ?? '',
    tags: (props.Tags?.multi_select ?? []).map(o => o.name),
    attended: Boolean(props.Attended?.checkbox),
    dateAdded: props['Date Added']?.date?.start ?? null,
    dateExpiring: props['Date Expiring']?.date?.start ?? null,
    plannedDate: props['Planned Date']?.date?.start ?? null,
  }
}

// Build the `properties` payload for a create/update call. We never write formula or
// read-only props. A null clears the property in Notion; empty string / empty array
// do too, for their respective types.
export function toNotionProps(entry) {
  const e = entry || {}
  return {
    Name: { title: plainToRichText(e.name) },
    Description: { rich_text: plainToRichText(e.description) },
    Link: { url: e.link ? String(e.link) : null },
    Category: { select: e.category ? { name: e.category } : null },
    Place: { rich_text: plainToRichText(e.place) },
    Map: { url: e.placeUrl ? String(e.placeUrl) : null },
    Tags: { multi_select: (e.tags ?? []).map(name => ({ name })) },
    Attended: { checkbox: Boolean(e.attended) },
    'Date Added': { date: e.dateAdded ? { start: e.dateAdded } : null },
    'Date Expiring': { date: e.dateExpiring ? { start: e.dateExpiring } : null },
    'Planned Date': { date: e.plannedDate ? { start: e.plannedDate } : null },
  }
}

// Pull a Notion database/page id out of whatever a user pastes: a full URL, a bare
// 32-char id, or a dashed UUID. Returns the compact 32-char id, or '' if nothing
// id-shaped is present. (Same parser as JoD — the id is the trailing 32 hex chars,
// bounded by the '-'/'/' that separates it from the slug.)
export function parseNotionId(input) {
  if (!input) return ''
  const s = String(input).trim()
  const uuid = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  if (uuid) return uuid[0].replace(/-/g, '').toLowerCase()
  const path = s.split(/[?#]/)[0]
  if (/^[0-9a-f]{32}$/i.test(path)) return path.toLowerCase()
  const m = path.match(/[-/]([0-9a-f]{32})\/?$/i)
  return m ? m[1].toLowerCase() : ''
}

// Unique, order-preserving option values pulled from a list of items — used to
// suggest existing Category / Place / Tags values inline without a closed list.
// `field` is 'tags' (array) or a scalar field like 'category' / 'place'.
export function collectOptions(entries, field) {
  const seen = new Set()
  const out = []
  for (const e of entries || []) {
    const raw = e?.[field]
    const values = Array.isArray(raw) ? raw : (raw ? [raw] : [])
    for (const name of values) {
      if (name && !seen.has(name)) { seen.add(name); out.push(name) }
    }
  }
  return out
}
