// The Long Listen's server side: the curator (Claude) and the Notion mirror.
//
// Two ways in, as the app's Settings offers them:
//
// 1. Bring your own key (the playground's house rule): the listener pastes an
//    Anthropic key in Settings; it's kept on their device and sent here in
//    `x-anthropic-key` with each curator call. It goes to Anthropic from this
//    server, never from the browser, and is neither logged nor stored.
// 2. The server's own key (ANTHROPIC_API_KEY, LONG_LISTEN_NOTION_TOKEN), which
//    is a real secret — so an allowed origin isn't enough to use it: the call
//    must carry the passphrase (LONG_LISTEN_ACCESS_KEY) in `x-long-listen-key`,
//    compared in constant time.
//
// Notion with the listener's own token goes through the shared /api/notion
// relay like every other app; the `notion` op here is only the server-token path.
//
// It is stateless. The listener's journey lives in IndexedDB on their device;
// each call brings the context the job needs (see src/long-listen/curation/
// context.ts) and gets the curator's answer back. Errors come back as short,
// safe messages — never a stack, a key, or an upstream body.
//
// One function for every job, deliberately: Vercel Hobby caps the repo at 12,
// and this slot was freed by folding Click Deck's HLTB proxy into steam-search.
import { timingSafeEqual } from 'node:crypto'
import { originAllowed, rateLimited, clientIp } from './_shared.js'
import { JOBS, CuratorError, makeClient, checkAlive, ping, looksLikeAnthropicKey } from './_lib/longListen/curator.js'
import { promptVersions } from './_lib/longListen/prompts.js'
import { notionConfig, refuseNotionCall, forwardNotion } from './_lib/longListen/notion.js'

export const maxDuration = 300

const STATUS = { unconfigured: 501, 'bad-key': 401, 'too-large': 413, refused: 422, invalid: 502, upstream: 502, 'rate-limited': 429 }

export function passphraseMatches(given, expected) {
  if (typeof given !== 'string' || !expected) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

function safeParse(str) {
  try { return JSON.parse(str) } catch { return {} }
}

export default async function handler(req, res, deps = {}) {
  if (req.method !== 'POST') { res.status(405).json({ message: 'Use POST.' }); return }
  if (!originAllowed(req.headers.origin)) { res.status(403).json({ message: 'Origin not allowed.' }); return }
  if (rateLimited(clientIp(req))) { res.status(429).json({ message: 'Too many requests — try again shortly.' }); return }

  const { op, payload = {} } = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {})
  const expected = process.env.LONG_LISTEN_ACCESS_KEY
  const unlocked = Boolean(expected) && passphraseMatches(req.headers['x-long-listen-key'], expected)
  const ownKey = req.headers['x-anthropic-key']

  // What the server offers, and whether this caller's passphrase opens it.
  // Says nothing secret: no key, no token, only yes or no.
  if (op === 'status') {
    const notion = notionConfig()
    res.status(200).json({
      serverKey: Boolean(expected && process.env.ANTHROPIC_API_KEY),
      unlocked,
      curator: unlocked && Boolean(process.env.ANTHROPIC_API_KEY),
      notion: unlocked && Boolean(notion),
      notionPageId: unlocked ? notion?.pageId : undefined,
      prompts: promptVersions(),
    })
    return
  }

  if (ownKey !== undefined && !looksLikeAnthropicKey(ownKey)) {
    res.status(401).json({ code: 'bad-key', message: 'That doesn’t look like an Anthropic key — it starts with sk-ant-.' })
    return
  }
  if (ownKey === undefined) {
    if (!expected) { res.status(501).json({ configured: false, code: 'unconfigured', message: 'Add your Anthropic key in Settings.' }); return }
    if (!unlocked) { res.status(401).json({ code: 'locked', message: 'That passphrase was not recognised.' }); return }
  }

  if (op === 'notion') {
    if (!unlocked) { res.status(401).json({ code: 'locked', message: 'The server’s Notion connection needs the passphrase.' }); return }
    const config = notionConfig()
    if (!config) { res.status(501).json({ message: 'Notion is not connected on the server.' }); return }
    const refusal = refuseNotionCall(payload, config.pageId)
    if (refusal) { res.status(400).json({ message: refusal }); return }
    try {
      const { status, data } = await forwardNotion(payload, config, deps.fetch)
      // Notion's own error message is safe to pass on (it names the problem,
      // never the token); anything else is reduced to a status.
      res.status(status).json(status < 400 ? data : { message: typeof data?.message === 'string' ? data.message : `Notion said ${status}.` })
    } catch {
      res.status(502).json({ message: 'Could not reach Notion.' })
    }
    return
  }

  const job = op === 'ping' ? ping : JOBS[op]
  if (!job) { res.status(400).json({ message: 'Unknown request.' }); return }

  try {
    const client = deps.client ?? makeClient(ownKey ? ownKey.trim() : undefined)
    const result = await job(client, payload)
    if (op === 'resources') result.resources = await checkAlive(result.resources, deps.fetch)
    res.status(200).json(result)
  } catch (err) {
    if (err instanceof CuratorError) {
      res.status(STATUS[err.code] ?? 502).json({ code: err.code, message: err.message })
      return
    }
    res.status(500).json({ code: 'internal', message: 'Something went wrong on the curator’s side.' })
  }
}
