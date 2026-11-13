// The handful of questions the apps and the Claude connector ask, each built from
// the API's four read methods (list, rollUp, dailyRollUp, reconcile). Shaping lives
// in normalize.js; this file only decides what to fetch.
import { healthFetch, HealthError } from './client.js'
import {
  summarizeSleep, summarizeWindow, mergeDaily, summarizeExercise,
  timeFilter, toCivil, addDays, daySpan, isDate, DATA_KINDS,
} from './normalize.js'

const USER = 'users/me/dataTypes/'
const MAX_DAYS = 90 // the API's roll-up ceiling for most types
const MAX_HR_DAYS = 14 // heart-rate roll-ups are capped at 14 days
const MAX_PAGES = 8

export function checkDates(from, to, maxDays = MAX_DAYS) {
  if (!isDate(from) || !isDate(to)) throw new HealthError('Dates must be YYYY-MM-DD.', 400, 'bad_request')
  const span = daySpan(from, to)
  if (span < 1) throw new HealthError('`from` must be on or before `to`.', 400, 'bad_request')
  if (span > maxDays) throw new HealthError(`At most ${maxDays} days per request.`, 400, 'bad_request')
}

export function checkInstants(start, end, maxDays) {
  const a = Date.parse(start)
  const b = Date.parse(end)
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new HealthError('Times must be ISO 8601 (RFC 3339).', 400, 'bad_request')
  if (b <= a) throw new HealthError('`end` must be after `start`.', 400, 'bad_request')
  if (b - a > maxDays * 86400000) throw new HealthError(`At most ${maxDays} days per request.`, 400, 'bad_request')
  return { a, b }
}

/** List every data point of a type in a civil date range, following pages. */
export async function listPoints(dataType, from, to, { pageSize, maxPages = MAX_PAGES } = {}) {
  const out = []
  let pageToken
  for (let i = 0; i < maxPages; i++) {
    const data = await healthFetch(`${USER}${dataType}/dataPoints`, {
      query: { filter: timeFilter(dataType, from, to), pageSize, pageToken },
    })
    out.push(...(data.dataPoints || []))
    pageToken = data.nextPageToken
    if (!pageToken) break
  }
  return out
}

async function rollUp(dataType, start, end, windowSec) {
  const out = []
  let pageToken
  for (let i = 0; i < MAX_PAGES; i++) {
    const data = await healthFetch(`${USER}${dataType}/dataPoints:rollUp`, {
      method: 'POST',
      body: { range: { startTime: start, endTime: end }, windowSize: `${windowSec}s`, pageSize: 10000, pageToken },
    })
    out.push(...(data.rollupDataPoints || []))
    pageToken = data.nextPageToken
    if (!pageToken) break
  }
  return out
}

async function dailyRollUp(dataType, from, to) {
  const data = await healthFetch(`${USER}${dataType}/dataPoints:dailyRollUp`, {
    method: 'POST',
    body: { range: { start: { date: toCivil(from) }, end: { date: toCivil(addDays(to, 1)) } }, windowSizeDays: 1, pageSize: 90 },
  })
  return data.rollupDataPoints || []
}

/** A failed optional part becomes null instead of failing the whole answer. */
async function soft(promise) {
  try { return await promise } catch (err) {
    if (err instanceof HealthError && (err.code === 'not_connected' || err.code === 'reconnect')) throw err
    return null
  }
}

/** Nights that ended between `from` and `to` (wake-up dates), oldest first. */
export async function getSleep(from, to) {
  checkDates(from, to)
  const points = await listPoints('sleep', from, to, { pageSize: 25 })
  return points.map(summarizeSleep).filter(Boolean).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
}

/** Steps, distance, floors and heart rate for one window (a walk). */
export async function getWindow(start, end) {
  const { a, b } = checkInstants(start, end, 1)
  const startIso = new Date(a).toISOString()
  const endIso = new Date(b).toISOString()
  const whole = Math.max(1, Math.ceil((b - a) / 1000))
  const [steps, distance, floors, heart] = await Promise.all([
    soft(rollUp('steps', startIso, endIso, whole)),
    soft(rollUp('distance', startIso, endIso, whole)),
    soft(rollUp('floors', startIso, endIso, whole)),
    soft(rollUp('heart-rate', startIso, endIso, whole)),
  ])
  return { start: startIso, end: endIso, ...summarizeWindow({ steps, distance, floors, heart }) }
}

