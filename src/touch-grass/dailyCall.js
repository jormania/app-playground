// The daily call — one in-character notification ~2 hours before sunset.
// Pure helpers here (timing, "walked today?", message); the scheduling that
// uses them lives in useDailyCall.js.

import { getTimes } from 'suncalc'

const FALLBACK_HOUR = 16.5 // 16:30 local, used when there's no location for a real sunset
const TWO_HOURS = 2 * 3600 * 1000

// local YYYY-MM-DD — for "once per day" and "walked today" checks
export function todayKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// the most recent walk taken on `date`'s calendar day, or null
export function walkToday(history, date = new Date()) {
  if (!Array.isArray(history)) return null
  const key = todayKey(date)
  return history.find(w => w && w.ts && todayKey(new Date(w.ts)) === key) || null
}

// when today's call should fire: two hours before the real sunset (with coords),
// else a late-afternoon clock fallback
export function nextCallTime(date, coords) {
  if (coords && typeof coords.lat === 'number' && typeof coords.lon === 'number') {
    const sunset = getTimes(date, coords.lat, coords.lon).sunset
    if (sunset && Number.isFinite(sunset.getTime())) {
      return new Date(sunset.getTime() - TWO_HOURS)
    }
  }
  const t = new Date(date)
  t.setHours(Math.floor(FALLBACK_HOUR), Math.round((FALLBACK_HOUR % 1) * 60), 0, 0)
  return t
}

const NUDGE = [
  'Two hours of light left. Somewhere out there a small strange thing is already waiting — go meet it.',
  'The sun is getting low. The grass will keep; the hour will not. Step outside.',
  'The light is thinning. Leave the screen behind and see what the world set out for you today.',
  'Dusk is on its way. There is still time to walk, and still something out there to find.',
]
const WALKED = [
  name => `You have been out today — ${name} is yours now. The light is still good, if it calls you again.`,
  name => `Today's walk is done and ${name} is kept. Rest, or go once more before dark — either is right.`,
  () => 'You walked today; the world noticed. Go again if you like, or let the evening be still.',
]

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// the in-character notification body, given today's walk (or null if none yet)
export function buildMessage(walk) {
  if (walk) {
    const name = walk.discovery && walk.discovery.name ? walk.discovery.name : 'your find'
    return pick(WALKED)(name)
  }
  return pick(NUDGE)
}
