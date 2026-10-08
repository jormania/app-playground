// The live API check: every app's real Claude request, sent once to the real API.
//
// Every other test here fakes fetch, so none of them can see the one failure a
// model upgrade actually brings — a request shape the new model rejects with a
// 400 (Sonnet 5.5 refusing `thinking: disabled` was the last one). This file
// calls each app's own request function, lets its body go out unchanged apart
// from a cap on max_tokens, and fails on any response the API refuses.
//
// Not part of `npm test`: it needs a key and costs a little (a few cents a run).
// Run it with `ANTHROPIC_API_KEY=… npm run test:live`; CI runs it from
// .github/workflows/ai-models.yml. See AI_MODELS.md.
//
// The inputs are minimal on purpose. What is under test is whether the API
// accepts the request, not whether the reply is any good, so an app handing
// back null or its fallback afterwards is fine — only the status counts.

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../src/shared/photo.ts', async (orig) => ({
  ...(await orig()),
  // No canvas in Node; the fixture is already a small JPEG.
  resizePhoto: async (blob) => blob,
}))

const KEY = process.env.ANTHROPIC_API_KEY ?? ''
const ENDPOINT = 'https://api.anthropic.com/v1/messages'
/** Enough for a thinking model to answer at all; keeps a run to cents. */
const MAX_TOKENS_CAP = 1024

// 8×8-ish JPEG, flat green — enough for the vision calls to be well-formed.
const JPEG_B64 =
  '/9j/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAQABADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwC4CeO//9k='
const jpeg = () => new Blob([Buffer.from(JPEG_B64, 'base64')], { type: 'image/jpeg' })

const realFetch = globalThis.fetch
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** What went out and what came back, per case. */
let sent = []

/**
 * Stands in for fetch: sends the app's own body to the real API (whatever
 * endpoint or proxy the app named), with max_tokens capped and the test key.
 * Retries a 429 or 5xx twice, since those say nothing about the request.
 */
async function tap(url, init = {}) {
  const body = JSON.parse(init.body)
  body.max_tokens = Math.min(body.max_tokens ?? MAX_TOKENS_CAP, MAX_TOKENS_CAP)
  const headers = new Headers(init.headers)
  headers.set('x-api-key', KEY)
  let res
  for (let i = 0; i < 3; i++) {
    res = await realFetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body) })
    if (res.status !== 429 && res.status < 500) break
    await sleep(2000 * 2 ** i)
  }
  const detail = res.ok ? '' : (await res.clone().text()).slice(0, 400)
  sent.push({ url: String(url), model: body.model, status: res.status, detail })
  return res
}

/** Run one app call with `tap` as the global fetch too, for apps that don't take one. */
async function through(fn) {
  sent = []
  globalThis.fetch = tap
  try {
    await fn(tap)
  } catch {
    // An app throwing after a refusal is expected; the statuses below say why.
  } finally {
    globalThis.fetch = realFetch
  }
  return sent
}

function expectAccepted(calls) {
  expect(calls.length, 'the app made no request at all').toBeGreaterThan(0)
  for (const c of calls) {
    expect(c.status, `${c.model} via ${c.url} → ${c.status} ${c.detail}`).toBeLessThan(400)
  }
}

beforeAll(() => {
  if (!KEY) throw new Error('Set ANTHROPIC_API_KEY to run the live API check (see AI_MODELS.md).')
})
afterEach(() => {
  globalThis.fetch = realFetch
})

