// Pure shaping of Google Health API v4 responses into the small, flat objects the
// apps and the Claude connector actually use. No fetches here — everything in this
// file is a function of its arguments, so it is what the tests pin down.
//
// Shapes come from the API's discovery document (health.googleapis.com/$discovery,
// v4). Two things about them are easy to trip on:
//   · int64 fields arrive as JSON *strings* ("count": "4211"). `int()` below turns
//     them into numbers and keeps a missing field as null rather than 0 — "no data"
//     and "zero steps" are different answers.
//   · `date` and civil times are {year, month, day} objects, not strings.

export function int(v) {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function num(v) {
  return int(v)
}

/** {year, month, day} → "YYYY-MM-DD" (null when missing). */
export function civilDate(d) {
  if (!d || !d.year) return null
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
}

/** "YYYY-MM-DD" → {year, month, day}. */
export function toCivil(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return { year, month, day }
}

/** Add whole days to a "YYYY-MM-DD" string (calendar arithmetic, no time zones). */
export function addDays(dateStr, days) {
  const { year, month, day } = toCivil(dateStr)
  const d = new Date(Date.UTC(year, month - 1, day + days))
  return d.toISOString().slice(0, 10)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export function isDate(s) {
  return typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
}

/** Inclusive day count between two "YYYY-MM-DD" strings. */
export function daySpan(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1
}

// ── Sleep ──────────────────────────────────────────────────────────────────

const ASLEEP_STAGES = new Set(['LIGHT', 'DEEP', 'REM', 'ASLEEP'])

/**
 * One `sleep` data point → a flat night.
 *
 * `onset` is when sleep actually began: the first stage that is real sleep. The
 * session's own start is when the band decided you'd gone to bed, which for an
 * auto-detected night is usually the same moment, but for a long, restless start
 * it can be half an hour earlier. Without stages it falls back to
 * start + minutesToFallAsleep.
 */
export function summarizeSleep(dp) {
  const s = dp && dp.sleep
  if (!s || !s.interval) return null
  const iv = s.interval
  const summary = s.summary || {}
  const stages = {}
  for (const st of summary.stagesSummary || []) {
    stages[String(st.type || '').toLowerCase()] = { minutes: int(st.minutes), count: int(st.count) }
  }
  const ordered = [...(s.stages || [])].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))
  const firstAsleep = ordered.find((st) => ASLEEP_STAGES.has(st.type))
  let onset = firstAsleep ? firstAsleep.startTime : null
  if (!onset && iv.startTime) {
    const toFall = int(summary.minutesToFallAsleep) || 0
    onset = new Date(Date.parse(iv.startTime) + toFall * 60000).toISOString()
  }
  const meta = s.metadata || {}
  return {
    date: civilDate(iv.civilEndTime && iv.civilEndTime.date), // the morning you woke up
    start: iv.startTime || null,
    end: iv.endTime || null,
    onset,
    utcOffset: iv.startUtcOffset || null,
    type: s.type || null,
    mainSleep: Boolean(meta.mainSleep),
    nap: Boolean(meta.nap),
    processed: meta.processed !== false,
    minutesAsleep: int(summary.minutesAsleep),
    minutesAwake: int(summary.minutesAwake),
    minutesInBed: int(summary.minutesInSleepPeriod),
    minutesToFallAsleep: int(summary.minutesToFallAsleep),
    deep: stages.deep ? stages.deep.minutes : null,
    light: stages.light ? stages.light.minutes : null,
    rem: stages.rem ? stages.rem.minutes : null,
    awake: stages.awake ? stages.awake.minutes : null,
    wakeCount: stages.awake ? stages.awake.count : null,
  }
}

// ── A window of time (a walk) ──────────────────────────────────────────────

/**
 * Roll-up responses for one window → {steps, distanceKm, floors, heart}.
 * Each argument is the `rollupDataPoints` array from a `:rollUp` call; any may be
 * missing (that call failed or the type has no data). Buckets are summed, and the
 * heart rate is the bucket average weighted by bucket length.
 */
