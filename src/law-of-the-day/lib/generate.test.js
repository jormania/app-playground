import { describe, it, expect, vi } from 'vitest'
import laws from '../data/laws.json'
import { generateFresh, generationRequest, testKey, validateGenerated, buildPrompt } from './generate'
import { MODEL_SONNET } from '../../shared/models.js'

// Law 1, "Never Outshine the Master": its distinctive words are outshine + master.
const law = laws.find((l) => l.id === 1)
const good = {
  scenarioText: 'A junior analyst rewrites the director’s keynote overnight and tells the whole floor it was mostly her work.',
  explanationText: 'Making a superior look small invites resentment; the law warns against it. Let those above you feel clever.',
}

function reply(content, stop = 'end_turn') {
  return new Response(JSON.stringify({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: content }], stop_reason: stop }), { status: 200 })
}

describe('generationRequest', () => {
  it('asks Sonnet for the two fields as structured JSON, with adaptive thinking', () => {
    const body = generationRequest('sys', [{ role: 'user', content: 'x' }])
    expect(body.model).toBe(MODEL_SONNET)
    expect(body.thinking).toEqual({ type: 'adaptive' })
    expect(body.output_config.format.type).toBe('json_schema')
    expect(body.output_config.format.schema.required).toEqual(['scenarioText', 'explanationText'])
  })

  it('names the title words the scenario must not use', () => {
    const { user } = buildPrompt(law, laws.slice(1, 4))
    expect(user).toMatch(/"outshine"/)
    expect(user).toMatch(/"master"/)
  })
})

describe('validateGenerated', () => {
  it('accepts a clean draft and rejects a leak, a short field, a missing field', () => {
    expect(validateGenerated(good, law)).toBeNull()
    expect(validateGenerated({ ...good, scenarioText: 'She tried to outshine her boss at every single meeting this year.' }, law)).toMatch(/outshine/)
    expect(validateGenerated({ ...good, explanationText: 'Too short.' }, law)).toMatch(/couple of full sentences/)
    expect(validateGenerated({ scenarioText: good.scenarioText }, law)).toMatch(/missing/)
  })
})

describe('generateFresh', () => {
  it('returns the fields from a clean first draft, sending the key straight to Anthropic', async () => {
    const fetchImpl = vi.fn(async () => reply(JSON.stringify(good)))
    expect(await generateFresh(' sk-ant-key ', law, laws, { fetchImpl })).toEqual(good)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.headers['x-api-key']).toBe('sk-ant-key')
  })

  it('answers a leaking draft once with what was wrong, appended to the conversation', async () => {
    const leaky = { ...good, scenarioText: 'He kept trying to outshine the master craftsman in front of every client who came in.' }
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(reply(JSON.stringify(leaky)))
      .mockResolvedValueOnce(reply(JSON.stringify(good)))
    expect(await generateFresh('k', law, laws, { fetchImpl })).toEqual(good)
    const second = JSON.parse(fetchImpl.mock.calls[1][1].body)
    expect(second.messages).toHaveLength(3)
    expect(second.messages[2].content).toMatch(/rejected.*outshine/)
  })

  it('gives up (null, so the bundled text shows) after two bad drafts, an error, a refusal or no network', async () => {
    const bad = { ...good, explanationText: 'Short.' }
    expect(await generateFresh('k', law, laws, { fetchImpl: vi.fn(async () => reply(JSON.stringify(bad))) })).toBeNull()
    expect(await generateFresh('k', law, laws, { fetchImpl: vi.fn(async () => new Response('{}', { status: 401 })) })).toBeNull()
    expect(await generateFresh('k', law, laws, { fetchImpl: vi.fn(async () => reply('', 'refusal')) })).toBeNull()
    expect(await generateFresh('k', law, laws, { fetchImpl: vi.fn(async () => { throw new TypeError('offline') }) })).toBeNull()
  })

  it('makes no request without a key', async () => {
    const fetchImpl = vi.fn()
    expect(await generateFresh('  ', law, laws, { fetchImpl })).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('testKey', () => {
  it('says ok, or why not, in words a person can act on', async () => {
    expect(await testKey('k', { fetchImpl: async () => new Response('{}', { status: 200 }) })).toBe('ok')
    expect(await testKey('k', { fetchImpl: async () => new Response('{}', { status: 401 }) })).toMatch(/didn’t accept/)
    expect(await testKey('k', { fetchImpl: async () => { throw new TypeError('x') } })).toMatch(/No connection/)
    expect(await testKey('')).toMatch(/Add a key/)
  })
})
