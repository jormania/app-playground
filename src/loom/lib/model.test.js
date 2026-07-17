import { describe, it, expect } from 'vitest'
import {
  dyeAt, heatForIndex, isOverflow, heatColor, HEAT_CAP,
  sortByOrder, rankBetween, orderForNew, orderForMove,
  dateKey, addDays, startOfWeek, weekDays,
  groupBySkein, collectSkeins, groupByWeek, threadStats, LOOSE_SKEIN,
} from './model.js'

describe('heatmap dye', () => {
  it('burns hottest (ember) at the top and cools with position', () => {
    expect(heatForIndex(0)).toBe(1)
    expect(heatForIndex(HEAT_CAP)).toBe(0)
    // Monotonic non-increasing.
    let prev = Infinity
    for (let i = 0; i <= HEAT_CAP; i++) {
      const h = heatForIndex(i)
      expect(h).toBeLessThanOrEqual(prev)
      prev = h
    }
  })

  it('dyeAt returns ember at t=1 and cool slate at t=0', () => {
    expect(dyeAt(1)).toEqual([214, 69, 47])
    expect(dyeAt(0)).toEqual([74, 109, 116])
  })

  it('interpolates between stops', () => {
    const mid = dyeAt(0.86) // halfway between t=1 and t=0.72
    // Each channel sits strictly between the ember and copper stops.
    expect(mid[0]).toBeGreaterThan(214)  // toward copper's higher-ish? red 214→217
    expect(mid[1]).toBeGreaterThan(69)
    expect(mid[1]).toBeLessThan(138)
  })

  it('marks positions past the cap as cold overflow, undyed grey', () => {
    expect(isOverflow(HEAT_CAP)).toBe(false)
    expect(isOverflow(HEAT_CAP + 1)).toBe(true)
    expect(heatColor(HEAT_CAP + 1)).toBe('rgb(63, 77, 80)')
    expect(heatColor(0)).toBe('rgb(214, 69, 47)')
  })
})

describe('manual fractional ordering', () => {
  it('sorts by order ascending, stable on ties', () => {
    const out = sortByOrder([
      { id: 'b', order: 10 }, { id: 'a', order: 10 }, { id: 'c', order: 5 },
    ])
    expect(out.map(t => t.id)).toEqual(['c', 'a', 'b'])
  })

  it('rankBetween picks the midpoint, and steps past open ends', () => {
    expect(rankBetween(0, 10)).toBe(5)
    expect(rankBetween(undefined, 10)).toBe(10 - 1000)
    expect(rankBetween(10, undefined)).toBe(10 + 1000)
    expect(rankBetween(undefined, undefined)).toBe(0)
  })

  it('orderForNew puts a fresh thread below the coolest existing one', () => {
    expect(orderForNew([])).toBe(0)
    expect(orderForNew([{ order: 0 }, { order: 500 }])).toBe(1500)
  })

  it('orderForMove yields a rank landing the thread at the target index', () => {
    const group = [
      { id: 'x', order: 0 }, { id: 'y', order: 100 }, { id: 'z', order: 200 },
    ]
    // Move z to the very top → below nothing, above x(0).
    const top = orderForMove(group, 'z', 0)
    expect(top).toBeLessThan(0)
    // Move x to the middle (between y and z once x is removed).
    const mid = orderForMove(group, 'x', 1)
    expect(mid).toBeGreaterThan(100)
    expect(mid).toBeLessThan(200)
    // Move x to the bottom.
    const bottom = orderForMove(group, 'x', 2)
    expect(bottom).toBeGreaterThan(200)
  })

  it('a reorder produces a self-consistent new order', () => {
    const group = [
      { id: 'x', order: 0 }, { id: 'y', order: 100 }, { id: 'z', order: 200 },
    ]
    const newOrder = orderForMove(group, 'z', 0)
    const moved = group.map(t => (t.id === 'z' ? { ...t, order: newOrder } : t))
    expect(sortByOrder(moved).map(t => t.id)).toEqual(['z', 'x', 'y'])
  })
})

describe('weeks and day keys', () => {
  it('formats a local day key', () => {
    expect(dateKey(new Date(2026, 6, 17))).toBe('2026-07-17')
  })

  it('startOfWeek lands on Monday', () => {
    // 2026-07-17 is a Friday.
    const mon = startOfWeek(new Date(2026, 6, 17))
    expect(dateKey(mon)).toBe('2026-07-13')
    expect(mon.getDay()).toBe(1)
  })

  it('a Monday is its own week start', () => {
    expect(dateKey(startOfWeek(new Date(2026, 6, 13)))).toBe('2026-07-13')
  })

  it('weekDays returns seven Mon→Sun days', () => {
    const days = weekDays(new Date(2026, 6, 17))
    expect(days).toHaveLength(7)
    expect(days[0].label).toBe('Mon')
    expect(days[0].key).toBe('2026-07-13')
    expect(days[6].label).toBe('Sun')
    expect(days[6].key).toBe('2026-07-19')
  })

  it('addDays crosses month boundaries', () => {
    expect(dateKey(addDays(new Date(2026, 6, 31), 1))).toBe('2026-08-01')
  })
})

describe('grouping over one array', () => {
  const threads = [
    { id: '1', title: 'a', skein: 'Book', day: '2026-07-13', order: 0, done: false },
    { id: '2', title: 'b', skein: 'Book', day: '2026-07-14', order: 10, done: false },
    { id: '3', title: 'c', skein: null, day: null, order: 5, done: false },
    { id: '4', title: 'd', skein: 'Garden', day: '2026-07-13', order: 20, done: true },
  ]

  it('groupBySkein keeps first-appearance order and puts loose threads last', () => {
    const groups = groupBySkein(threads)
    expect(groups.map(g => g.skein)).toEqual(['Book', 'Garden', LOOSE_SKEIN])
    expect(groups[0].tasks.map(t => t.id)).toEqual(['1', '2'])
    expect(groups[2].isLoose).toBe(true)
  })

  it('collectSkeins lists distinct named skeins only', () => {
    expect(collectSkeins(threads)).toEqual(['Book', 'Garden'])
  })

  it('groupByWeek buckets by day and sweeps the rest to backlog', () => {
    const days = weekDays(new Date(2026, 6, 17))
    const { columns, backlog } = groupByWeek(threads, days)
    const mon = columns.find(c => c.key === '2026-07-13')
    expect(mon.tasks.map(t => t.id)).toEqual(['1', '4'])
    // Thread 3 has no day → backlog.
    expect(backlog.map(t => t.id)).toEqual(['3'])
  })

  it('groupByWeek sends an off-week dated thread to backlog', () => {
    const days = weekDays(new Date(2026, 6, 17))
    const off = [{ id: '9', title: 'z', skein: null, day: '2025-01-01', order: 0, done: false }]
    const { backlog } = groupByWeek(off, days)
    expect(backlog.map(t => t.id)).toEqual(['9'])
  })
})

describe('stats', () => {
  it('counts total, woven and open', () => {
    const s = threadStats([
      { id: '1', done: true }, { id: '2', done: false }, { id: '3', done: false },
    ])
    expect(s).toEqual({ total: 3, woven: 1, open: 2 })
  })
})