// Each case: an app's request, built by the app's own code.
const CASES = {
  'Daily Stoic — mentor reply': async (f) => {
    const { requestMentor } = await import('../src/daily-stoic/lib/mentor.ts')
    await requestMentor(KEY, { system: 'You are a Stoic mentor. One sentence.', user: 'I skipped my walk.' }, f)
  },
  'Daily Stoic — key test': async (f) => {
    const { verifyAnthropicKey } = await import('../src/daily-stoic/lib/mentor.ts')
    await verifyAnthropicKey(KEY, f)
  },
  'Lexi5 — AI Curation on Haiku': async (f) => {
    const { curationRequest } = await import('../src/lexi5/lib/curate.js')
    const { MODEL_HAIKU } = await import('../src/shared/models.js')
    await f('/api/anthropic-proxy/v1/messages', {
      method: 'POST',
      headers: { 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(curationRequest({ model: MODEL_HAIKU, wordCount: 10, theme: 'weather' })),
    })
  },
  'Lexi5 — AI Curation on Sonnet': async (f) => {
    const { curationRequest } = await import('../src/lexi5/lib/curate.js')
    const { MODEL_SONNET } = await import('../src/shared/models.js')
    await f('/api/anthropic-proxy/v1/messages', {
      method: 'POST',
      headers: { 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(curationRequest({ model: MODEL_SONNET, wordCount: 10, theme: 'weather' })),
    })
  },
  'Law of the Day — scenario generation': async (f) => {
    const { generationRequest } = await import('../api/generate-law-of-the-day.js')
    await f(ENDPOINT, {
      method: 'POST',
      headers: { 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(generationRequest('Write a short workplace scenario as JSON.', [{ role: 'user', content: 'Law 1: never outshine the master.' }])),
    })
  },
  // One case per curator job: each has its own json_schema, and a schema the
  // API's structured outputs reject is a 400 only the real API can show.
  ...Object.fromEntries(['themes', 'programme', 'taste', 'continuity', 'explain', 'compare'].map((op) => [
    `The Long Listen — ${op}`,
    async (f) => {
      const { curatorBody, CURATOR_BETAS } = await import('../api/_lib/longListen/curator.js')
      await f(ENDPOINT, {
        method: 'POST',
        headers: { 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-beta': CURATOR_BETAS.join(',') },
        body: JSON.stringify(curatorBody(op, 'Reply with the smallest valid JSON for the schema. Context: {}')),
      })
    },
  ])),
  'The Long Listen — resources (web search)': async (f) => {
    const { resourcesBody, CURATOR_BETAS } = await import('../api/_lib/longListen/curator.js')
    await f(ENDPOINT, {
      method: 'POST',
      headers: { 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-beta': CURATOR_BETAS.join(',') },
      body: JSON.stringify(resourcesBody('Find one programme note for Debussy, La mer.')),
    })
  },
  'KeyPath — key test': async (f) => {
    const { testAiKey } = await import('../src/keypath/app/ai.ts')
    await testAiKey(KEY, f)
  },
  'KeyPath — coach note': async (f) => {
    const { askCoach } = await import('../src/keypath/app/songs/coach.ts')
    const { songOf } = await import('../src/keypath/engine/testing/songs.ts')
    const song = songOf([[60, 0], [62, 500], [64, 1000], [65, 1500]], 'Little Tune')
    const facts = { song: 'Little Tune', hands: 'right', mode: 'running', speedPercent: 75, stars: 2, notesPlayed: 3, notesInSong: 4, missed: 1, wrongKeys: 0, troubleBars: [], swaps: [], earlier: [] }
    await askCoach(KEY, facts, 'en', song, undefined, f)
  },
  'KeyPath — weekly note': async (f) => {
    const { askWeekly } = await import('../src/keypath/app/progress/weekly.ts')
    await askWeekly(KEY, { days: 2, minutes: 30, songs: ['Little Tune'], stars: 5 }, 'en', { fetchImpl: f })
  },
  'KeyPath — Studio answer (Sonnet)': async (f) => {
    const { askAnswer, callOf } = await import('../src/keypath/app/studio/answer.ts')
    const notes = [60, 62, 64, 65, 67].map((pitch, i) => ({ pitch, velocity: 80, startMs: i * 500, durationMs: 400 }))
    await askAnswer(KEY, callOf({ notes, durationMs: 2500, bpm: 120 }), 'en', { fetchImpl: f })
  },
  'Silva — photo OCR': async () => {
    const { ocrPhoto } = await import('../src/silva/lib/ocr.ts')
    await ocrPhoto(KEY, jpeg())
  },
  'Silva — tension check': async () => {
    const { confirmTension } = await import('../src/silva/lib/tension.ts')
    const thing = (id, body) => ({ id, handle: id, body, kind: 'note', source: '', tags: [], created: '2026-09-01' })
    await confirmTension(KEY, thing('a', 'Walk slowly.'), thing('b', 'Always hurry.'))
  },
  'Fit Check — photo tagging': async () => {
    const { suggestTags } = await import('../src/fit-check/lib/tagging.ts')
    await suggestTags(KEY, jpeg())
  },
  'WhereItWent — text entry': async () => {
    const { parseTextWithAI } = await import('../src/where-it-went/lib/aiParser.js')
    const accounts = [{ id: 'acc-1', name: 'Cash', currency: 'RON', active: true }]
    const categories = [{ id: 'cat-1', name: 'Food', type: 'expense', active: true }]
    await parseTextWithAI('pizza 45 lei', accounts, categories, [], KEY)
  },
  'WhereItWent — insights': async () => {
    const { askInsightsAI } = await import('../src/where-it-went/lib/aiParser.js')
    await askInsightsAI('What did I spend most on?', [], [{ id: 'cat-1', name: 'Food', active: true }], KEY)
  },
  'Sol Odyssey — companion': async (f) => {
    const { requestCompanionReflection } = await import('../src/sol-odyssey/lib/companion.ts')
    await requestCompanionReflection(KEY, { system: 'One warm sentence.', user: 'Day 3 done.' }, f)
  },
  'Sol Odyssey — key test': async (f) => {
    const { verifyAnthropicKey } = await import('../src/sol-odyssey/lib/companion.ts')
    await verifyAnthropicKey(KEY, f)
  },
  'Touch Grass — discovery': async () => {
    const { generateDiscovery } = await import('../src/touch-grass/engine.js')
    await generateDiscovery('common', 20, KEY, {})
  },
  'Touch Grass — departure threshold': async () => {
    const { fetchThreshold } = await import('../src/touch-grass/DeparturePanel.jsx')
    await fetchThreshold(KEY, {}, 'almanac')
  },
}

describe('live API: every app request is accepted', () => {
  for (const [name, run] of Object.entries(CASES)) {
    it(name, async () => {
      expectAccepted(await through(run))
    }, 90_000)
  }
})
