import { getTimes, getMoonIllumination } from 'suncalc'

// Moon phase from the date alone (no location needed).
// phase: 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter.
export function getMoonPhase(date) {
  const m = getMoonIllumination(date)
  return { phase: m.phase, fraction: m.fraction }
}

// Fallback thresholds (fractional hours) used when no location is available —
// shifted by season to approximate daylight at mid-Northern latitudes.
const THRESHOLDS = {
  summer: { dawnStart: 5,   dayStart: 7.5,  duskStart: 20.5, nightStart: 22.5 },
  spring: { dawnStart: 6,   dayStart: 8,    duskStart: 19.5, nightStart: 21.5 },
  autumn: { dawnStart: 6,   dayStart: 8,    duskStart: 18.5, nightStart: 20.5 },
  winter: { dawnStart: 7,   dayStart: 9,    duskStart: 16,   nightStart: 18   },
}

export function getSeason(date) {
  const m = date.getMonth()
  if (m >= 2 && m <= 4) return 'spring'
  if (m >= 5 && m <= 7) return 'summer'
  if (m >= 8 && m <= 10) return 'autumn'
  return 'winter'
}

function timeOfDayFromThresholds(date) {
  const h = date.getHours() + date.getMinutes() / 60
  const t = THRESHOLDS[getSeason(date)]
  if (h >= t.nightStart || h < t.dawnStart) return 'night'
  if (h < t.dayStart)   return 'dawn'
  if (h < t.duskStart)  return 'day'
  return 'dusk'
}

// Exact buckets from the sun's real position at a location:
//   night → before civil dawn or after civil dusk
//   dawn  → civil dawn until the end of the morning golden hour
//   day   → through to the start of the evening golden hour
//   dusk  → until civil dusk
function timeOfDayFromSun(date, coords) {
  const s = getTimes(date, coords.lat, coords.lon)
  const t = date.getTime()
  const dawn = s.dawn.getTime()
  const dayStart = s.goldenHourEnd.getTime()
  const duskStart = s.goldenHour.getTime()
  const night = s.dusk.getTime()
  if ([dawn, dayStart, duskStart, night].some(Number.isNaN)) {
    return timeOfDayFromThresholds(date) // polar day/night etc.
  }
  if (t < dawn || t >= night) return 'night'
  if (t < dayStart)  return 'dawn'
  if (t < duskStart) return 'day'
  return 'dusk'
}

export function getTimeOfDay(date, coords) {
  if (coords && typeof coords.lat === 'number' && typeof coords.lon === 'number') {
    return timeOfDayFromSun(date, coords)
  }
  return timeOfDayFromThresholds(date)
}
