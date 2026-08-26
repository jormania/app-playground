// The two halves of Wanderlist's reminders live in one function now, split by
// `?mode=prefs` (see the file header for why). The split itself is the only thing
// that can silently break — a prefs call falling through to the send path would look
// like "reminders aren't configured" rather than like a routing bug — so it is what
// these tests pin down.
//
// It lives under api/_tests/ rather than beside the handler because **every
// api/*.js file is a Vercel serverless function**, test files included — a test
// sitting in api/ would burn one of the twelve slots this merge just freed. Paths
// under api/_* are excluded from that count.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const kv = vi.hoisted(() => ({
  store: new Map(),
  configured: true,
}))

vi.mock('../_lib/kv.js', () => ({
  kvConfigured: () => kv.configured,
  kvGet: async (key) => kv.store.get(key) ?? null,
  kvSet: async (key, value) => { kv.store.set(key, value); return true },
}))

vi.mock('../_shared.js', async (importOriginal) => ({
  ...(await importOriginal()),
  originAllowed: () => true,
  rateLimited: () => false,
}))

vi.mock('../_lib/marquee/serverScan.js', () => ({
  runScheduledCheck: vi.fn(),
}))

const { default: handler, PREFS_KEY } = await import('../wanderlist-remind.js')
const { runScheduledCheck } = await import('../_lib/marquee/serverScan.js')

const TOKEN = 'secret-notion-token'

/** Minimal stand-in for Vercel's res — records what the handler answered. */
function makeRes() {
  const res = { statusCode: null, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (obj) => { res.body = obj; return res }
  res.send = (text) => { res.body = text; return res }
  return res
}

function call({ query = {}, method = 'GET', headers = {}, body } = {}) {
  const res = makeRes()
  return handler({ query, method, headers, body }, res).then(() => res)
}

let env
beforeEach(() => {
  env = { ...process.env }
  kv.store = new Map()
  kv.configured = true
  process.env.WANDERLIST_NOTION_TOKEN = TOKEN
  delete process.env.WANDERLIST_DB_ID
  delete process.env.RESEND_API_KEY
  delete process.env.REMINDER_FROM
})
afterEach(() => { process.env = env })

describe('?mode=prefs', () => {
  it('reads the stored prefs for the holder of the token', async () => {
    kv.store.set(PREFS_KEY, { enabled: true, email: 'a@b.c', name: 'Gabe', sendHour: 19 })
    const res = await call({ query: { mode: 'prefs' }, headers: { 'x-notion-token': TOKEN } })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ configured: true, prefs: { enabled: true, email: 'a@b.c', name: 'Gabe', sendHour: 19 } })
  })

  it('fills in defaults when KV holds nothing yet', async () => {
    const res = await call({ query: { mode: 'prefs' }, headers: { 'x-notion-token': TOKEN } })
    expect(res.body.prefs).toEqual({ enabled: false, email: '', name: '', sendHour: 8 })
  })

  it('writes prefs, sanitizing what it is given', async () => {
    const res = await call({
      query: { mode: 'prefs' },
      method: 'POST',
      headers: { 'x-notion-token': TOKEN },
      body: JSON.stringify({ enabled: 'yes', email: ' a@b.c ', name: 'Gabe', sendHour: 99 }),
    })
    expect(res.statusCode).toBe(200)
    expect(res.body.prefs).toEqual({ enabled: true, email: 'a@b.c', name: 'Gabe', sendHour: 23 })
    expect(kv.store.get(PREFS_KEY).sendHour).toBe(23)
  })

  it('refuses a caller whose token does not match the server’s', async () => {
    const res = await call({ query: { mode: 'prefs' }, headers: { 'x-notion-token': 'wrong' } })
    expect(res.statusCode).toBe(401)
    expect(kv.store.size).toBe(0)
  })

  it('says the server is not set up when KV is missing', async () => {
    kv.configured = false
    const res = await call({ query: { mode: 'prefs' }, headers: { 'x-notion-token': TOKEN } })
    expect(res.statusCode).toBe(501)
    expect(res.body.configured).toBe(false)
  })

  // The point of the ordering in the handler: prefs are readable on a setup that has
  // KV but no Resend key. If the send path's env check ran first, this would 501 with
  // the wrong message and Settings would show "reminders aren't set up" forever.
  it('does not require the send path’s env vars', async () => {
    const res = await call({ query: { mode: 'prefs' }, headers: { 'x-notion-token': TOKEN } })
    expect(res.statusCode).toBe(200)
  })

  it('rejects a verb that is neither GET nor POST', async () => {
    const res = await call({ query: { mode: 'prefs' }, method: 'DELETE', headers: { 'x-notion-token': TOKEN } })
    expect(res.statusCode).toBe(405)
  })
})

