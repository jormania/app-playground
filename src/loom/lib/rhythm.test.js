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
  loadRhythm, loadRhythmSkein, loadRhythmDays,
  saveRhythm, clearRhythm,
  isRhythmSettledForWeek, settleRhythmForWeek, pendingRhythm,
} from './rhythm.js'

// Clear store before each test.
beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key]
})

describe('rhythm flag', () => {
  it('returns null when no rhythm is set', () => {
    expect(loadRhythm()).toBe(null)
    expect(loadRhythmSkein()).toBe(null)
    expect(loadRhythmDays()).toBe(null)
  })

  it('round-trips save and load — all days (days: null)', () => {
    saveRhythm({ skeinName: 'Morning' })
    expect(loadRhythm()).toEqual({ skeinName: 'Morning', days: null })
    expect(loadRhythmSkein()).toBe('Morning')
    expect(loadRhythmDays()).toBe(null)
  })

  it('round-trips save and load — with days mask', () => {
    saveRhythm({ skeinName: 'Morning', days: [0, 1, 2, 3, 4] })
    expect(loadRhythm()).toEqual({ skeinName: 'Morning', days: [0, 1, 2, 3, 4] })
    expect(loadRhythmDays()).toEqual([0, 1, 2, 3, 4])
  })

  it('clears the rhythm via clearRhythm()', () => {
    saveRhythm({ skeinName: 'Morning' })
    clearRhythm()
    expect(loadRhythm()).toBe(null)
  })

  it('saveRhythm({}) clears the flag (no skeinName)', () => {
    saveRhythm({ skeinName: 'Morning' })
    saveRhythm({})
    expect(loadRhythm()).toBe(null)
  })

  it('backward-compat: reads a legacy plain-string value', () => {
    // Simulate old storage format
    store['loom_rhythm_skein'] = 'Daily'
    expect(loadRhythm()).toEqual({ skeinName: 'Daily', days: null })
    expect(loadRhythmSkein()).toBe('Daily')
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

  it('returns the rhythm object when not settled', () => {
    saveRhythm({ skeinName: 'Daily', days: [0, 1, 2, 3, 4] })
    expect(pendingRhythm('2026-07-14')).toEqual({ skeinName: 'Daily', days: [0, 1, 2, 3, 4] })
  })

  it('returns null once the week is settled', () => {
    saveRhythm({ skeinName: 'Daily' })
    settleRhythmForWeek('2026-07-14')
    expect(pendingRhythm('2026-07-14')).toBe(null)
  })

  it('still returns the rhythm for an unsettled week', () => {
    saveRhythm({ skeinName: 'Daily' })
    settleRhythmForWeek('2026-07-14')
    expect(pendingRhythm('2026-07-21')).not.toBe(null)
    expect(pendingRhythm('2026-07-21')?.skeinName).toBe('Daily')
  })
})
