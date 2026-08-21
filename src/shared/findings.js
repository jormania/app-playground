// The Findings schema — the ONE definition of Wanderlist's Notion database,
// shared by the two apps that write to it.
//
// Promoted out of src/wanderlist/notion.js when Radar-B became the second writer.
// Wanderlist re-exports every symbol below from its own notion.js, so its import
// paths and its existing notion.test.js coverage are unchanged — that test suite
// is the proof this move was behaviour-preserving.
//
// Why share rather than copy: Radar-B's whole "discover → save" handoff writes a
// Findings row, and a second, independently-maintained copy of these property
// names is a schema drift waiting to happen. One of the two apps would eventually
// write `Tags: ["Free"]` where the other writes `["free"]` and the filter chips
// would quietly fork. The schema lives here now; both apps read it from one place.
//
// Property names and types are documented in WANDERLIST.md and in the `wanderlist`
// skill. Change them in all three, or in none.

/** Gabriel's live Findings database — the built-in default for both apps. */
export const FINDINGS_DATABASE_ID = '41c42bc4dfb543f49051810b3c5880fe'

/** The closed `Category` vocabulary. Single-select; only propose a new value
 *  deliberately (see the wanderlist skill's intake rules). */
export const FINDINGS_CATEGORIES = ['event', 'discovery', 'venue', 'idea', 'culture', 'movie', 'art', 'play', 'concert']

/** The established `Tags` vocabulary. New tags should be rare. */
export const FINDINGS_TAGS = ['free', 'ticketed', 'outdoor', 'indoor', 'with-friends', 'solo', 'music', 'walk', 'food', 'nightlife', 'history', 'expo', 'beach']

/** Notion caps a single rich_text object's `content` at 2000 characters, so any
 *  long text we WRITE (Description) is split into <=2000-char chunks; reading is
 *  the reverse (concatenate). */
export const RICH_TEXT_LIMIT = 2000

/** Join an array of Notion rich_text objects back into one plain string. */
export function richTextToPlain(richText) {
  if (!Array.isArray(richText)) return ''
  return richText.map(rt => (rt && rt.plain_text != null ? rt.plain_text : (rt?.text?.content ?? ''))).join('')
}

/** Split a plain string into Notion rich_text objects, none exceeding the limit.
 *  Empty string -> [] (Notion clears the property). */
export function plainToRichText(text, limit = RICH_TEXT_LIMIT) {
  const str = text == null ? '' : String(text)
  if (str.length === 0) return []
  const chunks = []
  for (let i = 0; i < str.length; i += limit) {
    chunks.push({ text: { content: str.slice(i, i + limit) } })
  }
  return chunks
}

/** Casing convention for the two select-y fields, enforced on both read and write
 *  so a mixed-case value (from before this rule, or typed straight into Notion)
 *  still displays and re-saves normalized — and so Tags/Category never fork
 *  "Free" from "free" into two separate filter keys. */
export function normalizeTag(name) {
  return String(name || '').trim().toLowerCase()
}
export const normalizeCategory = normalizeTag

/** This browser's current UTC offset as "+03:00" / "-05:00" — appended to a
 *  Planned Date + time when writing it to Notion, so the stored instant matches
 *  the wall-clock time actually picked. getTimezoneOffset() returns minutes WEST
 *  of UTC (positive west); the conventional ISO sign is east-positive, hence the
 *  negation. */
export function localOffsetString(date = new Date()) {
  const totalMin = -date.getTimezoneOffset()
  const sign = totalMin >= 0 ? '+' : '-'
  const abs = Math.abs(totalMin)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `${sign}${hh}:${mm}`
}

/** Combine a day key + optional 'HH:MM' into what Notion's date property expects:
 *  a bare day key with no time, or a full ISO datetime with this browser's offset. */
export function combinePlannedStart(date, time) {
  if (!date) return null
  if (!time) return date
  return `${date}T${time}:00${localOffsetString()}`
}

/** Split a Notion date property's `start` back into a day key + optional 'HH:MM'. */
export function splitPlannedStart(start) {
  if (!start) return { date: null, time: null }
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(start)
  if (!m) return { date: null, time: null }
  return { date: m[1], time: m[2] || null }
}

/**
 * Build the `properties` payload for a Findings create/update call.
 *
 * Never writes formula or read-only props. A null clears the property in Notion;
 * empty string / empty array do too, for their respective types.
 *
 * The entry shape is Wanderlist's app model:
 *   { name, description, link, category, place, placeUrl, tags[], attended, going,
 *     cost, dateAdded, dateExpiring, plannedDate, plannedTime }
 * Photo and Tickets are deliberately absent — they're file properties, written out
 * of band through the upload endpoints rather than through this payload.
 */
export function toFindingsProps(entry) {
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
    Going: { checkbox: Boolean(e.going) },
    // Cost is an optional number (Romanian lei). A blank/absent cost clears the
    // property; never write NaN (a non-numeric string slipping through) — treat
    // that as "no cost".
    Cost: { number: e.cost === '' || e.cost == null || Number.isNaN(Number(e.cost)) ? null : Number(e.cost) },
    'Date Added': { date: e.dateAdded ? { start: e.dateAdded } : null },
    'Date Expiring': { date: e.dateExpiring ? { start: e.dateExpiring } : null },
    'Planned Date': { date: e.plannedDate ? { start: combinePlannedStart(e.plannedDate, e.plannedTime) } : null },
  }
}
