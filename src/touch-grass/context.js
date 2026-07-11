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

// A plain name for the moon's phase (the four cardinal phases get a small
// tolerance so "full" / "new" / the quarters land on the right night).
export function moonPhaseName(phase) {
  const p = ((phase % 1) + 1) % 1
  const eps = 0.02
  if (p < eps || p > 1 - eps) return 'new moon'
  if (Math.abs(p - 0.25) < eps) return 'first quarter'
  if (Math.abs(p - 0.5) < eps) return 'full moon'
  if (Math.abs(p - 0.75) < eps) return 'last quarter'
  if (p < 0.25) return 'waxing crescent'
  if (p < 0.5) return 'waxing gibbous'
  if (p < 0.75) return 'waning gibbous'
  return 'waning crescent'
}

// Days until the next full moon, from the phase alone (full is at phase 0.5).
// The mean synodic month is close enough for a "x days to full moon" line.
const SYNODIC_MONTH = 29.530588853
export function daysToFullMoon(phase) {
  const p = ((phase % 1) + 1) % 1
  const target = p <= 0.5 ? 0.5 : 1.5
  return (target - p) * SYNODIC_MONTH
}

// Solar declination (degrees) — the precise value (same maths as the altitude),
// good for working out where on the horizon the sun rises and sets.
export function sunDeclinationDeg(date) {
  const d = toDays(date)
  const M = RAD * (357.5291 + 0.98560028 * d)
  const L = M + RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + RAD * 102.9372 + Math.PI
  return Math.asin(Math.sin(OBLIQUITY) * Math.sin(L)) / RAD
}

// Lunar declination (degrees), from SunCalc's own moon-coordinate maths (only its
// horizontal transform misbehaves in this build, not the ra/dec it derives).
export function moonDeclinationDeg(date) {
  const d = toDays(date)
  const L = RAD * (218.316 + 13.176396 * d)
  const M = RAD * (134.963 + 13.064993 * d)
  const F = RAD * (93.272 + 13.229350 * d)
  const l = L + RAD * 6.289 * Math.sin(M) // ecliptic longitude
  const b = RAD * 5.128 * Math.sin(F)     // ecliptic latitude
  return Math.asin(Math.sin(b) * Math.cos(OBLIQUITY) + Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l)) / RAD
}

const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest']
function compass8(az) { return COMPASS[Math.round((((az % 360) + 360) % 360) / 45) % 8] }

// Where a body of declination `decDeg` rises and sets on the horizon at latitude
// `latDeg` (the "amplitude" formula). Null when it doesn't rise/set (circumpolar).
export function riseSetDirections(decDeg, latDeg) {
  const x = Math.sin(decDeg * RAD) / Math.cos(latDeg * RAD)
  if (!(x >= -1 && x <= 1)) return null
  const A = Math.acos(x) / RAD // 0..180 from north, on the eastern (rising) side
  return { rise: compass8(A), set: compass8(360 - A) }
}

// The start of the evening golden hour at a location, or null without one — used
// for the "the light turns to honey" whisper while out.
export function getGoldenHourStart(date, coords) {
  if (!coords || typeof coords.lat !== 'number' || typeof coords.lon !== 'number') return null
  const g = getTimes(date, coords.lat, coords.lon).goldenHour
  return g && Number.isFinite(g.getTime()) ? g : null
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

// A continuous 0 (night) → 1 (comfortably risen day) progress from the sun's
// real altitude, ramped smoothly across civil twilight — the same
// off-real-altitude technique as getLight() above (and Yoru's twilight()):
// a plain ramp(), not a lookup keyed by the coarse dawn/day/dusk/night bucket.
// Lets Stage.jsx's ground lightness transition gradually through dusk/dawn
// instead of snapping the instant timeOfDay flips. Null without a location —
// there's no real altitude to ramp from, so the caller falls back to the
// bucketed value, same as every other real-sun feature here degrades.
export function getDaylightProgress(date, coords) {
  const alt = getSunAltitude(date, coords)
  return alt == null ? null : ramp(alt, -8, 6)
}

// The next "turn of the day" ahead of `date`, for a gentle countdown:
//   midnight→sunrise ⇒ sunrise · sunrise→noon ⇒ noon
//   noon→sunset ⇒ sunset · sunset→midnight ⇒ midnight
// With coordinates it uses the real sunrise / solar noon / sunset; without, it
// falls back to clock noon and midnight (no solar anchors). Returns { key, at }.
export function getNextSunAnchor(date, coords) {
  const t = date.getTime()
  const cands = []

  // the upcoming local midnights
  for (const off of [1, 2]) {
    const m = new Date(date)
    m.setHours(0, 0, 0, 0)
    m.setDate(m.getDate() + off)
    cands.push({ key: 'midnight', at: m })
  }

  if (coords && typeof coords.lat === 'number' && typeof coords.lon === 'number') {
    // gather real solar turns across neighbouring days — SunCalc anchors on the
    // nearest solar noon, so just after midnight today's call returns yesterday's
    // events; spanning ±days and picking the soonest future one avoids that trap
    for (const off of [-1, 0, 1, 2]) {
      const d = new Date(date)
      d.setDate(d.getDate() + off)
      const s = getTimes(d, coords.lat, coords.lon)
      if (Number.isFinite(s.sunrise.getTime())) cands.push({ key: 'sunrise', at: s.sunrise })
      if (Number.isFinite(s.solarNoon.getTime())) cands.push({ key: 'noon', at: s.solarNoon })
      if (Number.isFinite(s.sunset.getTime())) cands.push({ key: 'sunset', at: s.sunset })
    }
  } else {
    // no location → clock noon and midnight only
    for (const off of [0, 1]) {
      const noon = new Date(date)
      noon.setHours(12, 0, 0, 0)
      noon.setDate(noon.getDate() + off)
      cands.push({ key: 'noon', at: noon })
    }
  }

  const future = cands
    .filter(c => c.at.getTime() > t)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
  return future[0] || cands[0]
}
