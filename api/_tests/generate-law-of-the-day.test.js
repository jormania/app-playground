// The repo's only consumer of @anthropic-ai/sdk, and until now the only api/
// handler with no test at all — so a version bump of that SDK was proven by
// nothing but the suite staying green somewhere else entirely. These tests run
// the *real* SDK against a stubbed global fetch, so what they pin is the wire
// call it actually builds: the endpoint, the auth and version headers, and the
// body this handler depends on (adaptive thinking + a json_schema output_config).
// A future bump that changes any of those fails here rather than at 03:00 UTC
// in a Vercel cron nobody is watching.
//
// It lives under api/_tests/ rather than beside the handler because **every
// api/*.js file is a Vercel serverless function**, test files included, and the
// repo sits at the cap of twelve. Paths under api/_* are excluded from that count.
//
// The clock is frozen, deliberately: getGeneratorLawId() defaults to the real
// `new Date()`, so which law is generated — and therefore which words count as
// a leak — walks with the calendar. That is the shape R-013 and R-018 swept for.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@vercel/blob', () => ({
  put: vi.fn(async (path) => ({ url: `https://blob.example/${path}` })),
}))

const { default: handler } = await import('../generate-law-of-the-day.js')
const { put } = await import('@vercel/blob')

// Day 0 of the generator's epoch (Date.UTC(2026, 0, 1)) => law id 1,
// "Never Outshine the Master". Its distinctive words are outshine + master.
const FROZEN = new Date('2026-01-01T09:00:00Z')
const LAW_ID = 1

const SECRET = 'cron-secret'

