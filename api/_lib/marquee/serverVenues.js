// Reading and writing Marquee's Notion venues from the server, for the
// scheduled check. Deliberately the minimal slice, not a reuse of the client's
// src/marquee/notion.js: the client's mapping is richer (paused/address/notes,
// all the fields Settings edits) than a scan ever needs, and reaching from a
// serverless function into the Vite source tree is the boundary this repo
// doesn't cross elsewhere — see diff.js's header.

const NOTION_VERSION = '2022-06-28'

function plain(prop) {
  const parts = prop?.rich_text ?? prop?.title ?? []
  const text = parts.map((p) => p.plain_text ?? p.text?.content ?? '').join('').trim()
  return text || null
}

function select(prop) {
  const name = prop?.select?.name
  return name ? name.trim().toLowerCase() : null
}

function mapVenueRow(page) {
  const p = page?.properties ?? {}
  return {
    id: page?.id ?? null,
    name: plain(p.Name) || 'Untitled venue',
    url: p['Programme URL']?.url?.trim() || '',
    adapter: select(p.Adapter),
    config: plain(p['Adapter Config']),
    category: select(p['Category Default']),
  }
}

/** Every venue whose Status is "active" — Marquee's own pause/resume, honoured
 *  here exactly as it is in the app: a paused venue is skipped, not scanned and
 *  silently ignored downstream. */
export async function queryActiveVenues(token, dbId) {
  const out = []
  let cursor
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
        filter: { property: 'Status', select: { equals: 'active' } },
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      const err = new Error(`Notion query failed (${res.status})`)
      err.detail = text.slice(0, 300)
      throw err
    }
    const data = await res.json()
    out.push(...(data.results || []).map(mapVenueRow))
    cursor = data.has_more ? data.next_cursor : undefined
  } while (cursor)
  return out
}

function richText(value) {
  return { rich_text: value ? [{ type: 'text', text: { content: String(value).slice(0, 2000) } }] : [] }
}

/** PATCH a venue row, and — the part this file used to skip — INSIST it worked.
 *
 * The original swallowed the response entirely: a Notion 404 (row unshared), a
 * 400 (a renamed property) or a 429 all returned as cleanly as a success, and
 * the caller's `catch` could only ever fire on a network throw. A venue row that
 * silently stopped accepting writes would sit there wearing an old date, which
 * is the same lie §9.89 is about. Now a non-2xx throws, so "the write failed" is
 * a thing the caller can count and report. */
async function patchVenue(token, pageId, properties) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties }),
  })
  if (!res?.ok) {
    const text = await res?.text?.().catch(() => '') ?? ''
    const err = new Error(`Notion write failed (${res?.status ?? 0})`)
    err.detail = String(text).slice(0, 300)
    throw err
  }
}

/** The same narrow patch the app's own `recordScan` writes — Last Checked and
 *  Last Result, nothing else. Best-effort from the caller's side: one venue's
 *  Notion write failing must never stop the rest of the scheduled check. */
export async function writeScanResult(token, pageId, { checkedAt, result }) {
  await patchVenue(token, pageId, {
    'Last Checked': { date: checkedAt ? { start: checkedAt } : null },
    'Last Result': richText(result),
  })
}

/** For a venue the run never reached: say so on its own row, and deliberately
 *  DO NOT touch Last Checked.
 *
 *  That omission is the whole point. Last Checked means "when this venue was
 *  last actually read", and stamping today's date on a venue nobody read would
 *  buy a tidy-looking row at the cost of the one field anyone would trust. So
 *  the date stays honestly stale and Last Result explains why — carrying the
 *  date of the run that skipped it, so the row is self-describing without
 *  cross-referencing anything. */
export async function writeNotChecked(token, pageId, note) {
  await patchVenue(token, pageId, { 'Last Result': richText(note) })
}
