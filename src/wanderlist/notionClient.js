// Live data client. The browser can't call api.notion.com directly (no CORS), so every
// call goes through this site's same-origin proxy (/api/notion), which relays it
// server-side with the BYO token the caller supplies — identical plumbing to Journal of
// Delights. We use the classic database endpoints (Notion-Version 2022-06-28, pinned in
// the proxy) so a user only needs a token + database URL.
import { toEntry, toNotionProps, ticketWriteEntry } from './notion.js'

// Gabriel's "Findings" database — the out-of-the-box default once a token is set. Any
// user overrides it in Settings with their own copy.
export const DEFAULT_DATABASE_ID = '41c42bc4dfb543f49051810b3c5880fe'
export const PROXY_URL = '/api/notion'
export const UPLOAD_URL = '/api/notion-upload'

// The file upload feature (Photo, Tickets) postdates the classic version the rest of the
// app is pinned to — only the calls below need to opt into it (see api/notion.js).
const NOTION_FILES_VERSION = '2025-09-03'

async function proxy(token, path, method, body, version) {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-notion-token': token },
    body: JSON.stringify({ path, method, body, version }),
  })
  let data = {}
  try { data = await res.json() } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const msg = data?.message || data?.error || `Notion request failed (${res.status})`
    throw new Error(msg)
  }
  return data
}

// Sends file bytes to the dedicated multipart relay (api/notion.js only speaks JSON — see
// api/notion-upload.js's own header comment for why this is separate). Shared, generic
// endpoint — not Journal-of-Delights-specific, so no new serverless function is needed here.
async function sendFileBytes(token, uploadId, blob, filename) {
  const res = await fetch(`${UPLOAD_URL}?id=${encodeURIComponent(uploadId)}`, {
    method: 'POST',
    headers: {
      'x-notion-token': token,
      'content-type': blob.type || 'application/octet-stream',
      'x-filename': encodeURIComponent(filename),
    },
    body: blob,
  })
  let data = {}
  try { data = await res.json() } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const msg = data?.message || data?.error || `File upload failed (${res.status})`
    throw new Error(msg)
  }
  return data
}

export function createNotionClient(token, { databaseId = DEFAULT_DATABASE_ID, fetchImpl } = {}) {
  // fetchImpl is only an injection seam for tests; production uses the proxy. version is
  // omitted from the call unless a caller passes one, so existing fetchImpl-based tests
  // asserting exact call arguments are unaffected.
  const call = fetchImpl
    ? (path, method, body, version) => (version === undefined
        ? fetchImpl(token, path, method, body)
        : fetchImpl(token, path, method, body, version))
    : (path, method, body, version) => proxy(token, path, method, body, version)

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

    // Two Notion calls: register the upload, then send the bytes. Returns a { ref, name }
    // the caller holds onto and later passes to attachPhoto/setTickets — this doesn't touch
    // any page, so it works before a new entry even has an id.
    async uploadFile(blob, filename) {
      const created = await call('file_uploads', 'POST',
        { mode: 'single_part', filename, content_type: blob.type || 'application/octet-stream' },
        NOTION_FILES_VERSION)
      await sendFileBytes(token, created.id, blob, filename)
      return { ref: created.id, name: filename }
    },

    async attachPhoto(pageId, photo) {
      const page = await call(`pages/${pageId}`, 'PATCH', {
        properties: { Photo: { files: [{ type: 'file_upload', file_upload: { id: photo.ref }, name: photo.name }] } },
      }, NOTION_FILES_VERSION)
      return toEntry(page)
    },

    async removePhoto(pageId) {
      const page = await call(`pages/${pageId}`, 'PATCH',
        { properties: { Photo: { files: [] } } },
        NOTION_FILES_VERSION)
      return toEntry(page)
    },

    // Replaces the WHOLE Tickets array in one PATCH — never an append (Notion's Files &
    // media property write always replaces, it has no "add one" verb). `tickets` is the
    // complete desired list; each entry converts via ticketWriteEntry (file_upload id when
    // known, else its just-fetched url as an external reference — see that function's
    // comment). Called once per Save from the editor, so every write is built from data
    // read moments earlier in the same session.
    async setTickets(pageId, tickets) {
      const page = await call(`pages/${pageId}`, 'PATCH', {
        properties: { Tickets: { files: (tickets || []).map(ticketWriteEntry) } },
      }, NOTION_FILES_VERSION)
      return toEntry(page)
    },
  }
}
