// Thresholds are in fractional hours and shift with season to approximate
// actual daylight patterns at mid-Northern latitudes without geolocation.
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

export function getTimeOfDay(date) {
  const h = date.getHours() + date.getMinutes() / 60
  const t = THRESHOLDS[getSeason(date)]
  if (h >= t.nightStart || h < t.dawnStart) return 'night'
  if (h < t.dayStart)   return 'dawn'
  if (h < t.duskStart)  return 'day'
  return 'dusk'
}
