// The Long Listen's Notion writes, made with a server-held integration token
// (LONG_LISTEN_NOTION_TOKEN) rather than the BYO-token relay other apps use —
// the token never reaches the browser. The client composes the calls (it holds
// the data); this only forwards the handful of shapes the mirror needs, and only
// under the one parent page the integration is meant to write in
// (LONG_LISTEN_NOTION_PAGE_ID). Anything else is refused.
const NOTION_BASE = 'https://api.notion.com/v1/'
// The classic version: lets the mirror create databases with `parent.page_id`
// and pages with `parent.database_id`, as every other app here does.
const NOTION_VERSION = '2022-06-28'

const ID = '[0-9a-fA-F-]{32,36}'
const ROUTES = [
  { method: 'POST', re: /^databases$/ },
  { method: 'POST', re: new RegExp(`^databases/${ID}/query$`) },
  { method: 'POST', re: /^pages$/ },
  { method: 'PATCH', re: new RegExp(`^pages/${ID}$`) },
  { method: 'GET', re: new RegExp(`^blocks/${ID}/children(\\?.*)?$`) },
  { method: 'PATCH', re: new RegExp(`^blocks/${ID}/children$`) },
  { method: 'PATCH', re: new RegExp(`^blocks/${ID}$`) },
]

export function notionConfig(env = process.env) {
  const token = env.LONG_LISTEN_NOTION_TOKEN
  const pageId = (env.LONG_LISTEN_NOTION_PAGE_ID || '').replace(/-/g, '')
  return token && pageId ? { token, pageId } : null
}

const bare = (id) => String(id || '').replace(/-/g, '')

/** Is this call one the mirror is allowed to make? Returns a reason when not. */
export function refuseNotionCall({ path, method, body }, pageId) {
  if (typeof path !== 'string' || path.includes('..')) return 'Invalid path.'
  const m = String(method || '').toUpperCase()
  if (!ROUTES.some((r) => r.method === m && r.re.test(path))) return `${m} ${path} is not a call the mirror makes.`
  // New databases only under the configured page.
  if (path === 'databases' && bare(body?.parent?.page_id) !== pageId) return 'Databases may only be created under the configured page.'
  // New pages only in a database, or directly under the configured page.
  if (path === 'pages') {
    const parent = body?.parent ?? {}
    if (!parent.database_id && bare(parent.page_id) !== pageId) return 'Pages may only be created in a database or under the configured page.'
  }
  return null
}

export async function forwardNotion(call, config, fetchImpl = fetch) {
  const method = String(call.method).toUpperCase()
  const res = await fetchImpl(NOTION_BASE + call.path, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: method === 'GET' || call.body == null ? undefined : JSON.stringify(call.body),
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}
