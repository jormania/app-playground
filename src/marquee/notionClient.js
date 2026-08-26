// Live data client for the venue list.
//
// Same plumbing as Radar-B and Wanderlist: the browser can't call api.notion.com
// (no CORS), so everything goes through this site's stateless /api/notion relay
// with a BYO token — and deliberately NO new serverless function (Vercel Hobby
// caps this repo at 12 across all apps; see CLAUDE.md and MARQUEE.md §2).
//
// Removing a venue ARCHIVES its Notion page rather than deleting it. Notion's
// trash keeps it recoverable, the row's notes survive a mistake, and the app
// never has to implement an undo of its own.

import { fromVenuePage, toVenueProps, statusProps, scanResultProps } from './notion.js'
import { toFindingsPage, fromFindingsRow } from './wanderlist.js'
import { FINDINGS_DATABASE_ID } from '../shared/findings.js'

export const PROXY_URL = '/api/notion'

/** "Marquee — Watched Venues", under Dev → App Databases. The default once a
 *  token is set; overridable in Settings for anyone starting from the template. */
export const VENUES_DATABASE_ID = '7c2ed57e41b74660868f014e9965ff19'

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

export function createNotionClient(token, { venuesDatabaseId = VENUES_DATABASE_ID, findingsDatabaseId = FINDINGS_DATABASE_ID, fetchImpl } = {}) {
  const call = fetchImpl
    ? (path, method, body) => fetchImpl(token, path, method, body)
    : (path, method, body) => proxy(token, path, method, body)

  return {
    mode: 'live',
    venuesDatabaseId,
    findingsDatabaseId,

    async listVenues() {
      const out = []
      let cursor
      do {
        const page = await call(`databases/${venuesDatabaseId}/query`, 'POST', {
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
        })
        out.push(...(page.results || []).map(fromVenuePage))
        cursor = page.has_more ? page.next_cursor : undefined
      } while (cursor)
      return out
    },

    async addVenue(venue) {
      const page = await call('pages', 'POST', {
        parent: { database_id: venuesDatabaseId },
        properties: toVenueProps(venue),
      })
      return fromVenuePage(page)
    },

    async updateVenue(venue) {
      if (!venue?.id) throw new Error('That venue has no Notion row yet.')
      const page = await call(`pages/${venue.id}`, 'PATCH', { properties: toVenueProps(venue) })
      return fromVenuePage(page)
    },

    /** Pause / resume. One column, so it can't disturb anything else on the row. */
    async setStatus(id, status) {
      const page = await call(`pages/${id}`, 'PATCH', { properties: statusProps(status) })
      return fromVenuePage(page)
    },

    async removeVenue(id) {
      await call(`pages/${id}`, 'PATCH', { archived: true })
      return { id, archived: true }
    },

    async recordScan(id, { checkedAt, result }) {
      const page = await call(`pages/${id}`, 'PATCH', { properties: scanResultProps({ checkedAt, result }) })
      return fromVenuePage(page)
    },

    /** Read Wanderlist's Findings so Marquee can tell what is already kept.
     *
     *  Only the fields the matcher needs — this is a dedupe index, not a second
     *  copy of Wanderlist. Rows are read in full (paginated) rather than filtered
     *  server-side: Notion cannot filter on "title looks like this", and the
     *  database is a personal backlog, not a warehouse. */
    async listFindings() {
      const out = []
      let cursor
      do {
        const page = await call(`databases/${findingsDatabaseId}/query`, 'POST', {
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
        })
        out.push(...(page.results || []).map(fromFindingsRow))
        cursor = page.has_more ? page.next_cursor : undefined
      } while (cursor)
      return out
    },

    /** The keep handoff: a new row in Wanderlist's Findings, and nothing of it
     *  kept here. */
    async saveToWanderlist(draft) {
      const page = await call('pages', 'POST', toFindingsPage(draft, findingsDatabaseId))
      return { id: page.id, url: page.url ?? null }
    },

    /** Cheap reachability check for Settings → "Test connection". */
    async probe() {
      const page = await call(`databases/${venuesDatabaseId}/query`, 'POST', { page_size: 1 })
      return { ok: true, hasRows: (page.results || []).length > 0 }
    },
  }
}
