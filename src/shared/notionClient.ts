// The /api/notion relay call, shared.
//
// The browser can't call api.notion.com directly (no CORS), so every app that
// talks to Notion POSTs through this site's same-origin relay with the BYO token
// the caller supplies. Twelve app clients had written out the same fetch; this is
// that fetch, and nothing else — each app's own notionClient keeps its database
// ids, its mappers and its createNotionClient shape (R-003).
//
// Deliberately no new serverless function: Vercel Hobby caps this repo at 12
// across all apps and it is already at 12. See CLAUDE.md.

export const PROXY_URL = '/api/notion'

/**
 * POST one Notion API call through the relay and return its parsed body.
 *
 * `version` is optional and omitted from the payload when absent, which is why
 * the clients that passed it and the clients that didn't can share this: an
 * undefined value never reaches the JSON.
 *
 * Throws an `Error` carrying Notion's own `message` when the relay reports a
 * failure, falling back to `error` and then to the status code — a non-JSON
 * error body reads as an empty object rather than throwing on the parse.
 */
export async function notionProxy(
  token: string,
  path: string,
  method: string,
  body?: unknown,
  version?: string
): Promise<Record<string, unknown>> {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-notion-token': token },
    body: JSON.stringify({ path, method, body, version }),
  })
  let data: Record<string, unknown> = {}
  try { data = await res.json() } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const msg = data?.message || data?.error || `Notion request failed (${res.status})`
    throw new Error(String(msg))
  }
  return data
}
