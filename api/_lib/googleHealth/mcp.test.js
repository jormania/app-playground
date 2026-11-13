import { describe, it, expect, vi } from 'vitest'
import { handleMcpMessage, TOOLS, SUPPORTED_VERSIONS } from './mcp.js'
import { HealthError } from './client.js'

const rpc = (method, params, id = 1) => ({ jsonrpc: '2.0', id, method, params })

describe('MCP handshake', () => {
  it('echoes a supported protocol version and offers tools only', async () => {
    const r = await handleMcpMessage(rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't' } }))
    expect(r.result.protocolVersion).toBe('2025-06-18')
    expect(r.result.capabilities).toEqual({ tools: { listChanged: false } })
    expect(r.result.instructions).toMatch(/not medical/i)
  })

  it('answers an unknown version with its newest', async () => {
    const r = await handleMcpMessage(rpc('initialize', { protocolVersion: '1999-01-01' }))
    expect(r.result.protocolVersion).toBe(SUPPORTED_VERSIONS[0])
  })

  it('treats a message without an id as a notification', async () => {
    expect(await handleMcpMessage({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull()
  })

  it('rejects malformed messages and unknown methods', async () => {
    expect((await handleMcpMessage({ id: 1, method: 'ping' })).error.code).toBe(-32600)
    expect((await handleMcpMessage(rpc('resources/list'))).error.code).toBe(-32601)
    expect((await handleMcpMessage(rpc('ping'))).result).toEqual({})
  })
})

describe('tools', () => {
  it('lists every tool as read-only, without the internal runner', async () => {
    const r = await handleMcpMessage(rpc('tools/list'))
    expect(r.result.tools.map((t) => t.name)).toEqual(TOOLS.map((t) => t.name))
    for (const t of r.result.tools) {
      expect(t.run).toBeUndefined()
      expect(t.annotations.readOnlyHint).toBe(true)
      expect(t.inputSchema.type).toBe('object')
    }
  })

  it('runs a tool and returns its data as text', async () => {
    const q = { getSleep: vi.fn(async () => [{ date: '2026-11-04', minutesAsleep: 402 }]) }
    const r = await handleMcpMessage(rpc('tools/call', { name: 'get_sleep', arguments: { from: '2026-11-01', to: '2026-11-04' } }), q)
    expect(q.getSleep).toHaveBeenCalledWith('2026-11-01', '2026-11-04')
    expect(JSON.parse(r.result.content[0].text)).toEqual([{ date: '2026-11-04', minutesAsleep: 402 }])
    expect(r.result.isError).toBeUndefined()
  })

  it('applies documented defaults', async () => {
    const q = { getHeartRate: vi.fn(async () => []) }
    await handleMcpMessage(rpc('tools/call', { name: 'get_heart_rate', arguments: { start: 'a', end: 'b' } }), q)
    expect(q.getHeartRate).toHaveBeenCalledWith('a', 'b', 15)
  })

  it('reports missing arguments and API failures as tool errors the model can read', async () => {
    const missing = await handleMcpMessage(rpc('tools/call', { name: 'get_sleep', arguments: { from: '2026-11-01' } }), {})
    expect(missing.result).toMatchObject({ isError: true })
    expect(missing.result.content[0].text).toMatch(/to/)

    const q = { getDaily: async () => { throw new HealthError('Google ended the connection. Reconnect on /google-health.html.', 409, 'reconnect') } }
    const failed = await handleMcpMessage(rpc('tools/call', { name: 'get_daily_summary', arguments: { from: '2026-11-01', to: '2026-11-02' } }), q)
    expect(failed.result.isError).toBe(true)
    expect(failed.result.content[0].text).toMatch(/Reconnect/)
  })

  it('says so for an unknown tool', async () => {
    expect((await handleMcpMessage(rpc('tools/call', { name: 'delete_everything' }))).error.code).toBe(-32602)
  })
})
