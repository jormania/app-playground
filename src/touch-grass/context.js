import { getTimes, getMoonIllumination } from 'suncalc'

// 0 at a, 1 at b, linear and clamped between
function ramp(x, a, b) {
  if (a === b) return x >= a ? 1 : 0
  return Math.max(0, Math.min(1, (x - a) / (b - a)))
}

// Solar altitude, computed directly (SunCalc's own algorithm) — its bundled
// getPosition misbehaves in this build, so we do the small bit of math here.
const RAD = Math.PI / 180
const DAY_MS = 86400000
const J1970 = 2440588, J2000 = 2451545
const OBLIQUITY = RAD * 23.4397

function toDays(date) {
  return date.valueOf() / DAY_MS - 0.5 + J1970 - J2000
}
function sunAltitudeDeg(date, lat, lon) {
  const d = toDays(date)
  const M = RAD * (357.5291 + 0.98560028 * d) // solar mean anomaly
  const L = M + RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
    + RAD * 102.9372 + Math.PI // ecliptic longitude
  const dec = Math.asin(Math.sin(OBLIQUITY) * Math.sin(L))
  const ra = Math.atan2(Math.sin(L) * Math.cos(OBLIQUITY), Math.cos(L))
  const lw = RAD * -lon
  const phi = RAD * lat
  const H = RAD * (280.16 + 360.9856235 * d) - lw - ra // local hour angle
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H))
  return alt / RAD
}

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

// The sun's altitude above the horizon, in degrees — or null without a location.
export function getSunAltitude(date, coords) {
  if (!coords || typeof coords.lat !== 'number' || typeof coords.lon !== 'number') return null
  return sunAltitudeDeg(date, coords.lat, coords.lon)
}

// Golden- and blue-hour strengths (each 0..1) from the sun's real altitude, so
// the warmth creeps in and ebbs rather than switching. Both are 0 without a
// location, leaving the plain time-of-day palette untouched.
//   golden → a warm plateau across the horizon (+6° down to −4°, dawn & dusk)
//   blue   → the civil-twilight band, peaking near −5°, gone by −7° (→ night)
export function getLight(date, coords) {
  const alt = getSunAltitude(date, coords)
  if (alt == null) return { golden: 0, blue: 0 }
  const golden = Math.min(ramp(alt, 6, 2), ramp(alt, -4, -2))
  const blue = Math.min(ramp(alt, -3, -4.5), ramp(alt, -7, -5.5))
  return { golden, blue }
}

// The next "turn of the day" ahead of `date`, for a gentle countdown:
//   midnight→sunrise ⇒ sunrise · sunrise→noon ⇒ noon
//   noon→sunset ⇒ sunset · sunset→midnight ⇒ midnight
// With coordinates it uses the real sunrise / solar noon / sunset; without, it
// falls back to clock noon and midnight (no solar anchors). Returns { key, at }.
export function getNextSunAnchor(date, coords) {
  const t = date.getTime()
  const nextMidnight = new Date(date)
  nextMidnight.setHours(24, 0, 0, 0) // the upcoming local midnight

  if (coords && typeof coords.lat === 'number' && typeof coords.lon === 'number') {
    const s = getTimes(date, coords.lat, coords.lon)
    const sunrise = s.sunrise.getTime()
    const noon = s.solarNoon.getTime()
    const sunset = s.sunset.getTime()
    if ([sunrise, noon, sunset].every(Number.isFinite)) {
      if (t < sunrise) return { key: 'sunrise', at: s.sunrise }
      if (t < noon) return { key: 'noon', at: s.solarNoon }
      if (t < sunset) return { key: 'sunset', at: s.sunset }
      return { key: 'midnight', at: nextMidnight }
    }
  }

  const noonClock = new Date(date)
  noonClock.setHours(12, 0, 0, 0)
  if (t < noonClock.getTime()) return { key: 'noon', at: noonClock }
  return { key: 'midnight', at: nextMidnight }
}
