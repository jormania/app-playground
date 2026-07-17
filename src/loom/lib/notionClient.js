// Live data client. The browser can't call api.notion.com directly (no CORS), so
// every call goes through this site's same-origin proxy (/api/notion), which
// relays it server-side with the BYO token the caller supplies — identical
// plumbing to Wanderlist / Journal of Delights. Classic database endpoints
// (Notion-Version 2022-06-28, pinned in the proxy) so a user only needs a token
// + a database URL.
import { toThread, toNotionProps } from './notion.js'

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

export function createNotionClient(token, { databaseId, fetchImpl } = {}) {
  // fetchImpl is only an injection seam for tests; production uses the proxy.
  const call = fetchImpl
    ? (path, method, body) => fetchImpl(token, path, method, body)
    : (path, method, body) => proxy(token, path, method, body)

  return {
    mode: 'live',
    databaseId,

    // Query the whole database, following pagination so a long board is never
    // silently truncated at the 100-row page size. We let the app sort by
    // Order/day rather than asking Notion to.
    async listThreads() {
      const results = []
      let cursor
      do {
        const page = await call(`databases/${databaseId}/query`, 'POST', {
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
        })
        results.push(...(page.results || []))
        cursor = page.has_more ? page.next_cursor : undefined
      } while (cursor)
      return results.map(toThread)
    },

    async createThread(thread) {
      const page = await call('pages', 'POST', {
        parent: { database_id: databaseId },
        properties: toNotionProps(thread),
      })
      return toThread(page)
    },

    // Patch only the fields present in `patch`, so a reorder writes just Order.
    async updateThread(id, patch) {
      const page = await call(`pages/${id}`, 'PATCH', { properties: patchProps(patch) })
      return toThread(page)
    },

    // Notion has no hard delete via this API surface — archiving removes it from
    // the board (and the app's next query) exactly like a delete.
    async removeThread(id) {
      await call(`pages/${id}`, 'PATCH', { archived: true })
      return { ok: true }
    },

    // Cheap reachability check for Settings → "Test connection".
    async probe() {
      const page = await call(`databases/${databaseId}/query`, 'POST', { page_size: 1 })
      return { ok: true, hasEntries: (page.results || []).length > 0 }
    },
  }
}

// Build a properties payload for just the fields in `patch` — full props from
// toNotionProps, then pruned to the keys the patch actually touches. This keeps
// a lone Order or Done write from clobbering the title with an empty string.
const FIELD_TO_PROP = { title: 'Name', skein: 'Skein', day: 'Day', order: 'Order', done: 'Done' }
function patchProps(patch) {
  const full = toNotionProps(patch)
  const out = {}
  for (const [field, prop] of Object.entries(FIELD_TO_PROP)) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) out[prop] = full[prop]
  }
  return out
}
