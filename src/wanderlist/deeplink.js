// Opening one entry from outside the app.
//
// Radar-B (and anything else that knows a Findings page id) can link straight to
// an item here with `wanderlist-react.html#/entry/<id>`. Before this, the only handoff
// back from Radar-B was a link to the raw Notion page — which is the same place
// the provenance list already points at, and which shows a database row rather
// than the entry as Wanderlist presents it.
//
// The app has no router and doesn't want one: this is a single read of the hash
// at startup, consumed once and erased from the URL, so a reload doesn't keep
// re-opening the same entry after you've navigated away.

/** Notion hands back a dashed uuid in `page.id` and a bare 32-char id in
 *  `page.url`. Both must resolve to the same entry, so ids are compared folded. */
export function foldId(id) {
  return String(id ?? '').replace(/-/g, '').trim().toLowerCase()
}

/** The entry id in a hash, or null. Anything that isn't a 32-hex Notion id is
 *  ignored rather than guessed at — a stray `#photos` must not open anything. */
export function entryIdFromHash(hash) {
  const m = /^#\/entry\/([0-9a-fA-F-]+)$/.exec(String(hash ?? ''))
  if (!m) return null
  const id = foldId(m[1])
  return /^[0-9a-f]{32}$/.test(id) ? id : null
}

export function findById(entries, id) {
  if (!id) return null
  return entries.find((e) => foldId(e.id) === id) ?? null
}

/** Where to send someone when the id is real but the entry isn't in the list —
 *  filtered out, not yet synced, or this browser is in demo mode. Notion is the
 *  one place it's guaranteed to exist. */
export function notionUrlForId(id) {
  return id ? `https://www.notion.so/${id}` : null
}