/** Minimal stand-in for Vercel's res — records what the handler answered. */
function makeRes() {
  const res = { statusCode: null, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (obj) => { res.body = obj; return res }
  return res
}

function call({ method = 'GET', headers = { authorization: `Bearer ${SECRET}` } } = {}) {
  const res = makeRes()
  return handler({ method, headers }, res).then(() => res)
}

/** A Messages API 200, carrying `text` as its single text block. */
function messageResponse(text) {
  return new Response(
    JSON.stringify({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-5',
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 20 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

const CLEAN = JSON.stringify({
  scenarioText: 'A junior designer redraws her lead’s slide deck the night before the board sees it, and presents the new version herself. Everyone applauds the work. By the next quarter she is off the account with no explanation anyone will put in writing.',
  explanationText: 'This is the first law of power at work: making a superior feel eclipsed turns competence into a threat. The safest play was to hand the improved deck to her lead and let the credit flow upward, where it buys protection.',
})

const LEAKY = JSON.stringify({
  scenarioText: 'A junior designer tries to outshine her lead in front of the board, rebuilding his deck overnight and presenting it herself to loud applause from the room.',
  explanationText: 'Making a superior feel eclipsed turns competence into a threat, which is why the credit was safer handed upward than kept.',
})

/** The parsed JSON body of the nth fetch the SDK made. */
const sentBody = (n) => JSON.parse(globalThis.fetch.mock.calls[n][1].body)

let env
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FROZEN)
  env = { ...process.env }
  process.env.CRON_SECRET = SECRET
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
  put.mockClear()
  globalThis.fetch = vi.fn()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  process.env = env
})

describe('the gate in front of the API key', () => {
  it('refuses anything but GET before looking at the secret', async () => {
    const res = await call({ method: 'POST', headers: {} })
    expect(res.statusCode).toBe(405)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('refuses a caller whose bearer token does not match CRON_SECRET', async () => {
    const res = await call({ headers: { authorization: 'Bearer wrong' } })
    expect(res.statusCode).toBe(401)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  // Otherwise an unset CRON_SECRET would make `Bearer undefined` the password.
  it('refuses everyone when CRON_SECRET is not set at all', async () => {
    delete process.env.CRON_SECRET
    const res = await call({ headers: { authorization: 'Bearer undefined' } })
    expect(res.statusCode).toBe(401)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})

describe('the call the SDK builds', () => {
  beforeEach(() => {
    globalThis.fetch.mockImplementation(async () => messageResponse(CLEAN))
  })

  it('POSTs the Messages endpoint with the key and version headers', async () => {
    await call()
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const [url, init] = globalThis.fetch.mock.calls[0]
    expect(String(url)).toBe('https://api.anthropic.com/v1/messages')
    expect(String(init.method).toUpperCase()).toBe('POST')
    const headers = new Headers(init.headers)
    expect(headers.get('x-api-key')).toBe('sk-ant-test')
    expect(headers.get('anthropic-version')).toBe('2023-06-01')
  })

  it('sends the model, adaptive thinking and the json_schema output_config', async () => {
    await call()
    const body = sentBody(0)
    expect(body.model).toBe('claude-sonnet-5')
    expect(body.max_tokens).toBe(2000)
    expect(body.thinking).toEqual({ type: 'adaptive' })
    expect(body.output_config.format.type).toBe('json_schema')
    expect(body.output_config.format.schema.required).toEqual(['scenarioText', 'explanationText'])
    expect(body.output_config.format.schema.additionalProperties).toBe(false)
  })

  it('names the chosen law in the prompt and forbids its distinctive words', async () => {
    await call()
    const body = sentBody(0)
    expect(body.system).toMatch(/48 Laws of Power/)
    expect(body.messages).toHaveLength(1)
    expect(body.messages[0].content).toMatch(/Never Outshine the Master/)
    expect(body.messages[0].content).toMatch(/"outshine", "master"/)
  })
})

describe('what it stores', () => {
  it('writes the generation to a stable blob path and answers with its url', async () => {
    globalThis.fetch.mockImplementation(async () => messageResponse(CLEAN))
    const res = await call()

    expect(put).toHaveBeenCalledTimes(1)
    const [path, payload, opts] = put.mock.calls[0]
    expect(path).toBe(`law-of-the-day/${LAW_ID}.json`)
    expect(JSON.parse(payload)).toEqual({
      lawId: LAW_ID,
      ...JSON.parse(CLEAN),
      generatedAt: FROZEN.toISOString(),
    })
    // Overwriting in place is the whole point — the client fetches a fixed path.
    expect(opts).toMatchObject({ access: 'public', addRandomSuffix: false, allowOverwrite: true })

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ lawId: LAW_ID, url: `https://blob.example/law-of-the-day/${LAW_ID}.json` })
  })
})

describe('the leak-check retry', () => {
  it('feeds a leaking draft back and stores the corrected one', async () => {
    globalThis.fetch
      .mockImplementationOnce(async () => messageResponse(LEAKY))
      .mockImplementationOnce(async () => messageResponse(CLEAN))

    const res = await call()
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)

    // The retry is a real conversational turn, not a bare re-ask: the rejected
    // draft and the specific reason both go back up.
    const second = sentBody(1).messages
    expect(second).toHaveLength(3)
    expect(second[1]).toEqual({ role: 'assistant', content: LEAKY })
    expect(second[2].role).toBe('user')
    expect(second[2].content).toMatch(/leaked these forbidden title words: outshine/)

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(put.mock.calls[0][1]).scenarioText).toBe(JSON.parse(CLEAN).scenarioText)
  })

  it('gives up after two attempts rather than storing a leak', async () => {
    globalThis.fetch.mockImplementation(async () => messageResponse(LEAKY))
    const res = await call()
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(put).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(502)
    expect(res.body.message).toMatch(/No valid generation after 2 attempts/)
  })

  it('rejects a draft too short to be a couple of sentences', async () => {
    globalThis.fetch.mockImplementation(async () =>
      messageResponse(JSON.stringify({ scenarioText: 'Too short.', explanationText: 'Also short.' })),
    )
    const res = await call()
    expect(put).not.toHaveBeenCalled()
    expect(res.body.message).toMatch(/at least a couple of full sentences/)
  })
})

describe('when the API says no', () => {
  it('answers 502 rather than throwing, and stores nothing', async () => {
    globalThis.fetch.mockImplementation(async () =>
      new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'bad model' } }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const res = await call()
    expect(res.statusCode).toBe(502)
    expect(res.body.message).toMatch(/Generation failed:/)
    expect(put).not.toHaveBeenCalled()
  })
})
