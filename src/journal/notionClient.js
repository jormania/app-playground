// Live data client. The browser CANNOT call api.notion.com directly — Notion
// sends no CORS headers and offers no browser-access opt-in (unlike Anthropic's
// `anthropic-dangerous-direct-browser-access`). So every call goes to our own
// same-origin proxy (/api/notion), which forwards it server-side. The token is
// supplied by the caller (client-side BYO model, like Touch Grass's Anthropic
// key) in a header the proxy relays as `Authorization: Bearer`.
//
// We use the classic database endpoints (Notion-Version 2022-06-28, set in the
// proxy) so a user only needs a token and the database URL — no hunting for an
// internal "data source id". Anyone can point the app at their own copy.
import { toEntry, toNotionProps } from './notion.js'

// Gabriel's database — the out-of-the-box default. Any user overrides it in
// settings with their own (duplicated or freshly built) database.
export const DEFAULT_DATABASE_ID = 'cf04e03098294448a206d9a4e66f7187'
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
  // fetchImpl is only an injection seam for tests; production uses global fetch.
  const call = fetchImpl
    ? (path, method, body) => fetchImpl(token, path, method, body)
    : (path, method, body) => proxy(token, path, method, body)

  return {
    mode: 'live',
    databaseId,

    // Query the database, following pagination so we never silently truncate a
    // long journal at the 100-row page size.
    async listEntries() {
      const results = []
      let cursor
      do {
        const page = await call(`databases/${databaseId}/query`, 'POST', {
          sorts: [{ property: 'Date', direction: 'descending' }],
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

    // A cheap reachability check for the settings "Test connection" button:
    // one tiny query. Resolves with whether at least one entry exists; rejects
    // (with Notion's message) if the token is wrong or the DB isn't shared.
    async probe() {
      const page = await call(`databases/${databaseId}/query`, 'POST', { page_size: 1 })
      return { ok: true, hasEntries: (page.results || []).length > 0 }
    },
  }
}
