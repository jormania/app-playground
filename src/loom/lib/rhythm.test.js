import { describe, it, expect, beforeEach, vi } from 'vitest'

const store = {}
const localStorageStub = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, val) => { store[key] = String(val) },
  removeItem: (key) => { delete store[key] },
}
vi.stubGlobal('localStorage', localStorageStub)

import {
  loadRhythms, addRhythm, removeRhythm, setRhythmDays,
  isRhythm, getRhythmEntry, rhythmSkeinNames, clearAllRhythms,
  isRhythmSettledForWeek, settleRhythmForWeek, pendingRhythms, resetRhythmBanners,
} from './rhythm.js'

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key]
})

describe('loadRhythms / addRhythm / removeRhythm', () => {
  it('returns [] when nothing is set', () => {
    expect(loadRhythms()).toEqual([])
  })

  it('adds a rhythm and reads it back (all days)', () => {
    addRhythm('Body')
    expect(loadRhythms()).toEqual([{ skeinName: 'Body', days: null }])
    expect(isRhythm('Body')).toBe(true)
    expect(getRhythmEntry('Body')).toEqual({ skeinName: 'Body', days: null })
  })

  it('adds a rhythm with a days mask', () => {
    addRhythm('Focus', [0, 1, 2, 3, 4])
    expect(getRhythmEntry('Focus')).toEqual({ skeinName: 'Focus', days: [0, 1, 2, 3, 4] })
  })

  it('adds multiple rhythms independently', () => {
    addRhythm('Body')
    addRhythm('Focus', [0, 1, 2, 3, 4])
    addRhythm('Reflection')
    expect(loadRhythms()).toHaveLength(3)
    expect(isRhythm('Body')).toBe(true)
    expect(isRhythm('Focus')).toBe(true)
    expect(isRhythm('Reflection')).toBe(true)
    expect(isRhythm('Work')).toBe(false)
  })

  it('removes a rhythm, leaving others intact', () => {
    addRhythm('Body')
    addRhythm('Focus')
    removeRhythm('Body')
    expect(isRhythm('Body')).toBe(false)
    expect(isRhythm('Focus')).toBe(true)
    expect(loadRhythms()).toHaveLength(1)
  })

  it('addRhythm updates an existing entry (no duplicates)', () => {
    addRhythm('Body')
    addRhythm('Body', [0, 1, 2, 3, 4])
    expect(loadRhythms()).toHaveLength(1)
    expect(getRhythmEntry('Body')?.days).toEqual([0, 1, 2, 3, 4])
  })

  it('rhythmSkeinNames returns an array of names', () => {
    addRhythm('Body'); addRhythm('Focus')
    expect(rhythmSkeinNames()).toEqual(['Body', 'Focus'])
  })

  it('clearAllRhythms empties the list', () => {
    addRhythm('Body'); addRhythm('Focus')
    clearAllRhythms()
    expect(loadRhythms()).toEqual([])
  })
})

describe('setRhythmDays', () => {
  it('updates days for an existing rhythm', () => {
    addRhythm('Body')
    setRhythmDays('Body', [0, 1, 2, 3, 4])
    expect(getRhythmEntry('Body')?.days).toEqual([0, 1, 2, 3, 4])
  })

  it('does nothing for a non-existent rhythm', () => {
    setRhythmDays('NonExistent', [0, 1])
    expect(loadRhythms()).toHaveLength(0)
  })
})

describe('backward-compat migration from old loom_rhythm_skein key', () => {
  it('migrates a plain string value', () => {
    store['loom_rhythm_skein'] = 'Daily'
    const result = loadRhythms()
    expect(result).toEqual([{ skeinName: 'Daily', days: null }])
    // Old key should be removed after migration
    expect(store['loom_rhythm_skein']).toBeUndefined()
  })

  it('migrates a JSON object value', () => {
    store['loom_rhythm_skein'] = JSON.stringify({ skeinName: 'Morning', days: [0, 1, 2, 3, 4] })
    const result = loadRhythms()
    expect(result[0].skeinName).toBe('Morning')
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

  it('resetRhythmBanners clears the entire log', () => {
    settleRhythmForWeek('2026-07-14')
    resetRhythmBanners()
    expect(isRhythmSettledForWeek('2026-07-14')).toBe(false)
  })
})

describe('pendingRhythms', () => {
  it('returns [] when no rhythms are set', () => {
    expect(pendingRhythms('2026-07-14')).toEqual([])
  })

  it('returns all rhythms when not settled', () => {
    addRhythm('Body'); addRhythm('Focus', [0, 1, 2, 3, 4])
    const p = pendingRhythms('2026-07-14')
    expect(p).toHaveLength(2)
    expect(p.find(r => r.skeinName === 'Focus')?.days).toEqual([0, 1, 2, 3, 4])
  })

  it('returns [] once the week is settled', () => {
    addRhythm('Body')
    settleRhythmForWeek('2026-07-14')
    expect(pendingRhythms('2026-07-14')).toEqual([])
  })

  it('still returns rhythms for a different (unsettled) week', () => {
    addRhythm('Body')
    settleRhythmForWeek('2026-07-14')
    expect(pendingRhythms('2026-07-21')).toHaveLength(1)
  })
})
