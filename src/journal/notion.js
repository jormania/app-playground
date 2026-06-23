// Pure mapping between Notion's wire shapes and our clean app model.
// No network, no React — this is the part that gets the heaviest test coverage,
// the same way Touch Grass keeps its logic in plain modules (moments.js, place.js).
//
// App model for one entry:
//   { id, title, date, tags[], people[], entry, wordCount }
// where `date` is a 'YYYY-MM-DD' string, `entry` is the plain essayette text,
// and `wordCount` is Notion's read-only formula value (null until saved).

// Notion caps a single rich_text object's `content` at 2000 characters. A 500-word
// essayette runs past that, so any text we WRITE has to be split into a sequence of
// rich_text objects, each <= 2000 chars. Reading is the reverse: concatenate them.
export const RICH_TEXT_LIMIT = 2000

// Join an array of Notion rich_text objects back into one plain string.
export function richTextToPlain(richText) {
  if (!Array.isArray(richText)) return ''
  return richText.map(rt => (rt && rt.plain_text != null ? rt.plain_text : (rt?.text?.content ?? ''))).join('')
}

// Split a plain string into Notion rich_text objects, none exceeding RICH_TEXT_LIMIT.
// Empty string -> [] (Notion clears the property). We split on raw length, not words,
// because the cap is about characters; the boundary mid-word is invisible once rejoined.
export function plainToRichText(text, limit = RICH_TEXT_LIMIT) {
  const str = text == null ? '' : String(text)
  if (str.length === 0) return []
  const chunks = []
  for (let i = 0; i < str.length; i += limit) {
    chunks.push({ text: { content: str.slice(i, i + limit) } })
  }
  return chunks
}

// A word count that mirrors the *intent* of Notion's formula
//   length(Entry) - length(replaceAll(Entry, " ", "")) + 1   (i.e. spaces + 1)
// but behaves sanely on the edges the formula gets wrong: empty/whitespace -> 0,
// and runs of whitespace or newlines collapse to one separator. This is guidance
// shown live as you type; Notion's stored Word Count remains the source of truth.
export function wordCount(text) {
  if (text == null) return 0
  const trimmed = String(text).trim()
  if (trimmed === '') return 0
  return trimmed.split(/\s+/).length
}

// Read a Notion page object into our app model. Defensive throughout: a property
// can be missing or a different type if the schema drifts, and we'd rather render
// a half-empty entry than throw on the whole list.
export function toEntry(page) {
  const props = (page && page.properties) || {}
  const titleProp = props.Title || props.Name || {}
  return {
    id: page?.id ?? null,
    title: richTextToPlain(titleProp.title),
    date: props.Date?.date?.start ?? null,
    tags: (props.Tags?.multi_select ?? []).map(o => o.name),
    people: (props.People?.multi_select ?? []).map(o => o.name),
    entry: richTextToPlain(props.Entry?.rich_text),
    wordCount: props['Word Count']?.formula?.number ?? null,
  }
}

// Build the `properties` payload for a create/update call. Word Count is a formula
// property — Notion rejects writes to it — so we never include it.
export function toNotionProps(entry) {
  const e = entry || {}
  return {
    Title: { title: plainToRichText(e.title) },
    Date: { date: e.date ? { start: e.date } : null },
    Tags: { multi_select: (e.tags ?? []).map(name => ({ name })) },
    People: { multi_select: (e.people ?? []).map(name => ({ name })) },
    Entry: { rich_text: plainToRichText(e.entry) },
  }
}

// Pull a Notion database/page id out of whatever a user pastes: a full URL like
// notion.so/workspace/Title-<32hex>?v=..., a bare 32-char id, or a dashed UUID.
// Returns the compact 32-char id (Notion's API accepts it with or without dashes),
// or '' if nothing id-shaped is present.
//
// The id is bounded: in a URL it's the trailing 32 hex chars, preceded by the '-'
// (or '/') that separates it from the slug. We must respect that boundary — a slug
// ending in hex letters (…-App-Sp"ec"-<id>) would otherwise bleed into the id.
export function parseNotionId(input) {
  if (!input) return ''
  const s = String(input).trim()
  // A dashed UUID anywhere wins (unambiguous).
  const uuid = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  if (uuid) return uuid[0].replace(/-/g, '').toLowerCase()
  const path = s.split(/[?#]/)[0]                     // drop query (?v=…) and hash
  if (/^[0-9a-f]{32}$/i.test(path)) return path.toLowerCase()  // a bare id
  const m = path.match(/[-/]([0-9a-f]{32})\/?$/i)     // id at the end of a URL path
  return m ? m[1].toLowerCase() : ''
}

// Unique, order-preserving option names pulled from a list of entries — used to
// suggest existing Tags/People values inline without ever forcing a closed list.
export function collectOptions(entries, field) {
  const seen = new Set()
  const out = []
  for (const e of entries || []) {
    for (const name of e?.[field] ?? []) {
      if (!seen.has(name)) { seen.add(name); out.push(name) }
    }
  }
  return out
}