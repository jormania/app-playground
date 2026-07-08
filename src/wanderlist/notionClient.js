// Live data client. The browser can't call api.notion.com directly (no CORS), so every
// call goes through this site's same-origin proxy (/api/notion), which relays it
// server-side with the BYO token the caller supplies — identical plumbing to Journal of
// Delights. We use the classic database endpoints (Notion-Version 2022-06-28, pinned in
// the proxy) so a user only needs a token + database URL.
import { toEntry, toNotionProps } from './notion.js'

// Gabriel's "Findings" database — the out-of-the-box default once a token is set. Any
// user overrides it in Settings with their own copy.
export const DEFAULT_DATABASE_ID = '41c42bc4dfb543f49051810b3c5880fe'
export const PROXY_URL = '/api/notion'

async function proxy(token, path, method, body) {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-notion-token': token },
    body: JSON.stringify({ path, method, body }),
  })
  let data = {}
  try { data = await res.json() } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const msg = data?.message || data?.error || `Notion request failed (${res.status})`
    throw new Error(msg)
  }
  return data
}

export function createNotionClient(token, { databaseId = DEFAULT_DATABASE_ID, fetchImpl } = {}) {
  // fetchImpl is only an injection seam for tests; production uses the proxy.
  const call = fetchImpl
    ? (path, method, body) => fetchImpl(token, path, method, body)
    : (path, method, body) => proxy(token, path, method, body)

  return {
    mode: 'live',
    databaseId,

    // Query the database newest-first, following pagination so a long backlog is never
    // silently truncated at the 100-row page size. We sort by created_time (always
    // present) and let the app re-sort by expiry/name — see search.js sortEntries.
    async listEntries() {
      const results = []
      let cursor
      do {
        const page = await call(`databases/${databaseId}/query`, 'POST', {
          sorts: [{ timestamp: 'created_time', direction: 'descending' }],
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
        })
        results.push(...(page.results || []))
        cursor = page.has_more ? page.next_cursor : undefined
      } while (cursor)
      return results.map(toEntry)
    },

    async createEntry(entry) {
      const page = await call('pages', 'POST', {
        parent: { database_id: databaseId },
        properties: toNotionProps(entry),
      })
      return toEntry(page)
    },

    async updateEntry(id, entry) {
      const page = await call(`pages/${id}`, 'PATCH', { properties: toNotionProps(entry) })
      return toEntry(page)
    },

    // Cheap reachability check for Settings → "Test connection": one tiny query.
    async probe() {
      const page = await call(`databases/${databaseId}/query`, 'POST', { page_size: 1 })
      return { ok: true, hasEntries: (page.results || []).length > 0 }
    },
  }
}
