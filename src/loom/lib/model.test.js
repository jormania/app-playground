import { describe, it, expect } from 'vitest'
import {
  dyeAt, heatForIndex, isOverflow, heatColor, HEAT_CAP,
  sortByOrder, rankBetween, orderForNew, orderForMove,
  dateKey, addDays, startOfWeek, weekDays,
  groupBySkein, collectSkeins, groupByWeek, threadStats, LOOSE_SKEIN,
  weekdayIndex, carryThreads, threadsForDraftWeek, draftItemsFromWeek,
  matchesQuery, topOfGroup, sortSkeinGroups, tapestryStats, weekReview,
  rhythmThreadsForWeek, splitRhythmThreads, rhythmTemplateGroups,
  currentOrFutureThreads, rhythmTemplateHeatRanks, rhythmHeatRankFor,
  rhythmLast7Days,
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

describe('carry-over (the re-warp ritual)', () => {
  it('weekdayIndex is Monday-based', () => {
    expect(weekdayIndex('2026-07-13')).toBe(0) // Monday
    expect(weekdayIndex('2026-07-19')).toBe(6) // Sunday
  })

  it('carries only unfinished threads dated before this week', () => {
    const threads = [
      { id: 'a', day: '2026-07-06', done: false, order: 0 }, // last week, open → carry
      { id: 'b', day: '2026-07-07', done: true, order: 0 },  // last week, woven → skip
      { id: 'c', day: '2026-07-14', done: false, order: 0 }, // this week → skip
      { id: 'd', day: null, done: false, order: 0 },         // distaff → skip
      { id: 'e', day: '2026-06-29', done: false, order: 0 }, // two weeks ago → carry
    ]
    const carried = carryThreads(threads, '2026-07-13')
    expect(carried.map(t => t.id)).toEqual(['e', 'a']) // oldest first
  })
})

describe('drafts', () => {
  const draft = {
    id: 'd1',
    name: 'Work week',
    items: [
      { title: 'Standup', skein: 'Work', dayIndex: 0, order: 0 },
      { title: 'Ship it', skein: 'Work', dayIndex: 4, order: 1000 },
      { title: 'Idea parking', skein: null, dayIndex: null, order: 2000 },
    ],
  }

  it('casts a draft onto a week, mapping day-of-week to real dates', () => {
    const built = threadsForDraftWeek(draft, new Date(2026, 6, 15)) // week of Mon 13th
    expect(built[0]).toMatchObject({ title: 'Standup', skein: 'Work', day: '2026-07-13', done: false })
    expect(built[1].day).toBe('2026-07-17') // Friday
    expect(built[2].day).toBeNull()         // distaff item
  })

  it('snapshots a week back into draft items (open threads only)', () => {
    const days = weekDays(new Date(2026, 6, 15))
    const threads = [
      { id: '1', title: 'Keep', skein: 'Work', day: days[0].key, order: 0, done: false },
      { id: '2', title: 'Woven — skip', skein: 'Work', day: days[1].key, order: 10, done: true },
      { id: '3', title: 'Distaff', skein: null, day: null, order: 20, done: false },
      { id: '4', title: 'Off-week — skip', skein: null, day: '2020-01-01', order: 30, done: false },
    ]
    const items = draftItemsFromWeek(threads, days)
    expect(items.map(i => i.title)).toEqual(['Keep', 'Distaff'])
    expect(items[0].dayIndex).toBe(0)
    expect(items[1].dayIndex).toBeNull()
  })
})

describe('search & focus', () => {
  it('matchesQuery scans title and skein, case-insensitively', () => {
    const t = { title: 'Dye the wool', skein: 'Weaving' }
    expect(matchesQuery(t, '')).toBe(true)
    expect(matchesQuery(t, 'WOOL')).toBe(true)
    expect(matchesQuery(t, 'weav')).toBe(true)
    expect(matchesQuery(t, 'garden')).toBe(false)
  })

  it('topOfGroup keeps the hot few (cap + 1)', () => {
    const tasks = Array.from({ length: 10 }, (_, i) => ({ id: String(i) }))
    expect(topOfGroup(tasks)).toHaveLength(HEAT_CAP + 1)
  })

  it('sortSkeinGroups orders by name/size/heat with loose always last', () => {
    const groups = [
      { skein: 'Beta', isLoose: false, tasks: [{ done: false }, { done: false }] },
      { skein: LOOSE_SKEIN, isLoose: true, tasks: [{ done: false }] },
      { skein: 'Alpha', isLoose: false, tasks: [{ done: true }] },
    ]
    expect(sortSkeinGroups(groups, 'name').map(g => g.skein)).toEqual(['Alpha', 'Beta', LOOSE_SKEIN])
    expect(sortSkeinGroups(groups, 'size').map(g => g.skein)).toEqual(['Beta', 'Alpha', LOOSE_SKEIN])
    expect(sortSkeinGroups(groups, 'heat').map(g => g.skein)).toEqual(['Beta', 'Alpha', LOOSE_SKEIN])
    expect(sortSkeinGroups(groups, 'manual').map(g => g.skein)).toEqual(['Beta', LOOSE_SKEIN, 'Alpha'])
  })
})

describe('the Tapestry', () => {
  const now = new Date(2026, 6, 15) // Wed of week starting Mon 2026-07-13
  const threads = [
    { id: '1', title: 'a', skein: 'Weaving', day: '2026-07-13', order: 0, done: true },
    { id: '2', title: 'b', skein: 'Weaving', day: '2026-07-13', order: 1, done: false },
    { id: '3', title: 'c', skein: 'Hearth', day: '2026-07-06', order: 0, done: false }, // last week, open
    { id: '4', title: 'd', skein: 'Weaving', day: '2020-01-01', order: 0, done: true },  // out of window
    { id: '5', title: 'e', skein: null, day: null, order: 0, done: false },              // no day
  ]

  it('aggregates completion, hottest skein, busiest day and past debt', () => {
    const s = tapestryStats(threads, { weeks: 4, now })
    expect(s.weeks).toBe(4)
    expect(s.rows).toHaveLength(4)
    expect(s.total).toBe(3)   // threads 1,2,3 are in-window and dated
    expect(s.woven).toBe(1)   // only thread 1
    expect(s.completionRate).toBeCloseTo(1 / 3)
    expect(s.hottestSkein.skein).toBe('Weaving')
    expect(s.busiestWeekday.index).toBe(0) // Monday (threads 1 & 2)
    expect(s.unwovenPast).toBe(1)          // thread 3
  })

  it('weekReview counts this week woven vs carried', () => {
    const r = weekReview(threads, now)
    expect(r.woven).toBe(1)
    expect(r.carried).toBe(1)
    expect(r.hottestSkein).toBe('Weaving')
  })
})

// ── Rhythm (daily routine) ──────────────────────────────────────────────────
describe('rhythmThreadsForWeek', () => {
  const monday = new Date(2026, 6, 13) // Monday 2026-07-13
  const days = weekDays(monday)

  it('creates one thread per canonical entry per day', () => {
    const threads = [
      { id: 'r1', title: 'Meditate', skein: 'Morning', day: null, order: 0, done: false },
      { id: 'r2', title: 'Journal', skein: 'Morning', day: null, order: 1000, done: false },
    ]
    const result = rhythmThreadsForWeek(threads, [{ skeinName: 'Morning', days: null }], days)
    expect(result.length).toBe(14) // 2 titles × 7 days
    expect(result[0].title).toBe('Meditate')
    expect(result[0].day).toBe('2026-07-13')
    expect(result[0].skein).toBe('Morning')
    expect(result[0].done).toBe(false)
    expect(result[7].title).toBe('Journal')
  })

  it('skips threads that already exist on a given day (duplication guard)', () => {
    const threads = [
      { id: 'r1', title: 'Meditate', skein: 'Morning', day: null, order: 0, done: false },
      // Already exists on Monday:
      { id: 'existing', title: 'Meditate', skein: 'Morning', day: '2026-07-13', order: 0, done: false },
    ]
    const result = rhythmThreadsForWeek(threads, [{ skeinName: 'Morning', days: null }], days)
    // Should create 6 (Tue–Sun), not 7
    expect(result.length).toBe(6)
    expect(result.every(t => t.day !== '2026-07-13')).toBe(true)
  })

  it('returns empty for null or missing rhythm skein', () => {
    const threads = [{ id: '1', title: 'X', skein: 'A', day: null, order: 0, done: false }]
    expect(rhythmThreadsForWeek(threads, [], days)).toEqual([])
    expect(rhythmThreadsForWeek(threads, null, days)).toEqual([])
  })

  it('ignores done threads in the canonical list', () => {
    const threads = [
      { id: 'r1', title: 'Meditate', skein: 'Morning', day: null, order: 0, done: true },
    ]
    expect(rhythmThreadsForWeek(threads, [{ skeinName: 'Morning', days: null }], days)).toEqual([])
  })

  it('deduplicates canonical titles (keeps lowest-order)', () => {
    const threads = [
      { id: 'r1', title: 'Meditate', skein: 'Morning', day: null, order: 0, done: false },
      { id: 'r2', title: 'Meditate', skein: 'Morning', day: '2026-07-15', order: 2000, done: false },
    ]
    const result = rhythmThreadsForWeek(threads, [{ skeinName: 'Morning', days: null }], days)
    // Only 1 unique title, but '2026-07-15' already has it = 6 new threads
    expect(result.length).toBe(6)
    expect(result.every(t => t.order === 0)).toBe(true) // from the lower-order duplicate
  })
})

describe('splitRhythmThreads', () => {
  it('separates rhythm-skein threads from the rest', () => {
    const tasks = [
      { id: '1', title: 'Meditate', skein: 'Morning', order: 0 },
      { id: '2', title: 'Review PR', skein: 'Work', order: 1000 },
      { id: '3', title: 'Journal', skein: 'Morning', order: 2000 },
    ]
    const { rhythm, rest } = splitRhythmThreads(tasks, new Set(['Morning']))
    expect(rhythm.map(t => t.id)).toEqual(['1', '3'])
    expect(rest.map(t => t.id)).toEqual(['2'])
  })

  it('returns all as rest when no rhythm skein', () => {
    const tasks = [{ id: '1', title: 'X', skein: 'A', order: 0 }]
    const { rhythm, rest } = splitRhythmThreads(tasks, new Set())
    expect(rhythm).toEqual([])
    expect(rest).toBe(tasks)
  })
})

describe('currentOrFutureThreads', () => {
  it('keeps this week, future weeks, and day-less threads; drops past debt', () => {
    const threads = [
      { id: 'past', day: '2026-07-06' },
      { id: 'thisWeek', day: '2026-07-13' },
      { id: 'future', day: '2026-07-27' },
      { id: 'dayless', day: null },
    ]
    const kept = currentOrFutureThreads(threads, '2026-07-13').map(t => t.id)
    expect(kept).toEqual(['thisWeek', 'future', 'dayless'])
  })
})

describe('rhythmTemplateHeatRanks / rhythmHeatRankFor', () => {
  const weekStart = '2026-07-13'
  const rhythmNames = new Set(['Focus'])

  it('ranks each rhythm skein\'s templates by the Skeins-view order (lowest instance order first)', () => {
    const threads = [
      // "Reading" has an earlier (lower) order than "Deep work" among its instances.
      { id: 'r1', title: 'Reading', skein: 'Focus', day: '2026-07-14', order: 5, done: false },
      { id: 'd1', title: 'Deep work', skein: 'Focus', day: '2026-07-13', order: 10, done: false },
      { id: 'd2', title: 'Deep work', skein: 'Focus', day: '2026-07-15', order: 20, done: true },
    ]
    const ranks = rhythmTemplateHeatRanks(threads, rhythmNames, weekStart)
    expect(rhythmHeatRankFor(ranks, threads[0])).toBe(0) // Reading — hottest
    expect(rhythmHeatRankFor(ranks, threads[1])).toBe(1) // Deep work, Monday instance
    expect(rhythmHeatRankFor(ranks, threads[2])).toBe(1) // Deep work, Wednesday instance — SAME rank as Monday's
  })

  it('excludes stale past-week instances from the ranking, matching the Skeins-view scope', () => {
    const threads = [
      { id: 'stale', title: 'Old debt', skein: 'Focus', day: '2026-07-06', order: 0, done: false },
      { id: 'd1', title: 'Deep work', skein: 'Focus', day: '2026-07-13', order: 10, done: false },
    ]
    const ranks = rhythmTemplateHeatRanks(threads, rhythmNames, weekStart)
    expect(rhythmHeatRankFor(ranks, threads[1])).toBe(0) // only remaining template -> hottest
    expect(ranks.has('Focus' + String.fromCharCode(0) + 'Old debt')).toBe(false)
  })

  it('keys are scoped per skein — same title in two different rhythm skeins never collides', () => {
    const threads = [
      { id: 'a', title: 'Review', skein: 'Focus', day: '2026-07-13', order: 0, done: false },
      { id: 'b', title: 'Review', skein: 'Reflection', day: '2026-07-13', order: 0, done: false },
    ]
    const ranks = rhythmTemplateHeatRanks(threads, new Set(['Focus', 'Reflection']), weekStart)
    expect(rhythmHeatRankFor(ranks, threads[0])).toBe(0)
    expect(rhythmHeatRankFor(ranks, threads[1])).toBe(0)
    expect(ranks.size).toBe(2)
  })

  it('falls back to 0 for a thread the map has no entry for', () => {
    const ranks = rhythmTemplateHeatRanks([], rhythmNames, weekStart)
    expect(rhythmHeatRankFor(ranks, { skein: 'Focus', title: 'Unknown' })).toBe(0)
  })

  it('returns an empty map when there are no rhythm skeins', () => {
    const ranks = rhythmTemplateHeatRanks([{ id: '1', skein: 'X', title: 'Y' }], new Set(), weekStart)
    expect(ranks.size).toBe(0)
  })
})

describe('rhythmTemplateGroups', () => {
  it('collapses one row per cast day into a single template, counting instances', () => {
    const tasks = [
      { id: 'mon', title: 'Deep work', skein: 'Focus', order: 5, done: false },
      { id: 'tue', title: 'Deep work', skein: 'Focus', order: 3, done: true },
      { id: 'wed', title: 'Deep work', skein: 'Focus', order: 9, done: false },
      { id: 'r1', title: 'Reading', skein: 'Focus', order: 1, done: false },
    ]
    const groups = rhythmTemplateGroups(tasks)
    expect(groups).toHaveLength(2)
    const deepWork = groups.find(g => g.title === 'Deep work')
    expect(deepWork.count).toBe(3)
    expect(deepWork.instanceIds.sort()).toEqual(['mon', 'tue', 'wed'])
    // Order is the lowest among the instances (tue=3), regardless of done-state.
    expect(deepWork.order).toBe(3)
  })

  it('sorts templates by their (lowest-instance) order', () => {
    const tasks = [
      { id: 'a', title: 'B', skein: 'X', order: 10, done: false },
      { id: 'b', title: 'A', skein: 'X', order: 0, done: false },
    ]
    expect(rhythmTemplateGroups(tasks).map(g => g.title)).toEqual(['A', 'B'])
  })

  it('is empty for an empty list', () => {
    expect(rhythmTemplateGroups([])).toEqual([])
  })
})

describe('rhythmLast7Days', () => {
  const now = new Date(2026, 6, 15) // Wednesday 2026-07-15; window = 07-09..07-15

  it('returns [] when there are no rhythms', () => {
    expect(rhythmLast7Days([], [], { now })).toEqual([])
  })

  it('marks done / open / none per day for a daily (no mask) rhythm', () => {
    const threads = [
      { id: 'a', title: 'Meditate', skein: 'Morning', day: '2026-07-09', order: 0, done: true },  // done
      { id: 'b', title: 'Meditate', skein: 'Morning', day: '2026-07-10', order: 0, done: false }, // open
      // 07-11 .. 07-15: no instance at all -> 'none'
    ]
    const [tpl] = rhythmLast7Days(threads, [{ skeinName: 'Morning', days: null }], { now })
    expect(tpl.skeinName).toBe('Morning')
    expect(tpl.title).toBe('Meditate')
    expect(tpl.cells.map(c => c.key)).toEqual([
      '2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12',
      '2026-07-13', '2026-07-14', '2026-07-15',
    ])
    expect(tpl.cells.map(c => c.status)).toEqual(['done', 'open', 'none', 'none', 'none', 'none', 'none'])
    expect(tpl.cells[0].label).toBe('Thu')
    expect(tpl.cells[6].dayNum).toBe(15)
  })

  it('marks days outside the day mask as "off"', () => {
    const threads = [
      { id: 'a', title: 'Deep work', skein: 'Focus', day: '2026-07-13', order: 0, done: true }, // Monday
    ]
    const [tpl] = rhythmLast7Days(threads, [{ skeinName: 'Focus', days: [0, 1, 2, 3, 4] }], { now })
    const byKey = Object.fromEntries(tpl.cells.map(c => [c.key, c.status]))
    expect(byKey['2026-07-11']).toBe('off') // Saturday
    expect(byKey['2026-07-12']).toBe('off') // Sunday
    expect(byKey['2026-07-13']).toBe('done') // Monday
  })

  it('includes a canonical (day-less) template with every cell "none" when nothing has been cast yet', () => {
    const threads = [
      { id: 'a', title: 'Journal', skein: 'Morning', day: null, order: 0, done: false },
    ]
    const [tpl] = rhythmLast7Days(threads, [{ skeinName: 'Morning', days: null }], { now })
    expect(tpl.title).toBe('Journal')
    expect(tpl.cells.every(c => c.status === 'none')).toBe(true)
  })

  it('never surfaces a title whose only instances are stale, outside the window', () => {
    const threads = [
      { id: 'old', title: 'Stretch', skein: 'Body', day: '2026-06-01', order: 0, done: true },
    ]
    expect(rhythmLast7Days(threads, [{ skeinName: 'Body', days: null }], { now })).toEqual([])
  })

  it('keeps separate rhythm skeins independent', () => {
    const threads = [
      { id: 'a', title: 'Meditate', skein: 'Morning', day: '2026-07-15', order: 0, done: true },
      { id: 'b', title: 'Review', skein: 'Work', day: '2026-07-15', order: 0, done: false },
    ]
    const rows = rhythmLast7Days(threads, [
      { skeinName: 'Morning', days: null },
      { skeinName: 'Work', days: null },
    ], { now })
    expect(rows.map(r => `${r.skeinName}:${r.title}`)).toEqual(['Morning:Meditate', 'Work:Review'])
  })
})

describe('draftItemsFromWeek with excludeSkein', () => {
  const monday = new Date(2026, 6, 13)
  const days = weekDays(monday)

  it('excludes threads from the specified skein', () => {
    const threads = [
      { id: '1', title: 'Meditate', skein: 'Morning', day: '2026-07-13', order: 0, done: false },
      { id: '2', title: 'Review PR', skein: 'Work', day: '2026-07-14', order: 1000, done: false },
    ]
    const items = draftItemsFromWeek(threads, days, { excludeSkeins: new Set(['Morning']) })
    expect(items.length).toBe(1)
    expect(items[0].title).toBe('Review PR')
  })

  it('keeps all when excludeSkein is not set', () => {
    const threads = [
      { id: '1', title: 'Meditate', skein: 'Morning', day: '2026-07-13', order: 0, done: false },
      { id: '2', title: 'Review PR', skein: 'Work', day: '2026-07-14', order: 1000, done: false },
    ]
    const items = draftItemsFromWeek(threads, days)
    expect(items.length).toBe(2)
  })
})

