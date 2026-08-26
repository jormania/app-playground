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

/** The same narrow patch the app's own `recordScan` writes — Last Checked and
 *  Last Result, nothing else. Best-effort from the caller's side: one venue's
 *  Notion write failing must never stop the rest of the scheduled check. */
export async function writeScanResult(token, pageId, { checkedAt, result }) {
  await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: {
        'Last Checked': { date: checkedAt ? { start: checkedAt } : null },
        'Last Result': { rich_text: result ? [{ type: 'text', text: { content: String(result).slice(0, 2000) } }] : [] },
      },
    }),
  })
}
