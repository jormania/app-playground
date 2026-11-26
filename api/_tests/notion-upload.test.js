// api/notion-upload.js re-wraps raw photo bytes as the multipart form Notion's
// /file_uploads/{id}/send requires. These tests pin the gates (method, origin, rate,
// token, upload id), the size and empty-body guards, the multipart re-wrap with the
// pinned Notion-Version, and what an upstream answer or failure turns into. The real
// _shared.js guards run — only fetch is stubbed.
//
// Lives in api/_tests/, not beside the handler: every api/*.js is a Vercel function.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import handler from '../notion-upload.js'

function makeRes() {
  const res = { statusCode: null, body: null, headers: {} }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (obj) => { res.body = obj; return res }
  res.send = (text) => { res.body = text; return res }
  res.setHeader = (k, v) => { res.headers[k] = v; return res }
  return res
}

const ID = 'abcdef12-3456-7890-abcd-ef1234567890'
let ipCounter = 0
// A fresh IP per call keeps the module-level rate limiter from leaking between tests.
function call({ method = 'POST', headers = {}, query = { id: ID }, bytes = [Buffer.from('jpegbytes')], ip } = {}) {
  const res = makeRes()
  const req = {
    method,
    query,
    headers: { 'x-notion-token': 'tok', 'x-forwarded-for': ip ?? `10.1.0.${++ipCounter}`, ...headers },
    async *[Symbol.asyncIterator]() { for (const b of bytes) yield b },
  }
  return handler(req, res).then(() => res)
}

let fetchMock
beforeEach(() => {
  fetchMock = vi.fn(async () => new Response('{"status":"uploaded"}', { status: 200 }))
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
    expect((await call({ headers: { origin: 'https://evil.example' } })).statusCode).toBe(403)
    expect((await call({ headers: { origin: 'http://localhost:5173' } })).statusCode).toBe(200)
    expect((await call({ headers: { origin: 'https://app.coneofcold.vercel.app' } })).statusCode).toBe(200)
  })

  it('answers 429 once one IP passes 20 calls in the window', async () => {
    const ip = '192.0.2.77'
    const codes = []
    for (let i = 0; i < 21; i++) codes.push((await call({ ip })).statusCode)
    expect(codes.slice(0, 20).every((c) => c === 200)).toBe(true)
    expect(codes[20]).toBe(429)
  })

  it('answers 401 without a token', async () => {
    const res = await call({ headers: { 'x-notion-token': '' } })
    expect(res.statusCode).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['missing', undefined],
    ['too short', 'abc'],
    ['path traversal', '../../users/me/aaaa'],
    ['array', [ID, ID]],
  ])('answers 400 for a %s upload id', async (_name, id) => {
    const res = await call({ query: id === undefined ? {} : { id } })
    expect(res.statusCode).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('body guards', () => {
  it('answers 400 for an empty upload', async () => {
    const res = await call({ bytes: [] })
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toMatch(/empty/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('answers 413 above 8 MiB, across chunks, and sends nothing', async () => {
    const chunk = Buffer.alloc(5 * 1024 * 1024)
    const res = await call({ bytes: [chunk, chunk] })
    expect(res.statusCode).toBe(413)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('accepts exactly 8 MiB', async () => {
    const res = await call({ bytes: [Buffer.alloc(8 * 1024 * 1024)] })
    expect(res.statusCode).toBe(200)
  })
})

describe('relay to Notion', () => {
  it('re-wraps the bytes as multipart to file_uploads/{id}/send with Bearer and pinned version', async () => {
    await call({
      bytes: [Buffer.from('jpeg'), Buffer.from('bytes')],
      headers: { 'content-type': 'image/jpeg', 'x-filename': encodeURIComponent('café photo.jpg') },
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`https://api.notion.com/v1/file_uploads/${ID}/send`)
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ Authorization: 'Bearer tok', 'Notion-Version': '2025-09-03' })
    const file = init.body.get('file')
    expect(file.name).toBe('café photo.jpg')
    expect(file.type).toBe('image/jpeg')
    expect(await file.text()).toBe('jpegbytes')
  })

  it('defaults the filename and content type, and survives a malformed x-filename', async () => {
    await call({})
    expect(fetchMock.mock.calls[0][1].body.get('file').name).toBe('photo.jpg')
    expect(fetchMock.mock.calls[0][1].body.get('file').type).toBe('application/octet-stream')
    await call({ headers: { 'x-filename': '%E0%A4%A' } })
    expect(fetchMock.mock.calls[1][1].body.get('file').name).toBe('photo.jpg')
  })

  it('passes Notion\'s status and body through as JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"object":"error","code":"validation_error"}', { status: 400 }))
    const res = await call({})
    expect(res.statusCode).toBe(400)
    expect(res.headers['Content-Type']).toBe('application/json')
    expect(res.body).toBe('{"object":"error","code":"validation_error"}')
  })

  it('turns an empty upstream body into {}', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }))
    expect((await call({})).body).toBe('{}')
  })

  it('answers 502 when Notion cannot be reached', async () => {
    fetchMock.mockRejectedValueOnce(new Error('socket hang up'))
    const res = await call({})
    expect(res.statusCode).toBe(502)
    expect(res.body.message).toContain('socket hang up')
  })
})
