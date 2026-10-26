// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { recordUsage, usageSummary, costOf, monthKey, modelLabel, CATEGORIES, categoryOf } from './usage'
import { JOBS } from '../curator/curator'
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

  it('lists the models dearest first', () => {
    recordUsage(MODEL_HAIKU, { input_tokens: 1_000, output_tokens: 1_000 })
    recordUsage(MODEL_SONNET, { input_tokens: 1_000, output_tokens: 1_000 })
    expect(usageSummary().byModel.map((m) => m.model)).toEqual([MODEL_SONNET, MODEL_HAIKU])
  })

  it('names a model the way a person reads it', () => {
    expect(modelLabel(MODEL_SONNET)).toMatch(/^Sonnet \d+(\.\d+)*$/)
    expect(modelLabel(MODEL_HAIKU)).toMatch(/^Haiku \d+(\.\d+)*$/)
    expect(modelLabel('something-else')).toBe('something-else')
  })

  it('says what the month was for, by primary category, dearest first', () => {
    const now = new Date('2026-10-26T10:00:00Z')
    recordUsage(MODEL_SONNET, { input_tokens: 10_000, output_tokens: 5_000 }, now, 'programme')
    recordUsage(MODEL_SONNET, { input_tokens: 10_000, output_tokens: 1_000 }, now, 'themes')
    recordUsage(MODEL_HAIKU, { input_tokens: 4_000, output_tokens: 1_000 }, now, 'companion')
    const cats = usageSummary(monthKey(now)).byCategory
    expect(cats.map((c) => c.label)).toEqual(['Directions and programmes', 'Notes on the music'])
    expect(cats[0].requests).toBe(2)
    expect(cats[0].dollars).toBeCloseTo(0.07 + 0.03, 6)
  })

  it('puts requests made before jobs were counted on one line, so the parts add up', () => {
    const now = new Date('2026-10-26T10:00:00Z')
    recordUsage(MODEL_SONNET, { input_tokens: 10_000, output_tokens: 5_000 }, now)
    recordUsage(MODEL_HAIKU, { input_tokens: 4_000, output_tokens: 1_000 }, now, 'taste')
    const m = usageSummary(monthKey(now))
    expect(m.byCategory.map((c) => c.label)).toEqual(['Learning your taste', 'Earlier, before it was counted by job'])
    expect(m.byCategory.reduce((n, c) => n + c.requests, 0)).toBe(m.requests)
    expect(m.byCategory.reduce((n, c) => n + c.dollars, 0)).toBeCloseTo(m.dollars, 6)
  })

  it('files every curator job under a category; only the key test is "other"', () => {
    for (const op of Object.keys(JOBS)) {
      if (op === 'ping') expect(categoryOf(op)).toMatch(/^Other/)
      else expect(CATEGORIES.map((c) => c.label)).toContain(categoryOf(op))
    }
  })
})
