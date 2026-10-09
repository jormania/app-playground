// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { recordUsage, usageSummary, costOf, monthKey } from './usage'
import { MODEL_HAIKU, MODEL_SONNET } from '../../shared/models.js'

beforeEach(() => localStorage.clear())

describe('what the curator has cost on this device', () => {
  it('adds up each response by month and model, at list prices', () => {
    const now = new Date('2026-10-09T10:00:00Z')
    recordUsage(MODEL_SONNET, { input_tokens: 10_000, output_tokens: 5_000 }, now)
    recordUsage(MODEL_HAIKU, { input_tokens: 4_000, output_tokens: 1_000, server_tool_use: { web_search_requests: 3 } }, now)
    const m = usageSummary(monthKey(now))
    expect(m.requests).toBe(2)
    // Sonnet: 0.02 + 0.05; Haiku: 0.0004 + 0.0005 + 3 searches at a cent.
    expect(m.dollars).toBeCloseTo(0.07 + 0.0009 + 0.03, 6)
  })

  it('prices cache reads and writes, and leaves an unknown model unpriced', () => {
    expect(costOf(MODEL_SONNET, { requests: 1, input: 0, output: 0, cacheRead: 1_000_000, cacheWrite: 1_000_000, searches: 0 })).toBeCloseTo(2.6)
    expect(costOf('claude-mystery-9', { requests: 1, input: 1, output: 1, cacheRead: 0, cacheWrite: 0, searches: 0 })).toBeNull()
  })

  it('shrugs off a missing usage object', () => {
    recordUsage(MODEL_HAIKU, undefined)
    expect(usageSummary().requests).toBe(1)
  })
})
