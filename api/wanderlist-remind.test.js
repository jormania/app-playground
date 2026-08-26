// The two halves of Wanderlist's reminders live in one function now, split by
// `?mode=prefs` (see the file header for why). The split itself is the only thing
// that can silently break — a prefs call falling through to the send path would look
// like "reminders aren't configured" rather than like a routing bug — so it is what
// these tests pin down.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const kv = vi.hoisted(() => ({
  store: new Map(),
  configured: true,
}))

vi.mock('./_lib/kv.js', () => ({
  kvConfigured: () => kv.configured,
  kvGet: async (key) => kv.store.get(key) ?? null,
  kvSet: async (key, value) => { kv.store.set(key, value); return true },
}))

vi.mock('./_shared.js', async (importOriginal) => ({
  ...(await importOriginal()),
  originAllowed: () => true,
  rateLimited: () => false,
}))

const { default: handler, PREFS_KEY } = await import('./wanderlist-remind.js')

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
