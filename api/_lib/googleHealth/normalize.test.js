import { describe, it, expect } from 'vitest'
import {
  int, civilDate, addDays, isDate, daySpan, summarizeSleep, summarizeWindow, windowIsEmpty,
  mergeDaily, summarizeExercise, timeFilter,
} from './normalize.js'
import { keyMatches, makeState, stateValid } from './auth.js'

const civil = (y, m, d, h = 0, min = 0) => ({ date: { year: y, month: m, day: d }, time: { hours: h, minutes: min } })

describe('primitives', () => {
  it('keeps "no data" distinct from zero', () => {
    expect(int('4211')).toBe(4211)
    expect(int('0')).toBe(0)
    expect(int(undefined)).toBeNull()
    expect(int('')).toBeNull()
  })

  it('handles civil dates and calendar arithmetic', () => {
    expect(civilDate({ year: 2026, month: 3, day: 9 })).toBe('2026-03-09')
    expect(civilDate(null)).toBeNull()
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(daySpan('2026-11-01', '2026-11-03')).toBe(3)
    expect(isDate('2026-11-04')).toBe(true)
    expect(isDate('2026-13-04')).toBe(false)
    expect(isDate('4 Nov')).toBe(false)
  })
})

describe('summarizeSleep', () => {
  const night = {
    sleep: {
      type: 'STAGES',
      interval: {
        startTime: '2026-11-03T21:40:00Z', endTime: '2026-11-04T05:10:00Z',
        startUtcOffset: '7200s', civilEndTime: civil(2026, 11, 4, 7, 10),
      },
      metadata: { mainSleep: true, nap: false, processed: true },
      summary: {
        minutesAsleep: '402', minutesAwake: '48', minutesInSleepPeriod: '450', minutesToFallAsleep: '0',
        stagesSummary: [
          { type: 'DEEP', minutes: '64', count: '4' },
          { type: 'LIGHT', minutes: '240', count: '20' },
          { type: 'REM', minutes: '98', count: '6' },
          { type: 'AWAKE', minutes: '48', count: '11' },
        ],
      },
      stages: [
        { type: 'LIGHT', startTime: '2026-11-03T21:58:00Z', endTime: '2026-11-03T22:30:00Z' },
        { type: 'AWAKE', startTime: '2026-11-03T21:40:00Z', endTime: '2026-11-03T21:58:00Z' },
      ],
    },
  }

  it('flattens a staged night and dates it by the morning', () => {
    const s = summarizeSleep(night)
    expect(s).toMatchObject({
      date: '2026-11-04', mainSleep: true, nap: false, minutesAsleep: 402, minutesInBed: 450,
      deep: 64, light: 240, rem: 98, awake: 48, wakeCount: 11,
    })
  })

  it('takes onset from the first real sleep stage, not the session start', () => {
    expect(summarizeSleep(night).onset).toBe('2026-11-03T21:58:00Z')
  })

  it('falls back to start + minutesToFallAsleep without stages', () => {
    const classic = { sleep: { ...night.sleep, stages: [], summary: { minutesToFallAsleep: '12' } } }
    expect(summarizeSleep(classic).onset).toBe('2026-11-03T21:52:00.000Z')
  })

  it('ignores points that are not sleep', () => {
    expect(summarizeSleep({ steps: {} })).toBeNull()
  })
})

describe('summarizeWindow', () => {
  it('sums buckets and weights heart rate by bucket length', () => {
    const w = summarizeWindow({
      steps: [{ steps: { countSum: '3000' } }, { steps: { countSum: '1211' } }],
      distance: [{ distance: { millimetersSum: '3140000' } }],
      floors: [{ floors: { countSum: '4' } }],
      heart: [
        { startTime: '2026-11-04T10:00:00Z', endTime: '2026-11-04T10:30:00Z', heartRate: { beatsPerMinuteAvg: 90, beatsPerMinuteMax: 110, beatsPerMinuteMin: 70 } },
        { startTime: '2026-11-04T10:30:00Z', endTime: '2026-11-04T10:40:00Z', heartRate: { beatsPerMinuteAvg: 130, beatsPerMinuteMax: 141, beatsPerMinuteMin: 100 } },
      ],
    })
    expect(w).toEqual({ steps: 4211, distanceKm: 3.14, floors: 4, heart: { avg: 100, max: 141, min: 70 } })
  })

  it('reports missing parts as null, and an empty window as empty', () => {
    const w = summarizeWindow({ steps: [], heart: null })
    expect(w).toEqual({ steps: null, distanceKm: null, floors: null, heart: null })
    expect(windowIsEmpty(w)).toBe(true)
  })
})

