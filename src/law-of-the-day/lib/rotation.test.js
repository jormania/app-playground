import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getTodayKey,
  shuffle,
  getDailyLawId,
  getDailyStatus,
  recordAnswer,
} from './rotation'

// Tests run in vitest's 'node' environment (vitest.config.js), so localStorage
// isn't provided — stub a minimal in-memory version, matching what the browser
// gives the real code (same pattern as src/journal/offlineClient.test.js).
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}

const laws = Array.from({ length: 48 }, (_, i) => ({ id: i + 1, lawTitle: `Law ${i + 1}` }))

beforeEach(() => {
  localStorage.clear()
})

describe('getTodayKey', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(getTodayKey(new Date(2026, 5, 4))).toBe('2026-06-04')
  })

  it('pads single-digit months and days', () => {
    expect(getTodayKey(new Date(2026, 0, 9))).toBe('2026-01-09')
  })
})

describe('shuffle', () => {
  it('returns a new array with the same elements', () => {
    const input = [1, 2, 3, 4, 5]
    const result = shuffle(input)
    expect(result).not.toBe(input)
    expect(result.slice().sort()).toEqual(input.slice().sort())
  })

  it('does not mutate the input', () => {
    const input = [1, 2, 3]
    shuffle(input)
    expect(input).toEqual([1, 2, 3])
  })
})

describe('getDailyLawId', () => {
  it('starts a fresh season on first run', () => {
    const day1 = new Date(2026, 0, 1)
    const id = getDailyLawId(laws, day1)
    expect(laws.map((l) => l.id)).toContain(id)
  })

  it('is idempotent within the same day', () => {
    const day1 = new Date(2026, 0, 1)
    const first = getDailyLawId(laws, day1)
    const second = getDailyLawId(laws, day1)
    expect(second).toBe(first)
  })

  it('advances exactly one position on the next day', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const day1 = new Date(2026, 0, 1)
    const day2 = new Date(2026, 0, 2)
    const first = getDailyLawId(laws, day1)
    const second = getDailyLawId(laws, day2)
    vi.restoreAllMocks()
    expect(second).not.toBe(first)
  })

  it('reshuffles a new season once the current one is exhausted', () => {
    let day = new Date(2026, 0, 1)
    const seen = []
    for (let i = 0; i < 48; i++) {
      seen.push(getDailyLawId(laws, day))
      day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
    }
    // No repeats within the season.
    expect(new Set(seen).size).toBe(48)

    // The 49th day starts a new season — still a valid law id.
    const next = getDailyLawId(laws, day)
    expect(laws.map((l) => l.id)).toContain(next)
  })

  it('does not backfill missed days — a multi-day gap still advances only one step', () => {
    const day1 = new Date(2026, 0, 1)
    const dayFar = new Date(2026, 0, 10)
    const first = getDailyLawId(laws, day1)
    const second = getDailyLawId(laws, dayFar)

    // Confirm it moved forward exactly one slot in the stored season order.
    const season = JSON.parse(localStorage.getItem('lawofday:season'))
    const firstIndex = season.order.indexOf(first)
    const secondIndex = season.order.indexOf(second)
    expect(secondIndex).toBe(firstIndex + 1)
  })
})

describe('getDailyStatus', () => {
  it('is in quiz phase before answering today', () => {
    const status = getDailyStatus(laws, new Date(2026, 0, 1))
    expect(status.phase).toBe('quiz')
    expect(status.lastResult).toBeNull()
  })

  it('is in locked phase after answering today, with the recap result', () => {
    const day1 = new Date(2026, 0, 1)
    const status1 = getDailyStatus(laws, day1)
    recordAnswer(status1.law.id, true, day1)

    const status2 = getDailyStatus(laws, day1)
    expect(status2.phase).toBe('locked')
    expect(status2.lastResult).toEqual({ correct: true })
  })
})

describe('recordAnswer', () => {
  it('starts the streak at 1 on the first answer', () => {
    const { streak } = recordAnswer(1, true, new Date(2026, 0, 1))
    expect(streak).toBe(1)
  })

  it('increments the streak on a consecutive day', () => {
    recordAnswer(1, true, new Date(2026, 0, 1))
    const { streak } = recordAnswer(2, false, new Date(2026, 0, 2))
    expect(streak).toBe(2)
  })

  it('resets the streak to 1 after a gap', () => {
    recordAnswer(1, true, new Date(2026, 0, 1))
    const { streak } = recordAnswer(2, true, new Date(2026, 0, 5))
    expect(streak).toBe(1)
  })

  it('accumulates correct/incorrect counts per law', () => {
    recordAnswer(7, true, new Date(2026, 0, 1))
    const { history } = recordAnswer(7, false, new Date(2026, 0, 2))
    expect(history[7]).toMatchObject({
      correctCount: 1,
      incorrectCount: 1,
      lastAnsweredCorrect: false,
    })
  })
})
