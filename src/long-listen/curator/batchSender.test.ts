import { describe, expect, it, vi } from 'vitest'
import { BATCHES_ENDPOINT, batchSender } from './batchSender'

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

/** A fake Batches API: answers each request with its own body's `tag`, or errors the ones asked to. */
function fakeApi({ fail = new Set<string>(), polls = 1 } = {}) {
  const created: Record<string, any>[] = []
  let left = polls
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url)
    if (u === BATCHES_ENDPOINT && init?.method === 'POST') {
      const body = JSON.parse(String(init.body))
      created.push(body)
      left = polls
      return json({ id: `batch_${created.length}`, processing_status: 'in_progress' })
    }
    if (u.endsWith('/results')) {
      const last = created[created.length - 1]
      const lines = last.requests.map((r: any) => JSON.stringify(fail.has(r.params.tag)
        ? { custom_id: r.custom_id, result: { type: 'errored', error: { type: 'invalid_request' } } }
        : { custom_id: r.custom_id, result: { type: 'succeeded', message: { content: [{ type: 'text', text: r.params.tag }] } } }))
      // Results come back in any order.
      return new Response(lines.reverse().join('\n') + '\n', { status: 200 })
    }
    left -= 1
    return json({ id: `batch_${created.length}`, processing_status: left > 0 ? 'in_progress' : 'ended' })
  })
  return { fetchImpl: fetchImpl as unknown as typeof fetch, created, fetchImpl_: fetchImpl }
}

const opts = (fetchImpl: typeof fetch) => ({ fetchImpl, gatherMs: 5, pollMs: 1 })

describe('batchSender', () => {
  it('sends requests made together as one batch and gives each caller its own answer', async () => {
    const api = fakeApi({ polls: 2 })
    const send = batchSender('sk-ant-test', opts(api.fetchImpl))
    const answers = await Promise.all(['a', 'b', 'c'].map((tag) => send({ tag })))
    expect(api.created).toHaveLength(1)
    expect(api.created[0].requests.map((r: any) => r.params.tag)).toEqual(['a', 'b', 'c'])
    expect(answers.map((m) => m.content[0].text)).toEqual(['a', 'b', 'c'])
  })

  it('sends a later step as its own batch', async () => {
    const api = fakeApi()
    const send = batchSender('sk-ant-test', opts(api.fetchImpl))
    await Promise.all([send({ tag: 'a' }), send({ tag: 'b' })])
    await send({ tag: 'c' })
    expect(api.created.map((b) => b.requests.length)).toEqual([2, 1])
  })

  it('rejects only the request that errored', async () => {
    const api = fakeApi({ fail: new Set(['bad']) })
    const send = batchSender('sk-ant-test', opts(api.fetchImpl))
    const [ok, bad] = await Promise.allSettled([send({ tag: 'ok' }), send({ tag: 'bad' })])
    expect(ok.status).toBe('fulfilled')
    expect(bad.status).toBe('rejected')
    expect(String((bad as PromiseRejectedResult).reason)).toMatch(/errored.*invalid_request/)
  })

  it('rejects every waiting caller when the batch cannot be sent', async () => {
    const fetchImpl = vi.fn(async () => new Response('limit reached', { status: 400 })) as unknown as typeof fetch
    const send = batchSender('sk-ant-test', opts(fetchImpl))
    const results = await Promise.allSettled([send({ tag: 'a' }), send({ tag: 'b' })])
    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    expect(String((results[0] as PromiseRejectedResult).reason)).toMatch(/Batches API 400: limit reached/)
  })

  it('sends the key and the API version', async () => {
    const api = fakeApi()
    await batchSender('sk-ant-test', opts(api.fetchImpl))({ tag: 'a' })
    const headers = (api.fetchImpl_.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers['x-api-key']).toBe('sk-ant-test')
    expect(headers['anthropic-version']).toBeTruthy()
  })
})
