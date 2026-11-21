import { BUILT_IN_SERIES } from '../data/series'
import type { SeriesDef } from '../domain/types'
import { fold } from './filter'

/**
 * Reading Yoga With Adriene's YouTube channel into the catalogue, on request.
 *
 * The app asks /api/youtube-channel for one page of uploads at a time (newest
 * first) and turns each video into an import record, which then goes through
 * the ordinary import preview. Nothing is written without your confirmation.
 *
 * What comes from YouTube is taken as fact: title, description, video id,
 * duration, publish date. What is read from the title (style, body area, a
 * provisional intensity, the series and day) is a guess. It is always marked
 * `inferred` / `low` and shown as "Provisional tags" until you review it.
 */

/** Checked against a channel mirror and Yoga With Adriene's own links (@yogawithadriene). */
export const YWA_CHANNEL = { id: 'UCFKE7WVJfvaHW5q283SxchA', handle: '@yogawithadriene', name: 'Yoga With Adriene' }

/** Shorts and teasers: under this many seconds a video isn't treated as a practice. */
export const MIN_PRACTICE_SECONDS = 4 * 60

export interface ChannelVideo {
  videoId: string
  title: string
  description: string
  publishedAt: string | null
  durationSeconds: number | null
}

export interface ChannelPage {
  source: 'api' | 'rss'
  videos: ChannelVideo[]
  nextPageToken: string | null
  total: number | null
}

export type FetchPage = (pageToken: string | null) => Promise<ChannelPage>

export function apiFetchPage(channelId = YWA_CHANNEL.id): FetchPage {
  return async (pageToken) => {
    const q = new URLSearchParams({ channel: channelId, ...(pageToken ? { pageToken } : {}) })
    const res = await fetch(`/api/youtube-channel?${q}`)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body?.message || `The channel could not be read (${res.status}).`)
    return body as ChannelPage
  }
}

export type CheckIds = (ids: string[]) => Promise<{ checked: string[]; available: string[] }>

export function apiCheckIds(): CheckIds {
  return async (ids) => {
    const res = await fetch(`/api/youtube-channel?ids=${ids.join(',')}`)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body?.message || `YouTube could not be asked (${res.status}).`)
    return body as { checked: string[]; available: string[] }
  }
}

/** Every video id in the library, asked fifty at a time. */
export async function checkLibrary(
  videoIds: string[], check: CheckIds, onProgress?: (done: number, total: number) => void,
): Promise<{ checked: string[]; available: string[] }> {
  const ids = [...new Set(videoIds)]
  const checked: string[] = []
  const available: string[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const r = await check(ids.slice(i, i + 50))
    checked.push(...r.checked)
    available.push(...r.available)
    onProgress?.(checked.length, ids.length)
  }
  return { checked, available }
}

export interface ScanResult {
  source: 'api' | 'rss'
  videos: ChannelVideo[]
  /** Videos read, before any filtering. */
  read: number
  total: number | null
  /** True when an update check stopped because it reached videos already in the library. */
  caughtUp: boolean
}

/**
 * Walks the uploads newest first. `updates` stops at the first page that holds
 * only videos you already have (the channel is newest-first, so the rest are
 * older); `all` reads to the end. A hard cap keeps a runaway loop impossible.
 */
export async function scanChannel(opts: {
  mode: 'updates' | 'all'
  knownIds: Set<string>
  fetchPage: FetchPage
  onProgress?: (read: number, total: number | null) => void
  maxPages?: number
}): Promise<ScanResult> {
  const { mode, knownIds, fetchPage, onProgress, maxPages = 40 } = opts
  const videos: ChannelVideo[] = []
  let token: string | null = null
  let source: 'api' | 'rss' = 'rss'
  let total: number | null = null
  let caughtUp = false
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPage(token)
    source = page.source
    total = page.total ?? total
    videos.push(...page.videos)
    onProgress?.(videos.length, total)
    if (mode === 'updates' && page.videos.length > 0 && page.videos.every((v) => knownIds.has(v.videoId))) {
      caughtUp = true
      break
    }
    if (!page.nextPageToken) break
    token = page.nextPageToken
  }
  return { source, videos, read: videos.length, total, caughtUp }
}

// ── Reading a title ────────────────────────────────────────────────────────

const has = (text: string, words: string[]) => words.some((w) => new RegExp(`\\b${w}`).test(text))

