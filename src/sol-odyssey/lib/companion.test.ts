import { describe, it, expect, vi } from 'vitest'
import {
  buildContractCompanionPrompt,
  buildDailyCompanionPrompt,
  buildLapseCompanionPrompt,
  buildWeeklyCompanionPrompt,
  requestCompanionReflection,
  verifyAnthropicKey,
} from './companion'
import type { OdysseyDetail } from './notion'
import { EMPTY_REFLECTION } from './reflections'
import type { CheckinRecord } from './checkins'

const odyssey: OdysseyDetail = {
  id: 'o1',
  title: 'Odyssey 1 — movement',
  number: 1,
  status: 'Active',
  startDate: '2026-07-06',
  endDate: '2026-08-16',
  behaviour: 'Move my body before the day takes me',
  identity: 'I am someone who starts the day in motion',
  tinyVersion: 'walk to the corner',
  anchor: 'after my first coffee',
  ifThen: 'if it rains, hallway',
  outcomePicture: 'steadier mind',
  pairing: '',
  dailySuccess: 'shoes on, outside',
  whyValue: 'a body in motion',
  commitment: '',
  outcome: '',
  notes: '',
}

const checkin: CheckinRecord = {
  id: 'c1',
  date: '2026-07-08',
  dayIndex: 3,
  done: true,
  oneLine: 'Slow start but I made it round the block',
  friction: 'wanted to stay in bed',
  sentToBuddy: false,
}

// Attribution canaries — names of well-known habit books/authors/programmes that must never
// surface (the method's source is never named). The prompt legitimately uses words like
// "therapist"/"replace" inside its OWN prohibitions, so those aren't part of this net.
const FORBIDDEN = ['atomic habits', 'tiny habits', 'james clear', 'bj fogg', 'charles duhigg', 'power of habit']

describe('buildDailyCompanionPrompt', () => {
  it('carries the person’s own words and the behaviour into the user message', () => {
    const { user } = buildDailyCompanionPrompt(odyssey, checkin)
    expect(user).toContain('Move my body before the day takes me')
    expect(user).toContain('Slow start but I made it round the block')
    expect(user).toContain('day 3')
  })

  it('the system prompt holds the role guardrails and names no source', () => {
    const { system } = buildDailyCompanionPrompt(odyssey, checkin)
    const lower = system.toLowerCase()
    expect(lower).toContain('witness')
    expect(lower).toContain('one') // at most one question
    expect(lower).toContain('buddy')
    for (const term of FORBIDDEN) expect(lower).not.toContain(term)
  })
})

describe('buildWeeklyCompanionPrompt', () => {
  it('summarises the week’s reflection draft', () => {
    const draft = { ...EMPTY_REFLECTION, daysDone: 5, fit: 'About right' as const, oneAdjustment: 'walk earlier', temperature: 6 }
    const { user, system } = buildWeeklyCompanionPrompt(odyssey, draft, 2)
    expect(user).toContain('week 2')
    expect(user).toContain('5 of 7')
    expect(user).toContain('walk earlier')
    expect(system).toBe(buildDailyCompanionPrompt(odyssey, checkin).system) // same role contract
  })
})

describe('commitment-device prompts', () => {
  const baseSystem = buildDailyCompanionPrompt(odyssey, checkin).system

  it('buildContractCompanionPrompt reflects on the drafted forfeit without proposing one', () => {
    const { user, system } = buildContractCompanionPrompt(odyssey, 'donate £20 and tell my buddy')
    expect(user).toContain('donate £20 and tell my buddy')
    expect(user.toLowerCase()).toContain('do not suggest a different consequence')
    expect(system).toBe(baseSystem) // same witness role contract
  })

  it('buildLapseCompanionPrompt surfaces the pledge kindly at the lapse', () => {
    const { user, system } = buildLapseCompanionPrompt(odyssey, 'cold shower, no excuses')
    expect(user).toContain('cold shower, no excuses')
    expect(user.toLowerCase()).toContain('rejoin')
    expect(system).toBe(baseSystem)
  })
})

describe('requestCompanionReflection', () => {
  const prompt = { system: 'sys', user: 'usr' }

  it('calls Anthropic directly with the key + direct-browser header, and returns the text', async () => {
    const fetchMock = vi.fn(async (..._a: unknown[]) =>
      new Response(JSON.stringify({ content: [{ text: '  You showed up anyway. What made it possible?  ' }] }), { status: 200 }),
    )
    const out = await requestCompanionReflection('sk-ant-xyz', prompt, fetchMock as unknown as typeof fetch)
    expect(out).toBe('You showed up anyway. What made it possible?')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    const headers = init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('sk-ant-xyz')
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('claude-haiku-4-5-20251001')
    expect(body.system).toBe('sys')
    expect(body.messages[0].content).toBe('usr')
  })

  it('maps a 401 to a key-specific friendly error', async () => {
    const fetchMock = vi.fn(async (..._a: unknown[]) => new Response('{}', { status: 401 }))
    await expect(
      requestCompanionReflection('bad', prompt, fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(/key/i)
  })

  it('refuses without a key (no network call)', async () => {
    const fetchMock = vi.fn()
    await expect(
      requestCompanionReflection('  ', prompt, fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(/key/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('verifyAnthropicKey', () => {
  it('resolves on a 200 and posts a minimal request with the key header', async () => {
    const fetchMock = vi.fn(async (..._a: unknown[]) => new Response('{}', { status: 200 }))
    await expect(verifyAnthropicKey('sk-ant-xyz', fetchMock as unknown as typeof fetch)).resolves.toBeUndefined()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('sk-ant-xyz')
    expect(JSON.parse(init.body as string).max_tokens).toBe(1)
  })

  it('rejects a bad key with a key-specific message', async () => {
    const fetchMock = vi.fn(async (..._a: unknown[]) => new Response('{}', { status: 401 }))
    await expect(verifyAnthropicKey('bad', fetchMock as unknown as typeof fetch)).rejects.toThrow(/key/i)
  })

  it('refuses an empty key without a network call', async () => {
    const fetchMock = vi.fn()
    await expect(verifyAnthropicKey('  ', fetchMock as unknown as typeof fetch)).rejects.toThrow(/key/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
