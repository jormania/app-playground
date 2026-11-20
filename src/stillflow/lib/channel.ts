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

const FOCUS_RULES: [string, string[]][] = [
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

/** Series whose names are ordinary words are written in capitals in titles (MOVE, HOME, TRUE…). */
const CAPS_ONLY = new Set(['FLOW', 'CENTER', 'MOVE', 'BREATH', 'HOME', 'TRUE', 'PRANA', 'RETURN'])
const DAY_IN_TITLE = /\b(?:Day|Week)\s*(\d{1,2})\b/i

/** Which built-in series a title belongs to, and its day, read only when both are plainly there. */
export function seriesFromTitle(title: string, defs: SeriesDef[] = BUILT_IN_SERIES): { series: string; day: number } | null {
  const day = DAY_IN_TITLE.exec(title)
  if (!day) return null
  for (const d of defs) {
    const found = CAPS_ONLY.has(d.name)
      ? new RegExp(`(^|[^A-Za-z])${d.name}([^A-Za-z]|$)`).test(title)
      : new RegExp(`(^|[^a-z])${fold(d.name)}([^a-z]|$)`).test(fold(title))
    const n = Number(day[1])
    if (found && n >= 1 && n <= d.length) return { series: d.name, day: n }
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
    publishedDate: v.publishedAt ? v.publishedAt.slice(0, 10) : undefined,
    ...reading,
    series: series?.series,
    seriesDay: series?.day,
    tags: ['from-channel', ...(fromTitle ? ['duration-from-title'] : [])],
    classificationConfidence: 'low',
    classificationSource: 'inferred',
  }
}

/** Shorts and anything too short to be a practice; videos with no duration at all are kept for review. */
export function isPractice(v: ChannelVideo): boolean {
  return v.durationSeconds == null || v.durationSeconds >= MIN_PRACTICE_SECONDS
}