export function summarizeWindow({ steps, distance, floors, heart } = {}) {
  const sum = (arr, pick) => {
    if (!Array.isArray(arr) || !arr.length) return null
    let total = 0
    let any = false
    for (const p of arr) {
      const v = pick(p)
      if (v !== null) { total += v; any = true }
    }
    return any ? total : null
  }
  const stepCount = sum(steps, (p) => int(p.steps && p.steps.countSum))
  const mm = sum(distance, (p) => int(p.distance && p.distance.millimetersSum))
  const floorCount = sum(floors, (p) => int(p.floors && p.floors.countSum))

  let hr = null
  if (Array.isArray(heart) && heart.length) {
    let weighted = 0
    let weight = 0
    let max = null
    let min = null
    for (const p of heart) {
      const h = p.heartRate
      if (!h || h.beatsPerMinuteAvg === undefined) continue
      const w = Math.max(1, Date.parse(p.endTime) - Date.parse(p.startTime)) || 1
      weighted += num(h.beatsPerMinuteAvg) * w
      weight += w
      if (h.beatsPerMinuteMax !== undefined) max = Math.max(max ?? -Infinity, num(h.beatsPerMinuteMax))
      if (h.beatsPerMinuteMin !== undefined) min = Math.min(min ?? Infinity, num(h.beatsPerMinuteMin))
    }
    if (weight) hr = { avg: Math.round(weighted / weight), max: max === null ? null : Math.round(max), min: min === null ? null : Math.round(min) }
  }

  return {
    steps: stepCount,
    distanceKm: mm === null ? null : Math.round(mm / 10000) / 100,
    floors: floorCount,
    heart: hr,
  }
}

/** A window the band had nothing for — steps and heart both missing. */
export function windowIsEmpty(w) {
  return !w || ((w.steps === null || w.steps === 0) && !w.heart)
}

// ── Days ───────────────────────────────────────────────────────────────────

/**
 * Daily roll-ups and daily data points → one row per date, oldest first.
 * `rollups` maps a key (steps, distance, floors, azm) to a `rollupDataPoints`
 * array from `:dailyRollUp`; `restingHr` and `hrv` are `dataPoints` arrays from
 * listing `daily-resting-heart-rate` and `daily-heart-rate-variability`.
 */
export function mergeDaily({ rollups = {}, restingHr = [], hrv = [] } = {}) {
  const rows = new Map()
  const row = (date) => {
    if (!rows.has(date)) rows.set(date, { date, steps: null, distanceKm: null, floors: null, activeZoneMinutes: null, restingHeartRate: null, hrvMs: null, deepSleepHrvMs: null })
    return rows.get(date)
  }
  for (const p of rollups.steps || []) {
    const d = civilDate(p.civilStartTime && p.civilStartTime.date)
    if (d) row(d).steps = int(p.steps && p.steps.countSum)
  }
  for (const p of rollups.distance || []) {
    const d = civilDate(p.civilStartTime && p.civilStartTime.date)
    const mm = int(p.distance && p.distance.millimetersSum)
    if (d) row(d).distanceKm = mm === null ? null : Math.round(mm / 10000) / 100
  }
  for (const p of rollups.floors || []) {
    const d = civilDate(p.civilStartTime && p.civilStartTime.date)
    if (d) row(d).floors = int(p.floors && p.floors.countSum)
  }
  for (const p of rollups.azm || []) {
    const d = civilDate(p.civilStartTime && p.civilStartTime.date)
    const a = p.activeZoneMinutes
    if (d && a) {
      const parts = [a.sumInFatBurnHeartZone, a.sumInCardioHeartZone, a.sumInPeakHeartZone].map(int)
      row(d).activeZoneMinutes = parts.every((x) => x === null) ? null : parts.reduce((t, x) => t + (x || 0), 0)
    }
  }
  for (const p of restingHr) {
    const r = p.dailyRestingHeartRate
    const d = r && civilDate(r.date)
    if (d) row(d).restingHeartRate = int(r.beatsPerMinute)
  }
  for (const p of hrv) {
    const h = p.dailyHeartRateVariability
    const d = h && civilDate(h.date)
    if (!d) continue
    const avg = num(h.averageHeartRateVariabilityMilliseconds)
    const deep = num(h.deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds)
    row(d).hrvMs = avg === null ? null : Math.round(avg * 10) / 10
    row(d).deepSleepHrvMs = deep === null ? null : Math.round(deep * 10) / 10
  }
  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date))
}

