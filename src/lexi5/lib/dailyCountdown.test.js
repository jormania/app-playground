import { describe, it, expect } from 'vitest'
import { msUntilNextWord, formatCountdown } from './dailyCountdown'

describe('msUntilNextWord', () => {
  it('counts to the next local midnight', () => {
    // 22:00 local -> two hours to go. The boundary has to be *local* midnight, because
    // that's what getWord keys off (new Date().toDateString()).
    const at2200 = new Date(2026, 7, 12, 22, 0, 0)
    expect(msUntilNextWord(at2200)).toBe(2 * 60 * 60 * 1000)
  })

  it('is a full day just after midnight', () => {
    const justAfter = new Date(2026, 7, 12, 0, 0, 0)
    expect(msUntilNextWord(justAfter)).toBe(24 * 60 * 60 * 1000)
  })

  it('stays positive across a month boundary', () => {
    const lastDay = new Date(2026, 7, 31, 23, 30, 0)
    expect(msUntilNextWord(lastDay)).toBe(30 * 60 * 1000)
  })
})

describe('formatCountdown', () => {
  it('shows hours and minutes together', () => {
    expect(formatCountdown((5 * 60 + 12) * 60 * 1000)).toBe('5h 12m')
  })

  it('drops the hour component under an hour', () => {
    expect(formatCountdown(12 * 60 * 1000)).toBe('12m')
  })

  it('avoids a bare "0m" in the last minute', () => {
    expect(formatCountdown(30 * 1000)).toBe('under a minute')
  })

  it('reads as now once elapsed', () => {
    expect(formatCountdown(0)).toBe('now')
    expect(formatCountdown(-1000)).toBe('now')
  })
})