describe('mergeDaily', () => {
  it('joins roll-ups and daily points into one row per date, oldest first', () => {
    const days = mergeDaily({
      rollups: {
        steps: [
          { civilStartTime: civil(2026, 11, 3), steps: { countSum: '9012' } },
          { civilStartTime: civil(2026, 11, 2), steps: { countSum: '4100' } },
        ],
        azm: [{ civilStartTime: civil(2026, 11, 3), activeZoneMinutes: { sumInFatBurnHeartZone: '20', sumInCardioHeartZone: '6' } }],
      },
      restingHr: [{ dailyRestingHeartRate: { date: { year: 2026, month: 11, day: 3 }, beatsPerMinute: '58' } }],
      hrv: [{ dailyHeartRateVariability: { date: { year: 2026, month: 11, day: 3 }, averageHeartRateVariabilityMilliseconds: 41.27 } }],
    })
    expect(days.map((d) => d.date)).toEqual(['2026-11-02', '2026-11-03'])
    expect(days[1]).toMatchObject({ steps: 9012, activeZoneMinutes: 26, restingHeartRate: 58, hrvMs: 41.3 })
    expect(days[0].restingHeartRate).toBeNull()
  })
})

describe('summarizeExercise', () => {
  it('flattens metrics and turns the duration string into minutes', () => {
    const e = summarizeExercise({
      exercise: {
        displayName: 'Walk', exerciseType: 'WALKING', activeDuration: '2712s',
        interval: { startTime: '2026-11-03T15:00:00Z', endTime: '2026-11-03T15:46:00Z' },
        metricsSummary: { steps: '5120', distanceMillimeters: 3900000, averageHeartRateBeatsPerMinute: '104', caloriesKcal: 211.4 },
      },
    })
    expect(e).toMatchObject({ name: 'Walk', activeMinutes: 45, steps: 5120, distanceKm: 3.9, averageHeartRate: 104, calories: 211 })
  })
})

describe('timeFilter', () => {
  it('uses the documented field for each kind of type, in snake_case, end exclusive', () => {
    expect(timeFilter('daily-heart-rate-variability', '2026-11-01', '2026-11-03'))
      .toBe('daily_heart_rate_variability.date >= "2026-11-01" AND daily_heart_rate_variability.date < "2026-11-04"')
    expect(timeFilter('sleep', '2026-11-01', '2026-11-01'))
      .toBe('sleep.interval.civil_end_time >= "2026-11-01" AND sleep.interval.civil_end_time < "2026-11-02"')
    expect(timeFilter('heart-rate', '2026-11-01', '2026-11-01')).toMatch(/^heart_rate\.sample_time\.civil_time >= /)
    expect(timeFilter('steps', '2026-11-01', '2026-11-01')).toMatch(/^steps\.interval\.civil_start_time >= /)
    expect(timeFilter('exercise', '2026-11-01', '2026-11-01')).toMatch(/^exercise\.interval\.civil_start_time >= /)
  })

  it('refuses a type it does not know', () => {
    expect(() => timeFilter('location', '2026-11-01', '2026-11-01')).toThrow(/Unsupported/)
  })
})

describe('auth', () => {
  it('compares keys exactly and fails closed when unset', () => {
    expect(keyMatches('abc', 'abc')).toBe(true)
    expect(keyMatches('abd', 'abc')).toBe(false)
    expect(keyMatches('ab', 'abc')).toBe(false)
    expect(keyMatches('', '')).toBe(false)
    expect(keyMatches('abc', undefined)).toBe(false)
  })

  it('accepts only a fresh state signed with the same secret', () => {
    const now = 1_800_000_000_000
    const state = makeState('s3cret', now)
    expect(stateValid(state, 's3cret', now + 60_000)).toBe(true)
    expect(stateValid(state, 'other', now + 60_000)).toBe(false)
    expect(stateValid(state, 's3cret', now + 11 * 60_000)).toBe(false)
    expect(stateValid(state.replace(/^\d+/, String(now + 1)), 's3cret', now + 60_000)).toBe(false)
    expect(stateValid('garbage', 's3cret', now)).toBe(false)
  })
})