describe('the send path', () => {
  it('is what an unmoded call still reaches', async () => {
    const res = await call()
    expect(res.statusCode).toBe(501)
    expect(res.body.message).toMatch(/Reminder cron not fully configured/)
  })

  it('is not entered by a prefs call — the two answers stay distinguishable', async () => {
    const prefs = await call({ query: { mode: 'prefs' }, headers: { 'x-notion-token': TOKEN } })
    expect(prefs.body.message ?? '').not.toMatch(/Reminder cron/)
  })

  it('ignores an unknown mode rather than treating it as prefs', async () => {
    const res = await call({ query: { mode: 'something-else' } })
    expect(res.body.message).toMatch(/Reminder cron not fully configured/)
  })
})

describe('the Marquee section (piggybacking on this same send)', () => {
  const marqueeChange = (over = {}) => ({
    kind: 'tickets-opened', key: 'k', title: 'Solaris', venue: 'Teatrul Excelsior', date: '2026-09-12', time: '19:00', ...over,
  })

  /** Notion returns nothing due for Wanderlist itself, on either query the
   *  handler might make (due-tomorrow, or the weekly stale-ideas nudge). */
  function stubEmptyWanderlist() {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ results: [], has_more: false }) })))
  }

  beforeEach(() => {
    process.env.WANDERLIST_DB_ID = 'db1'
    process.env.RESEND_API_KEY = 'resend-key'
    process.env.REMINDER_FROM = 'reminders@example.com'
    kv.store.set(PREFS_KEY, { enabled: true, email: 'me@example.com', name: 'Gabe', sendHour: 8 })
  })
  afterEach(() => { vi.unstubAllGlobals(); runScheduledCheck.mockReset() })

  it('still bails out on "nothing-due" when Marquee is unconfigured — unchanged from before it existed', async () => {
    runScheduledCheck.mockResolvedValue({ configured: false, changes: [], venues: [] })
    stubEmptyWanderlist()
    const res = await call({ query: { dryRun: '1' } })
    expect(res.body.reason).toBe('nothing-due')
  })

  it('sends on Marquee news alone, with a Marquee-flavoured subject, even though nothing is due', async () => {
    runScheduledCheck.mockResolvedValue({ configured: true, changes: [marqueeChange()], venues: [] })
    stubEmptyWanderlist()
    const res = await call({ query: { dryRun: '1' } })
    expect(res.body.dryRun).toBe(true)
    expect(res.body.marquee).toBe(1)
    expect(res.body.email.subject).toMatch(/Marquee/)
    expect(res.body.email.subject).toMatch(/Solaris/)
    expect(res.body.email.html).toContain('Solaris')
    expect(res.body.email.text).toContain('Solaris')
  })

  it('a Marquee failure never cancels the Wanderlist reminder it rides along with', async () => {
    runScheduledCheck.mockRejectedValue(new Error('Notion is down'))
    stubEmptyWanderlist()
    const res = await call({ query: { dryRun: '1' } })
    // Nothing due on Wanderlist and Marquee threw — still the same honest
    // "nothing-due" rather than a 502 for a section that failed silently.
    expect(res.body.reason).toBe('nothing-due')
  })

  it('appends to, rather than replaces, an email Wanderlist already had something to send', async () => {
    // A test send always carries at least one placeholder item, which is what
    // makes items.length > 0 deterministic here without faking "tomorrow"
    // against the real wall clock.
    runScheduledCheck.mockResolvedValue({ configured: true, changes: [marqueeChange({ kind: 'sold-out', title: 'Tomcat' })], venues: [] })
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('api.resend.com')) return { ok: true }
      return { ok: true, json: async () => ({ results: [], has_more: false }) }
    }))
    const res = await call({ query: { test: '1' }, headers: { 'x-notion-token': TOKEN } })
    // Marquee's section rides along fine even when Wanderlist ALSO has
    // something to send (the placeholder item guaranteed by test mode) —
    // it's a guest appended to the email, never a reason the real send fails.
    expect(res.body.marquee).toBe(1)
    expect(res.body.test).toBe(true)
    expect(res.statusCode).toBe(200)
  })
})
