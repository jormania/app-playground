// The daily call — one in-character notification ~2 hours before sunset.
// Pure helpers here (timing, "walked today?", message); the scheduling that
// uses them lives in useDailyCall.js.

import { getTimes } from 'suncalc'
import { dayKey } from '../shared/notify/dayKey'

const FALLBACK_HOUR = 16.5 // 16:30 local, used when there's no location for a real sunset
const TWO_HOURS = 2 * 3600 * 1000
const HALF_HOUR = 30 * 60 * 1000

// local YYYY-MM-DD — for "once per day" and "walked today" checks
export function todayKey(date = new Date()) {
  return dayKey(date)
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

// 30 min before the evening golden hour begins (the heads-up), or null without
// a usable sun (no location, or polar day/night)
export function goldenNotifyTime(date, coords) {
  if (coords && typeof coords.lat === 'number' && typeof coords.lon === 'number') {
    const g = getTimes(date, coords.lat, coords.lon).goldenHour // evening golden hour start
    if (g && Number.isFinite(g.getTime())) return new Date(g.getTime() - HALF_HOUR)
  }
  return null
}

const GOLDEN = [
  'The light is about to turn to honey — step out and stand in it.',
  'Golden hour is gathering. Go let it find you outside.',
  'The long warm light is nearly here. The screen will keep; the gold will not.',
  'In a little while the world goes gold. Be under it.',
]
export function buildGoldenBody() { return pick(GOLDEN) }

// the almanac announcement for today's moment(s), or '' if there's none
export function buildAlmanacBody(moments) {
  if (!moments || !moments.length) return ''
  const m = moments[0]
  const name = m.name || 'something rare'
  if (m.meteor) return `Tonight, ${name} — find a dark patch of grass and look up.`
  return `Today, ${name}. The sky is marking it — go and stand in it.`
}
