import { describe, it, expect, vi, afterEach } from 'vitest'
// @ts-expect-error — api/notion.js is a plain-JS serverless function with no type decls.
import handler from '../../../api/notion.js'

/** Capture what the serverless handler writes back. */
function mockRes() {
  const res: {
    statusCode: number
    headers: Record<string, string>
    body: unknown
    status: (c: number) => typeof res
    json: (b: unknown) => void
    send: (b: unknown) => void
    setHeader: (k: string, v: string) => void
  } = {
    statusCode: 0,
    headers: {},
    body: undefined,
    status(c) {
      this.statusCode = c
      return this
    },
    json(b) {
      this.body = b
    },
    send(b) {
      this.body = b
    },
    setHeader(k, v) {
      this.headers[k] = v
    },
  }
  return res
}

const req = (over: Record<string, unknown> = {}) => ({
  method: 'POST',
  headers: { 'x-notion-token': 't' },
  body: { path: 'data_sources/x/query', method: 'POST', body: {} },
  ...over,
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('api/notion relay', () => {
  it('405s on non-POST', async () => {
    const res = mockRes()
    await handler(req({ method: 'GET' }), res)
    expect(res.statusCode).toBe(405)
  })

  it('401s when the token header is missing', async () => {
    const res = mockRes()
    await handler(req({ headers: {} }), res)
    expect(res.statusCode).toBe(401)
  })

  it('400s on a traversal / absolute path', async () => {
    const a = mockRes()
    await handler(req({ body: { path: '../secrets' } }), a)
    expect(a.statusCode).toBe(400)
    const b = mockRes()
    await handler(req({ body: { path: '/v1/users' } }), b)
    expect(b.statusCode).toBe(400)
  })

  it('400s on a disallowed method', async () => {
    const res = mockRes()
    await handler(req({ body: { path: 'x', method: 'DELETE' } }), res)
    expect(res.statusCode).toBe(400)
  })

  it('forwards an allowed request to Notion with the classic API version', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = mockRes()
    await handler(req(), res)
    expect(res.statusCode).toBe(200)
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as { headers: Record<string, string> }
    expect(init.headers['Notion-Version']).toBe('2022-06-28')
    expect(init.headers['Authorization']).toBe('Bearer t')
  })
})
