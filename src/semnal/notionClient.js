// Live data client. The browser can't call api.notion.com directly (no CORS), so
// every call goes through this site's same-origin relay (/api/notion) with the BYO
// token the caller supplies — identical plumbing to Wanderlist and Journal of
// Delights, and deliberately NO new serverless function (Vercel Hobby caps this
// repo at 12 across all apps, and it is already at 12 — see CLAUDE.md).
//
// Semnal reads three things and writes one:
//   READ  📡 Radar          — the normalized event rows /recommend in Bucharest writes
//   READ  🗓️ Suggested events — the existing weekly page, for article-level provenance
//   READ  Findings          — Wanderlist, so an already-saved event is never re-offered
//   WRITE Findings          — the save handoff, and nothing else, ever
//
// Semnal never writes Radar rows. Two writers to one table is how the existing
// Notion workflow gets damaged by accident; the skill owns that table.

import { fromRadarPage, fromFindingsPage, parseSuggestedPage } from './notion.js'
import { toFindingsPage } from './wanderlist.js'
import { FINDINGS_DATABASE_ID } from '../shared/findings.js'

export const PROXY_URL = '/api/notion'
/** The 📡 Radar database — the event-level companion the skill writes, created as a
 *  child of the Suggested events page so the two stay visibly part of one workflow.
 *  The out-of-the-box default once a token is set; overridable in Settings. */
export const RADAR_DATABASE_ID = 'fbe904166c9e40fcbf723417e15a17bf'
/** The existing 🗓️ Suggested events page, as referenced by the skill. */
export const SUGGESTED_PAGE_ID = '377d3e6d60db81a688e1c81e0604a9a0'
export { FINDINGS_DATABASE_ID }

async function proxy(token, path, method, body) {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-notion-token': token },
    body: JSON.stringify({ path, method, body }),
  })
  let data = {}
  try { data = await res.json() } catch { /* non-JSON error body */ }
  if (!res.ok) throw new Error(data?.message || data?.error || `Notion request failed (${res.status})`)
  return data
}

export function createNotionClient(token, { radarDatabaseId = RADAR_DATABASE_ID, findingsDatabaseId = FINDINGS_DATABASE_ID, suggestedPageId = SUGGESTED_PAGE_ID, fetchImpl } = {}) {
  const call = fetchImpl
    ? (path, method, body) => fetchImpl(token, path, method, body)
    : (path, method, body) => proxy(token, path, method, body)

  async function queryAll(databaseId, map) {
    const out = []
    let cursor
    do {
      const page = await call(`databases/${databaseId}/query`, 'POST', {
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      })
      out.push(...(page.results || []).map(map))
      cursor = page.has_more ? page.next_cursor : undefined
    } while (cursor)
    return out
  }

  return {
    mode: 'live',
    radarDatabaseId,
    findingsDatabaseId,

    /** Radar rows. Absent database id = Radar simply isn't configured yet; the app
     *  still works off Findings + the Suggested page rather than erroring out. */
    async listEvents() {
      if (!radarDatabaseId) return []
      return queryAll(radarDatabaseId, fromRadarPage)
    },

    /** Wanderlist's Findings, mapped into the same event shape so a saved item
     *  takes part in dedupe as just another mention of an event. */
    async listSaved() {
      return queryAll(findingsDatabaseId, fromFindingsPage)
    },

    /** The 🗓️ Suggested events page's block children — read for WHICH ARTICLES fed
     *  the current refresh, the one thing that page uniquely holds. */
    async getSuggested() {
      if (!suggestedPageId) return { refreshedAt: null, links: [] }
      const blocks = []
      let cursor
      do {
        const page = await call(
          `blocks/${suggestedPageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`,
          'GET',
        )
        const results = page.results || []
        blocks.push(...results)
        // Table rows are children of the table block, not of the page.
        for (const block of results) {
          if (block.type === 'table' && block.has_children) {
            const rows = await call(`blocks/${block.id}/children?page_size=100`, 'GET')
            blocks.push(...(rows.results || []))
          }
        }
        cursor = page.has_more ? page.next_cursor : undefined
      } while (cursor)
      return parseSuggestedPage(blocks)
    },

    /** The ONLY write Semnal makes. */
    async saveToWanderlist(draft) {
      const page = await call('pages', 'POST', toFindingsPage(draft, findingsDatabaseId))
      return fromFindingsPage(page)
    },

    /** Cheap reachability check for Settings → "Test connection". */
    async probe() {
      const target = radarDatabaseId || findingsDatabaseId
      const page = await call(`databases/${target}/query`, 'POST', { page_size: 1 })
      return { ok: true, hasRows: (page.results || []).length > 0 }
    },
  }
}