const STYLE_RULES: [string, string[]][] = [
  ['Yin Yoga', ['yin yoga', 'yin ']],
  ['Restorative', ['restorative']],
  ['Power Yoga', ['power yoga', 'power flow']],
  ['Vinyasa', ['vinyasa']],
  ['Hatha', ['hatha']],
  ['Gentle Yoga', ['gentle']],
  ['Slow Flow', ['slow flow']],
  ['Morning Yoga', ['morning', 'wake up', 'wake-up']],
  ['Evening Yoga', ['bedtime', 'evening', 'night', 'sleep', 'unwind']],
  ['Meditation', ['meditation', 'meditate']],
  ['Breathwork', ['breathing', 'breathwork', 'breath work', 'pranayama']],
  ['Yoga Nidra', ['nidra']],
]

export const FOCUS_RULES: [string, string[]][] = [
  ['Hip flexors', ['hip flexor', 'psoas']],
  ['Hips', ['hips', 'hip opening', 'hip opener', 'hip ']],
  ['Lower back', ['lower back', 'low back', 'sciatica']],
  ['Upper back', ['upper back']],
  ['Back', ['back pain', 'back care', 'for your back', 'spine', 'spinal', 'back ']],
  ['Neck', ['neck']],
  ['Shoulders', ['shoulder']],
  ['Wrists', ['wrist', 'hands free', 'carpal']],
  ['Core', ['core', 'abs ', 'abdominal']],
  ['Glutes', ['glute', 'booty']],
  ['Hamstrings', ['hamstring']],
  ['Quadriceps', ['quad']],
  ['Legs', ['legs', 'leg ', 'knee']],
  ['Feet', ['feet', 'foot']],
  ['Ankles', ['ankle']],
  ['Chest', ['chest', 'heart opener', 'heart opening']],
  ['Full body', ['full body', 'total body', 'whole body', 'full-body']],
]

const OBJECTIVE_RULES: [string, string[]][] = [
  ['Strength', ['strength', 'strong', 'tone', 'toning']],
  ['Flexibility', ['flexib', 'stretch']],
  ['Mobility', ['mobility', 'mobilize', 'mobilise']],
  ['Balance', ['balance']],
  ['Posture', ['posture']],
  ['Stress reduction', ['stress', 'anxiety', 'anxious', 'overwhelm']],
  ['Energy', ['energy', 'energiz', 'energis', 'wake up']],
  ['Relaxation', ['relax', 'calm', 'unwind', 'sleep', 'bedtime']],
  ['Recovery', ['recover', 'runners', 'after running', 'sore']],
  ['Mindfulness', ['mindful', 'meditation']],
]

/**
 * Which built-in series a title belongs to, and its day. Built from the
 * channel's real titles (all 821 read on 2026-11-20), whose format changed
 * almost every year:
 *
 *   "Day 4 - Yoga For Your Back - 30 Days of Yoga"    2015: day first, series last
 *   "Day 24  |  Gentle Yummy Yoga  |  30 Days of Yoga"
 *   "Yoga Camp Day 1 - I Accept", "Yoga Camp - Day 11 - I Release"
 *   "Revolution - Day 4 - PRANA Practice"             series first, then the day
 *   "TRUE - Day 12 - CENTER  |  Yoga With Adriene"
 *   "Dedicate - Day 5 - Flow", "Center - Day 17 - Move", "Flow - Day 21 - Curious"
 *   "Home - Day 7 - Stretch  |  30 Days of Yoga", "Unwind  -  Home - Day 25"
 *   "Day 8 - Snuggle  |  BREATH - A 30 Day Yoga Journey"
 *   "Day 14 - Closer  |  MOVE - A 30 Day Yoga Journey", "Move - Day 28 - TLC"
 *   "Prana - Day 3", "Return - 2 - Ground"
 *
 * The rule that survives all of them: the series is the name written right
 * before the day ("Center - Day 17"), or, in titles that open with "Day N",
 * the last segment. Other series names in a title ("TRUE - Day 12 - CENTER")
 * are the day's theme, not its series. Day 0 (a welcome) and bonus days past
 * the series length are left out.
 */
