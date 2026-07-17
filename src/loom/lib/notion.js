// Pure mapping between Notion's wire shapes and Loom's clean thread model. No
// network, no React — heavily tested. Loom reads/writes one database of threads
// (tasks) with a deliberately tiny schema so a user only needs a token + a
// database URL. See LOOM.md for the schema the Settings screen documents.
//
// Notion schema (property → app field):
//   Name   (title)    → title
//   Skein  (select)   → skein   (the List-view grouping; null = loose)
//   Day    (date)     → day     ('YYYY-MM-DD' local day key; null = backlog)
//   Order  (number)   → order   (fractional manual rank)
//   Done   (checkbox) → done

export const RICH_TEXT_LIMIT = 2000

export function richTextToPlain(richText) {
  if (!Array.isArray(richText)) return ''
  return richText.map(rt => (rt && rt.plain_text != null ? rt.plain_text : (rt?.text?.content ?? ''))).join('')
}

export function plainToRichText(text, limit = RICH_TEXT_LIMIT) {
  const str = text == null ? '' : String(text)
  if (str.length === 0) return []
  const chunks = []
  for (let i = 0; i < str.length; i += limit) {
    chunks.push({ text: { content: str.slice(i, i + limit) } })
  }
  return chunks
}

// A Notion date property's start can be a bare day key or a full datetime; a
// thread's day is only ever a day, so keep just the leading 'YYYY-MM-DD'.
function dayFromStart(start) {
  if (!start) return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(start))
  return m ? m[1] : null
}

// Read a Notion page into the app model. Defensive: a drifted/absent property
// yields a sensible default rather than throwing on the whole list.
export function toThread(page) {
  const props = (page && page.properties) || {}
  const titleProp = props.Name || props.Title || {}
  return {
    id: page?.id ?? null,
    title: richTextToPlain(titleProp.title),
    skein: props.Skein?.select?.name || null,
    day: dayFromStart(props.Day?.date?.start ?? null),
    order: typeof props.Order?.number === 'number' ? props.Order.number : 0,
    done: Boolean(props.Done?.checkbox),
  }
}

// Build the `properties` payload for a create/update. A null clears a property.
export function toNotionProps(thread) {
  const t = thread || {}
  return {
    Name: { title: plainToRichText(t.title) },
    Skein: { select: t.skein ? { name: String(t.skein) } : null },
    Day: { date: t.day ? { start: t.day } : null },
    Order: { number: typeof t.order === 'number' ? t.order : 0 },
    Done: { checkbox: Boolean(t.done) },
  }
}

// Pull a Notion database/page id out of whatever a user pastes: a full URL, a
// bare 32-char id, or a dashed UUID. Returns the compact 32-char id, or ''.
// (Same parser shape as Wanderlist / Journal of Delights.)
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
