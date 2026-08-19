import { describe, it, expect, vi } from 'vitest'
import { anthropicHeaders, requestAnthropic, extractAnthropicText, ANTHROPIC_ENDPOINT } from './anthropic'

describe('anthropicHeaders', () => {
  it('carries the key, version, and browser-access opt-in', () => {
    const headers = anthropicHeaders('sk-ant-test')
    expect(headers['x-api-key']).toBe('sk-ant-test')
    expect(headers['anthropic-version']).toBe('2023-06-01')
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true')
  })
})

describe('requestAnthropic', () => {
  it('POSTs to the default endpoint with the headers and body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}'))
    await requestAnthropic('sk-ant-test', { model: 'x', messages: [] }, { fetchImpl })
    expect(fetchImpl).toHaveBeenCalledWith(
      ANTHROPIC_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'sk-ant-test' }),
        body: JSON.stringify({ model: 'x', messages: [] }),
      }),
    )
  })

  it('POSTs to a caller-supplied endpoint instead (e.g. a proxy)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}'))
    await requestAnthropic('sk-ant-test', {}, { fetchImpl, endpoint: '/api/anthropic-proxy/v1/messages' })
    expect(fetchImpl).toHaveBeenCalledWith('/api/anthropic-proxy/v1/messages', expect.anything())
  })
})

describe('extractAnthropicText', () => {
  it('joins text blocks', () => {
    const payload = { content: [{ type: 'text', text: 'Hello' }, { type: 'text', text: ', world' }] }
    expect(extractAnthropicText(payload)).toBe('Hello, world')
  })

  it('returns empty string for a missing or malformed content array', () => {
    expect(extractAnthropicText({})).toBe('')
    expect(extractAnthropicText({ content: 'not an array' })).toBe('')
    expect(extractAnthropicText(null)).toBe('')
  })

  it('skips non-text blocks', () => {
    const payload = { content: [{ type: 'tool_use' }, { type: 'text', text: 'ok' }] }
    expect(extractAnthropicText(payload)).toBe('ok')
  })
})
