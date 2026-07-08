// Pure mapping between Notion's wire shapes and Wanderlist's clean app model.
// No network, no React — the part that gets the heaviest test coverage, mirroring
// Journal of Delights' notion.js. Wanderlist reads/writes the "Findings" database
// (see WANDERLIST.md): a backlog of city things-to-do you triage and check off.
//
// App model for one item:
//   { id, name, description, link, category, place, placeUrl, tags[], attended,
//     dateAdded, dateExpiring, plannedDate, photo, tickets[], pending? }
// where `plannedDate` is the day you plan to go (drives the calendar's Planned marker),
// `dateExpiring` is the deadline to act (the Expiring marker), `photo` is
// `{ url, name } | null` (at most one picture, managed out of band via notionClient's
// uploadFile/attachPhoto/removePhoto rather than toNotionProps — same pattern as Journal
// of Delights), and `tickets` is `{ url, name, fileUploadId }[]` — ticket files/screenshots,
// also managed out of band via notionClient's setTickets.
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

// Casing convention for the two select-y fields, enforced on both read and write so a
// mixed-case value from before this rule (or typed straight into Notion) still displays and
// re-saves normalized: both always lowercase, for consistency (and so Tags/Category never
// fork "Free" from "free" as separate filter keys).
function normalizeTag(name) {
  return String(name || '').trim().toLowerCase()
}
const normalizeCategory = normalizeTag

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
    category: props.Category?.select?.name ? normalizeCategory(props.Category.select.name) : null,
    place: richTextToPlain(props.Place?.rich_text),
    placeUrl: props.Map?.url ?? '',
    tags: (props.Tags?.multi_select ?? []).map(o => normalizeTag(o.name)),
    attended: Boolean(props.Attended?.checkbox),
    dateAdded: props['Date Added']?.date?.start ?? null,
    dateExpiring: props['Date Expiring']?.date?.start ?? null,
    plannedDate: props['Planned Date']?.date?.start ?? null,
    photo: toPhoto(props.Photo?.files),
    tickets: toTickets(props.Tickets?.files),
  }
}

// The Photo property is Files & media, but the app enforces "at most one picture" — so we
// only ever look at (or write) a single-element array. Notion-hosted files carry a signed
// `file.url` that expires roughly an hour after issue; we don't cache it, just re-read it
// on every fresh query (same as Journal of Delights).
function toPhoto(files) {
  const f = Array.isArray(files) ? files[0] : null
  if (!f) return null
  const url = f.file?.url ?? f.external?.url ?? null
  if (!url) return null
  return { url, name: f.name ?? null }
}

// Tickets is Files & media, multi-valued. `fileUploadId`, when present, is the durable
// handle Notion's 2025-09-03 File Upload API exposes for files attached via file_upload —
// it's what lets setTickets() below re-include an existing ticket in a later write without
// re-uploading its bytes. Files attached any other way (or on an older API surface) simply
// won't carry one; setTickets() falls back to their current signed url for those.
function toTickets(files) {
  if (!Array.isArray(files)) return []
  return files.map(f => ({
    url: f.file?.url ?? f.external?.url ?? null,
    name: f.name ?? 'ticket',
    fileUploadId: f.file_upload?.id ?? null,
  })).filter(t => t.url)
}

// Build one Tickets-array write entry for a ticket already known to the app (existing,
// possibly re-included, or freshly uploaded). Prefers the durable file_upload id; falls
// back to the ticket's current signed url as an `external` reference when no id is known
// (rare — e.g. a file attached outside Wanderlist). That fallback is only safe within the
// same short window the url was fetched in, which is exactly how setTickets() uses it:
// always reconstructed from data just read, never carried across sessions. Pure + exported
// so the write shape is unit-testable without a network call.
export function ticketWriteEntry(ticket) {
  const name = ticket?.name || 'ticket'
  if (ticket?.fileUploadId) return { type: 'file_upload', file_upload: { id: ticket.fileUploadId }, name }
  return { type: 'external', name, external: { url: ticket.url } }
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
    Category: { select: e.category ? { name: normalizeCategory(e.category) } : null },
    Place: { rich_text: plainToRichText(e.place) },
    Map: { url: e.placeUrl ? String(e.placeUrl) : null },
    Tags: { multi_select: [...new Set((e.tags ?? []).map(normalizeTag).filter(Boolean))].map(name => ({ name })) },
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
