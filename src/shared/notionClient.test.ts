import { describe, it, expect, vi, afterEach } from 'vitest'
import { notionProxy, PROXY_URL } from './notionClient'

// The relay call was copied into twelve app clients and, outside Sol Odyssey's
// own relay module, none of them tested it — every client injects a fetchImpl
// for its tests, so the real fetch path never ran. These cover it once.
afterEach(() => { vi.unstubAllGlobals() })

const respond = (ok: boolean, body: unknown, status = ok ? 200 : 400) => {
  const fetchMock = vi.fn(async () => ({
    ok,
    status,
    json: async () => {
      if (body === undefined) throw new Error('not JSON')
      return body
    },
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('notionProxy', () => {
  it('POSTs the call through the same-origin relay with the caller-supplied token', async () => {
    const fetchMock = respond(true, { results: [] })

    await notionProxy('secret-token', 'databases/abc/query', 'POST', { page_size: 100 })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(PROXY_URL)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['x-notion-token']).toBe('secret-token')
    expect(JSON.parse(init.body as string)).toEqual({
      path: 'databases/abc/query',
      method: 'POST',
      body: { page_size: 100 },
    })
  })

  it('omits version entirely when the caller does not pass one', async () => {
    // This is what lets the clients that passed a version and the clients that
    // did not share one function: undefined never survives JSON.stringify.
    const fetchMock = respond(true, {})

    await notionProxy('tok', 'pages/abc', 'GET')

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect('version' in body).toBe(false)
  })

  it('passes a version through when there is one', async () => {
    const fetchMock = respond(true, {})

    await notionProxy('tok', 'pages/abc', 'GET', undefined, '2022-06-28')

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.version).toBe('2022-06-28')
  })

  it('returns the parsed body on success', async () => {
    respond(true, { results: [{ id: 'page-1' }] })
    await expect(notionProxy('tok', 'x', 'POST')).resolves.toEqual({ results: [{ id: 'page-1' }] })
  })

  it("throws with Notion's own message when the relay reports a failure", async () => {
    respond(false, { message: 'Could not find database with ID: abc' })
    await expect(notionProxy('tok', 'x', 'POST')).rejects.toThrow('Could not find database with ID: abc')
  })

  it('falls back to `error` when there is no `message`', async () => {
    respond(false, { error: 'unauthorized' })
    await expect(notionProxy('tok', 'x', 'POST')).rejects.toThrow('unauthorized')
  })

  it('falls back to the status code when the error body is not JSON at all', async () => {
    // A gateway timeout or an HTML error page — the parse must not become the
    // error the caller sees, or the real status is lost.
    respond(false, undefined, 504)
    await expect(notionProxy('tok', 'x', 'POST')).rejects.toThrow('Notion request failed (504)')
  })
})