export function seriesFromTitle(title: string, defs: SeriesDef[] = BUILT_IN_SERIES): { series: string; day: number } | null {
  const t = fold(title).replace(/\s+/g, ' ').trim()
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let best: { series: string; day: number; at: number } | null = null

  // 1. "<name> - Day N", "<name> Day N", "<name> - N - <theme>"
  for (const d of defs) {
    for (const alias of d.match) {
      // A bare number counts only between dashes ("Return - 2 - Ground"), so "Prana 7-Day" stays out.
      const re = new RegExp(`(^|[^a-z0-9])${esc(fold(alias))}(?: ?-? ?(?:day|week) ?(\\d{1,2})\\b| ?- ?(\\d{1,2}) ?- )`)
      const m = re.exec(t)
      if (!m) continue
      const day = Number(m[2] ?? m[3])
      const at = m.index + m[1].length
      if (day >= 1 && day <= d.length && (!best || at < best.at)) best = { series: d.name, day, at }
    }
  }
  if (best) return { series: best.series, day: best.day }

  // 2. "Day N - <theme> | <name> - A 30 Day Yoga Journey" and "Day N - <theme> - 30 Days of Yoga"
  const lead = /^day ?(\d{1,2})\b/.exec(t)
  if (!lead) return null
  const parts = t.includes('|') ? t.split('|') : t.split(/ ?- ?/)
  const tail = parts[parts.length - 1].replace(/ ?- ?a 30 day yoga journey$/, '').trim()
  const day = Number(lead[1])
  for (const d of defs) {
    if (d.match.some((alias) => fold(alias) === tail) && day >= 1 && day <= d.length) return { series: d.name, day }
  }
  return null
}

export interface TitleReading {
  styles: string[]
  physicalFocus: string[]
  objectives: string[]
  timeOfDay: string[]
  experienceLevel: string[]
  /** 0 unless the title plainly says gentle or strong. */
  intensity: number
}

export function readTitle(title: string): TitleReading {
  const t = ` ${fold(title)} `
  const pickAll = (rules: [string, string[]][]) => rules.filter(([, words]) => has(t, words)).map(([v]) => v)
  const styles = pickAll(STYLE_RULES)
  let focus = pickAll(FOCUS_RULES)
  // "Lower back" already says Back; keep the specific one.
  if (focus.includes('Lower back') || focus.includes('Upper back')) focus = focus.filter((f) => f !== 'Back')
  if (focus.includes('Hip flexors') && !has(t, ['hips'])) focus = focus.filter((f) => f !== 'Hips')
  const timeOfDay = [
    ...(styles.includes('Morning Yoga') ? ['Morning'] : []),
    ...(has(t, ['bedtime', 'sleep']) ? ['Before bed'] : has(t, ['evening', 'night']) ? ['Evening'] : []),
  ]
  let intensity = 0
  if (has(t, ['restorative', 'nidra', 'bedtime', 'sleep', 'yin '])) intensity = 1
  else if (has(t, ['gentle', 'beginners', 'beginner', 'relax'])) intensity = 2
  else if (has(t, ['power', 'sweat', 'intense', 'challenge', 'advanced', 'hiit'])) intensity = 4
  return {
    styles,
    physicalFocus: focus,
    objectives: pickAll(OBJECTIVE_RULES),
    timeOfDay,
    experienceLevel: has(t, ['beginner', 'beginners']) ? ['Beginner'] : has(t, ['advanced']) ? ['Advanced'] : [],
    intensity,
  }
}

/** Minutes read from "20 Minute", "20-Min", "20 min" in a title: only for feed videos, which carry no duration. */
export function minutesFromTitle(title: string): number | null {
  const m = /\b(\d{1,3})\s*-?\s*(?:minutes?|mins?)\b/i.exec(title)
  const n = m ? Number(m[1]) : NaN
  return n >= 1 && n <= 240 ? n : null
}

/** One channel video → a raw import record for importExport.normaliseRecord. */
export function videoToRecord(v: ChannelVideo, instructor = YWA_CHANNEL.name): Record<string, unknown> {
  const reading = readTitle(v.title)
  const series = seriesFromTitle(v.title)
  const fromTitle = v.durationSeconds == null ? minutesFromTitle(v.title) : null
  const minutes = v.durationSeconds != null ? Math.max(1, Math.round(v.durationSeconds / 60)) : fromTitle
  return {
    title: v.title,
    description: v.description || undefined,
    instructor,
    youtubeVideoId: v.videoId,
    durationMinutes: minutes ?? '',
    publishedDate: publishedDay(v.publishedAt),
    ...reading,
    series: series?.series,
    seriesDay: series?.day,
    tags: ['from-channel', ...(fromTitle ? ['duration-from-title'] : [])],
    classificationConfidence: 'low',
    classificationSource: 'inferred',
  }
}

/** The day a video went up, on your calendar rather than UTC's (YouTube shows it the same way). */
export function publishedDay(iso: string | null): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : undefined
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Shorts and anything too short to be a practice; videos with no duration at all are kept for review. */
export function isPractice(v: ChannelVideo): boolean {
  return v.durationSeconds == null || v.durationSeconds >= MIN_PRACTICE_SECONDS
}
