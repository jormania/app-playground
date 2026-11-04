// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { matchNights, compareBy, median, hm, MIN_PER_GROUP } from './sleepMatch'
import { blendLabel, recordBegin, recordEnd, loadNights, NIGHTS_KEY, NIGHTS_CAP } from './nights'
import { CURATED_MIXES, DEFAULT_MIX, SCENE_PRESETS } from './storage'

const H = 3600000
const base = Date.parse('2026-11-03T21:00:00Z')

const night = (dayOffset, extra = {}) => ({ startedAt: base + dayOffset * 24 * H, minutes: 30, blend: 'first rain', breathwork: true, screen: 'lit', ...extra })
const sleep = (startedAt, latencyMin, extra = {}) => ({
  onset: new Date(startedAt + latencyMin * 60000).toISOString(), mainSleep: true, nap: false, minutesAsleep: 420, deep: 60, ...extra,
})

describe('matchNights', () => {
  it('pairs each night with the main sleep that began after it and measures the latency', () => {
    const n = night(0)
    const [m] = matchNights([n], [sleep(n.startedAt, 18)])
    expect(m.latency).toBe(18)
    expect(m.sleep.minutesAsleep).toBe(420)
  })

  it('prefers the main sleep over a closer non-main session, and ignores naps', () => {
    const n = night(0)
    const [m] = matchNights([n], [
      sleep(n.startedAt, 2, { nap: true }),
      sleep(n.startedAt, 5, { mainSleep: false, minutesAsleep: 40 }),
      sleep(n.startedAt, 25),
    ])
    expect(m.latency).toBe(25)
  })

  it('leaves a night unpaired when nothing falls in its window', () => {
    const n = night(0)
    const [m] = matchNights([n], [sleep(n.startedAt, 5 * 60)])
    expect(m.sleep).toBeNull()
  })

  it('counts a band that thought you were already asleep as zero, not negative', () => {
    const n = night(0)
    expect(matchNights([n], [sleep(n.startedAt, -20)])[0].latency).toBe(0)
  })
})

describe('compareBy', () => {
  const build = (blend, latencies) => latencies.map((l, i) => {
    const n = night(i + (blend === 'far storm' ? 50 : 0), { blend })
    return { ...n, sleep: { minutesAsleep: 400, deep: 50 }, latency: l }
  })

  it('stays silent until two groups each have enough nights', () => {
    const few = [...build('first rain', [10, 12, 14]), ...build('far storm', [20, 25])]
    expect(compareBy(few, 'blend')).toBeNull()
  })

  it('reports medians, fastest first', () => {
    const rows = compareBy([...build('far storm', [30, 22, 26]), ...build('first rain', [10, 40, 12, 14])], 'blend')
    expect(rows.map((r) => [r.label, r.latency, r.nights])).toEqual([['first rain', 13, 4], ['far storm', 26, 3]])
    expect(MIN_PER_GROUP).toBe(3)
  })

  it('knows breathwork and screen', () => {
    const on = build('a', [10, 10, 10]).map((n) => ({ ...n, breathwork: true }))
    const off = build('far storm', [20, 20, 20]).map((n) => ({ ...n, breathwork: false, screen: 'off' }))
    expect(compareBy([...on, ...off], 'breathwork').map((r) => r.label)).toEqual(['with breathwork', 'without breathwork'])
    expect(compareBy([...on, ...off], 'screen').map((r) => r.label)).toEqual(['screen lit', 'screen off'])
  })
})

describe('helpers', () => {
  it('median and hm', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(3)
    expect(median([null])).toBeNull()
    expect(hm(432)).toBe('7h 12m')
    expect(hm(48)).toBe('48m')
    expect(hm(null)).toBe('—')
  })
})

describe('night log', () => {
  beforeEach(() => localStorage.clear())

  it('names the blend a night played', () => {
    const farStorm = CURATED_MIXES.find((c) => c.id === 'far-storm')
    expect(blendLabel({ ...DEFAULT_MIX, ...farStorm.mix, volume: 3 })).toBe('far storm')
    expect(blendLabel({ ...DEFAULT_MIX, ...SCENE_PRESETS.waves })).toBe('waves')
    const mine = { ...DEFAULT_MIX, rain: 9, chime: 4 }
    expect(blendLabel(mine, [{ id: 'x', name: 'my storm', mix: mine }])).toBe('my storm')
    expect(blendLabel({ ...DEFAULT_MIX, rain: 9, chime: 4 })).toBe('own blend')
  })

  it('logs a begin once, its end, and never the note', () => {
    const session = { startedAt: base, totalSec: 1800, mix: DEFAULT_MIX, screen: 'dark', breathwork: true, note: 'call the bank' }
    recordBegin(session)
    recordBegin(session) // a same-night resume
    recordEnd(base, base + 20 * 60000)
    const list = loadNights()
    expect(list).toHaveLength(1)
    expect(list[0]).toEqual({ startedAt: base, endedAt: base + 1200000, minutes: 30, blend: 'rain', breathwork: false, screen: 'dark' })
    expect(localStorage.getItem(NIGHTS_KEY)).not.toContain('bank')
  })

  it('keeps at most NIGHTS_CAP nights, newest first', () => {
    for (let i = 0; i < NIGHTS_CAP + 5; i++) recordBegin({ startedAt: base + i, totalSec: 900, mix: DEFAULT_MIX })
    const list = loadNights()
    expect(list).toHaveLength(NIGHTS_CAP)
    expect(list[0].startedAt).toBe(base + NIGHTS_CAP + 4)
  })
})
