import { describe, it, expect, beforeEach, vi } from 'vitest'

// Provide a minimal localStorage stub for the node test environment.
const store = {}
const localStorageStub = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, val) => { store[key] = String(val) },
  removeItem: (key) => { delete store[key] },
}
vi.stubGlobal('localStorage', localStorageStub)

import {
  loadRhythm, saveRhythm, clearRhythm,
  isRhythmSettledForWeek, settleRhythmForWeek, pendingRhythm,
} from './rhythm.js'

// Clear store before each test.
beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key]
})

describe('rhythm flag', () => {
  it('returns null when no rhythm is set', () => {
    expect(loadRhythm()).toBe(null)
  })

  it('round-trips save and load', () => {
    saveRhythm('Morning')
    expect(loadRhythm()).toBe('Morning')
  })

  it('clears the rhythm', () => {
    saveRhythm('Morning')
    clearRhythm()
    expect(loadRhythm()).toBe(null)
  })

  it('saveRhythm(null) clears the flag', () => {
    saveRhythm('Morning')
    saveRhythm(null)
    expect(loadRhythm()).toBe(null)
  })
})

describe('rhythm cast log', () => {
  it('is not settled by default', () => {
    expect(isRhythmSettledForWeek('2026-07-14')).toBe(false)
  })

  it('marks a week as settled', () => {
    settleRhythmForWeek('2026-07-14')
    expect(isRhythmSettledForWeek('2026-07-14')).toBe(true)
  })

  it('different weeks are independent', () => {
    settleRhythmForWeek('2026-07-14')
    expect(isRhythmSettledForWeek('2026-07-21')).toBe(false)
  })
})

describe('pendingRhythm', () => {
  it('returns null when no rhythm is set', () => {
    expect(pendingRhythm('2026-07-14')).toBe(null)
  })

  it('returns the rhythm skein name when not settled', () => {
    saveRhythm('Daily')
    expect(pendingRhythm('2026-07-14')).toBe('Daily')
  })

  it('returns null once the week is settled', () => {
    saveRhythm('Daily')
    settleRhythmForWeek('2026-07-14')
    expect(pendingRhythm('2026-07-14')).toBe(null)
  })

  it('still returns the rhythm for an unsettled week', () => {
    saveRhythm('Daily')
    settleRhythmForWeek('2026-07-14')
    expect(pendingRhythm('2026-07-21')).toBe('Daily')
  })
})
