import { describe, expect, it } from 'vitest'
import { memoryStore } from '../store'
import { JourneyRepo, stateOf } from './progress'

describe('Journey progress', () => {
  it('opens the first step not done and locks the rest', () => {
    expect(stateOf({}, 'middleC')).toBe('open')
    expect(stateOf({}, 'fingers')).toBe('locked')
    expect(stateOf({ middleC: { at: '', how: 'check' } }, 'fingers')).toBe('open')
  })

  it('a step added later opens for a player already past it, and blocks nothing she has done', () => {
    // Progress saved before finger numbers existed: the first two steps and the chord.
    const before = { middleC: { at: '', how: 'check' as const }, cde: { at: '', how: 'check' as const }, fiveFinger: { at: '', how: 'check' as const }, chord: { at: '', how: 'check' as const } }
    expect(stateOf(before, 'fingers')).toBe('open')
    expect(['cde', 'fiveFinger', 'chord'].map((id) => stateOf(before, id as 'cde'))).toEqual(['done', 'done', 'done'])
    expect(stateOf(before, 'twoHands')).toBe('locked')
  })

  it('a check passed in order is "check"; a locked one passed is a test-out, and completes that step only', async () => {
    const repo = new JourneyRepo(memoryStore())
    await repo.pass('p', 'middleC', new Date('2026-09-24T10:00:00Z'))
    const p = await repo.pass('p', 'chord', new Date('2026-09-24T10:05:00Z'))
    expect(p.middleC).toEqual({ at: '2026-09-24T10:00:00.000Z', how: 'check' })
    expect(p.chord).toEqual({ at: '2026-09-24T10:05:00.000Z', how: 'testOut' })
    expect(p.fingers).toBeUndefined()
    expect(stateOf(p, 'fingers')).toBe('open')
    expect(stateOf(p, 'cde')).toBe('locked')
  })

  it('keeps the first pass: passing again changes nothing', async () => {
    const repo = new JourneyRepo(memoryStore())
    await repo.pass('p', 'middleC', new Date('2026-09-24T10:00:00Z'))
    const p = await repo.pass('p', 'middleC', new Date('2026-09-25T10:00:00Z'))
    expect(p.middleC?.at).toBe('2026-09-24T10:00:00.000Z')
  })

  it('keeps each player’s progress apart', async () => {
    const repo = new JourneyRepo(memoryStore())
    await repo.pass('nora', 'middleC')
    expect(await repo.get('gabriel')).toEqual({})
  })
})