/** One row per day: steps, distance, floors, Active Zone Minutes, resting HR, HRV. */
export async function getDaily(from, to) {
  checkDates(from, to)
  const [steps, distance, floors, azm, restingHr, hrv] = await Promise.all([
    soft(dailyRollUp('steps', from, to)),
    soft(dailyRollUp('distance', from, to)),
    soft(dailyRollUp('floors', from, to)),
    soft(dailyRollUp('active-zone-minutes', from, to)),
    soft(listPoints('daily-resting-heart-rate', from, to)),
    soft(listPoints('daily-heart-rate-variability', from, to)),
  ])
  return mergeDaily({ rollups: { steps, distance, floors, azm }, restingHr: restingHr || [], hrv: hrv || [] })
}

/** Heart rate in windows of `windowMinutes` (avg/min/max), at most 14 days. */
export async function getHeartRate(start, end, windowMinutes = 15) {
  const { a, b } = checkInstants(start, end, MAX_HR_DAYS)
  const win = Math.max(1, Math.round(windowMinutes)) * 60
  if ((b - a) / 1000 / win > 2000) throw new HealthError('Too many windows — widen window_minutes.', 400, 'bad_request')
  const points = await rollUp('heart-rate', new Date(a).toISOString(), new Date(b).toISOString(), win)
  return points
    .filter((p) => p.heartRate && p.heartRate.beatsPerMinuteAvg !== undefined)
    .map((p) => ({
      start: p.startTime,
      end: p.endTime,
      avg: Math.round(Number(p.heartRate.beatsPerMinuteAvg)),
      min: p.heartRate.beatsPerMinuteMin === undefined ? null : Math.round(Number(p.heartRate.beatsPerMinuteMin)),
      max: p.heartRate.beatsPerMinuteMax === undefined ? null : Math.round(Number(p.heartRate.beatsPerMinuteMax)),
    }))
}

/** Steps in windows of `windowMinutes`, at most 14 days. */
export async function getSteps(start, end, windowMinutes = 60) {
  const { a, b } = checkInstants(start, end, MAX_HR_DAYS)
  const win = Math.max(1, Math.round(windowMinutes)) * 60
  if ((b - a) / 1000 / win > 2000) throw new HealthError('Too many windows — widen window_minutes.', 400, 'bad_request')
  const points = await rollUp('steps', new Date(a).toISOString(), new Date(b).toISOString(), win)
  return points.map((p) => ({ start: p.startTime, end: p.endTime, steps: p.steps ? Number(p.steps.countSum) : 0 }))
}

export async function getExercises(from, to) {
  checkDates(from, to)
  const points = await listPoints('exercise', from, to, { pageSize: 25 })
  return points.map(summarizeExercise).filter(Boolean).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
}

/**
 * Raw data points of any listed type — the escape hatch for questions the shaped
 * tools don't cover (SpO₂, breathing rate, skin temperature, weight…). Capped so a
 * year of 5-second heart rate can't be dragged through one call.
 */
export async function getRaw(dataType, from, to, limit = 200) {
  if (!DATA_KINDS[dataType]) throw new HealthError(`Unsupported data type: ${dataType}`, 400, 'bad_request')
  checkDates(from, to, dataType === 'heart-rate' ? 2 : MAX_DAYS)
  const cap = Math.min(Math.max(1, Math.round(limit) || 200), 1000)
  // Sleep and exercise pages hold at most 25 points; everything else up to 10 000.
  const small = dataType === 'sleep' || dataType === 'exercise'
  const pageSize = small ? 25 : cap
  const points = await listPoints(dataType, from, to, { pageSize, maxPages: small ? Math.min(MAX_PAGES, Math.ceil(cap / 25)) : 1 })
  // `dataSource` and an empty `name` are noise for a reader; drop them.
  return points.slice(0, cap).map((p) => {
    const out = { ...p }
    delete out.dataSource
    if (!out.name) delete out.name
    return out
  })
}
