// api/notion.js is the relay five apps reach through src/shared/notionClient.ts, so
// one handler carries Loom, Journal, Wanderlist, Marquee and Radar-B. These tests pin
// the parts a refactor could silently break: the method/origin/rate/token gates, path
// validation, the pinned Notion-Version, and what an upstream answer or failure
// turns into. The real _shared.js guards run (nothing mocked) — only fetch is stubbed.
//
// Lives in api/_tests/, not beside the handler: every api/*.js is a Vercel function.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from '../notion.js'

function makeRes() {
  const res = { statusCode: null, body: null, headers: {} }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (obj) => { res.body = obj; return res }
  res.send = (text) => { res.body = text; return res }
  res.setHeader = (k, v) => { res.headers[k] = v; return res }
  return res
}

let ipCounter = 0
// A fresh IP per call keeps the module-level rate limiter from leaking between tests.
function call({ method = 'POST', headers = {}, body, ip } = {}) {
  const res = makeRes()
  const req = {
    method,
    headers: { 'x-notion-token': 'tok', 'x-forwarded-for': ip ?? `10.0.0.${++ipCounter}`, ...headers },
    body,
  }
  return handler(req, res).then(() => res)
}

let fetchMock
beforeEach(() => {
  fetchMock = vi.fn(async () => new Response('{"ok":true}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.unstubAllGlobals() })

describe('gates', () => {
  it('rejects anything but POST with 405', async () => {
    const res = await call({ method: 'GET' })
    expect(res.statusCode).toBe(405)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a foreign origin with 403, accepts localhost and *.coneofcold.vercel.app', async () => {
    const body = { path: 'search' }
    expect((await call({ headers: { origin: 'https://evil.example' }, body })).statusCode).toBe(403)
    expect((await call({ headers: { origin: 'http://localhost:5173' }, body })).statusCode).toBe(200)
    expect((await call({ headers: { origin: 'https://app.coneofcold.vercel.app' }, body })).statusCode).toBe(200)
  })

  it('answers 429 once one IP passes 20 calls in the window', async () => {
    const ip = '192.0.2.99'
    const codes = []
    for (let i = 0; i < 21; i++) codes.push((await call({ ip, body: { path: 'search' } })).statusCode)
    expect(codes.slice(0, 20).every((c) => c === 200)).toBe(true)
    expect(codes[20]).toBe(429)
  })

  it('answers 401 without a token and never calls Notion', async () => {
    const res = await call({ headers: { 'x-notion-token': '' }, body: { path: 'search' } })
    expect(res.statusCode).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('payload validation', () => {
  it.each([
    ['missing', undefined],
    ['non-string', 42],
    ['parent traversal', '../users'],
    ['leading slash', '/search'],
  ])('rejects a %s path with 400', async (_label, path) => {
    const res = await call({ body: { path } })
    expect(res.statusCode).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a method outside GET/POST/PATCH', async () => {
    const res = await call({ body: { path: 'pages/x', method: 'DELETE' } })
    expect(res.statusCode).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('treats an unparseable string body as empty, hence an invalid path', async () => {
    expect((await call({ body: 'not json' })).statusCode).toBe(400)
  })

  it('parses a JSON string body', async () => {
    const res = await call({ body: JSON.stringify({ path: 'search' }) })
    expect(res.statusCode).toBe(200)
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.notion.com/v1/search')
  })
})

describe('the relayed request', () => {
  it('sends the token as Bearer, pins the classic version and POSTs the JSON body', async () => {
    await call({ headers: { 'x-notion-token': 'abc' }, body: { path: 'databases/d/query', body: { page_size: 5 } } })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.notion.com/v1/databases/d/query')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({
      Authorization: 'Bearer abc',
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    })
    expect(init.body).toBe('{"page_size":5}')
  })

  it('honours only the two known versions', async () => {
    await call({ body: { path: 'file_uploads', version: '2025-09-03' } })
    await call({ body: { path: 'search', version: '1999-01-01' } })
    expect(fetchMock.mock.calls[0][1].headers['Notion-Version']).toBe('2025-09-03')
    expect(fetchMock.mock.calls[1][1].headers['Notion-Version']).toBe('2022-06-28')
  })

  it('uppercases the method, sends no body on GET, and PATCHes with one', async () => {
    await call({ body: { path: 'pages/x', method: 'get', body: { ignored: true } } })
    await call({ body: { path: 'pages/x', method: 'patch', body: { archived: true } } })
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET', body: undefined })
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'PATCH', body: '{"archived":true}' })
  })
})

describe('what comes back', () => {
  it('passes Notion\'s status and body through as JSON', async () => {
    fetchMock.mockImplementation(async () => new Response('{"object":"error","code":"rate_limited"}', { status: 429 }))
    const res = await call({ body: { path: 'search' } })
    expect(res.statusCode).toBe(429)
    expect(res.headers['Content-Type']).toBe('application/json')
    expect(res.body).toBe('{"object":"error","code":"rate_limited"}')
  })

  it('turns an empty upstream body into {}', async () => {
    fetchMock.mockImplementation(async () => new Response('', { status: 200 }))
    expect((await call({ body: { path: 'search' } })).body).toBe('{}')
  })

  it('turns a network failure into a 502 naming the cause', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'))
    const res = await call({ body: { path: 'search' } })
    expect(res.statusCode).toBe(502)
    expect(res.body.message).toContain('ECONNRESET')
  })
})