// ── Exercise ───────────────────────────────────────────────────────────────

export function summarizeExercise(dp) {
  const e = dp && dp.exercise
  if (!e || !e.interval) return null
  const m = e.metricsSummary || {}
  const mm = num(m.distanceMillimeters)
  const active = typeof e.activeDuration === 'string' ? parseFloat(e.activeDuration) : null
  return {
    name: e.displayName || e.exerciseType || null,
    type: e.exerciseType || null,
    start: e.interval.startTime || null,
    end: e.interval.endTime || null,
    activeMinutes: active === null || Number.isNaN(active) ? null : Math.round(active / 60),
    steps: int(m.steps),
    distanceKm: mm === null ? null : Math.round(mm / 10000) / 100,
    averageHeartRate: int(m.averageHeartRateBeatsPerMinute),
    activeZoneMinutes: int(m.activeZoneMinutes),
    calories: m.caloriesKcal === undefined ? null : Math.round(num(m.caloriesKcal)),
    elevationGainM: m.elevationGainMillimeters === undefined ? null : Math.round(num(m.elevationGainMillimeters) / 1000),
  }
}

// ── Filters (AIP-160, as the list endpoint documents them) ─────────────────

/**
 * How each data type is filtered by time. The filter's field prefix is the data
 * type in snake_case (`daily_heart_rate_variability.date`), and which field
 * depends on the type's kind. Only the types listed here can be listed raw.
 */
export const DATA_KINDS = {
  // interval types: interval.start_time (RFC 3339)
  steps: 'interval', distance: 'interval', floors: 'interval', altitude: 'interval',
  'active-zone-minutes': 'interval', 'active-minutes': 'interval', 'sedentary-period': 'interval',
  'time-in-heart-rate-zone': 'interval', 'total-calories': 'interval',
  // sample types: sample_time.physical_time (RFC 3339)
  'heart-rate': 'sample', 'heart-rate-variability': 'sample', 'oxygen-saturation': 'sample',
  'respiratory-rate-sleep-summary': 'sample', weight: 'sample', 'body-fat': 'sample', height: 'sample',
  'vo2-max': 'sample', 'run-vo2-max': 'sample',
  // daily types: date (YYYY-MM-DD)
  'daily-resting-heart-rate': 'daily', 'daily-heart-rate-variability': 'daily',
  'daily-oxygen-saturation': 'daily', 'daily-respiratory-rate': 'daily',
  'daily-sleep-temperature-derivations': 'daily', 'daily-heart-rate-zones': 'daily',
  'daily-vo2-max': 'daily', 'activity-level': 'daily',
  // sessions: interval.civil_start_time; sleep is the exception (end_time)
  exercise: 'session', 'hydration-log': 'session', 'nutrition-log': 'session',
  sleep: 'sleep',
}

/**
 * A time filter for listing `dataType` from `from` to `to`, both "YYYY-MM-DD",
 * inclusive. Every kind has a civil-time field, so the filter is always in the
 * user's own calendar days and never has to guess a time zone. Sleep filters on
 * the civil END time: a night belongs to the morning it ended.
 */
export function timeFilter(dataType, from, to) {
  const kind = DATA_KINDS[dataType]
  if (!kind) throw new Error(`Unsupported data type: ${dataType}`)
  const f = dataType.replace(/-/g, '_')
  const end = addDays(to, 1)
  switch (kind) {
    case 'daily':
      return `${f}.date >= "${from}" AND ${f}.date < "${end}"`
    case 'session':
      return `${f}.interval.civil_start_time >= "${from}" AND ${f}.interval.civil_start_time < "${end}"`
    case 'sleep':
      return `sleep.interval.civil_end_time >= "${from}" AND sleep.interval.civil_end_time < "${end}"`
    case 'interval':
      return `${f}.interval.civil_start_time >= "${from}" AND ${f}.interval.civil_start_time < "${end}"`
    case 'sample':
      return `${f}.sample_time.civil_time >= "${from}" AND ${f}.sample_time.civil_time < "${end}"`
    default:
      throw new Error(`Unsupported data type: ${dataType}`)
  }
}
