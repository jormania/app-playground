/**
 * Stillflow's data model. Two halves, kept apart on purpose:
 *
 * - `Session` is catalogue metadata: what a video *is*. Shared-shaped, importable,
 *   exportable, and in a later phase possibly synced from elsewhere.
 * - Everything personal (favourite, ratings, notes, history, collections,
 *   preferences) lives in its own records keyed by session id, so replacing the
 *   catalogue on import never wipes a practice history.
 *
 * Multi-valued dimensions are plain string arrays drawn from domain/vocabulary.ts.
 */

export type Confidence = 'high' | 'medium' | 'low'
export type ClassificationSource = 'manual' | 'verified' | 'inferred'

export interface Session {
  id: string
  title: string
  description?: string
  instructor: string
  /**
   * The canonical https URL Start Practice opens. For a real video it is
   * `https://www.youtube.com/watch?v=<id>`. For a demo record it is a YouTube
   * search URL, because Stillflow never invents a video id.
   */
  youtubeUrl: string
  /** 11-character YouTube id. Empty only on demo records. */
  youtubeVideoId: string
  thumbnailUrl?: string
  durationMinutes: number
  styles: string[]
  /** 1 (very gentle) – 5 (very challenging); 0 = not yet classified. */
  intensity: number
  physicalFocus: string[]
  objectives: string[]
  energy: string[]
  experienceLevel: string[]
  timeOfDay: string[]
  equipment: string[]
  series?: string
  /** Position within `series` (Day 8 of MOVE → 8). Read from the title when absent. */
  seriesDay?: number
  publishedDate?: string
  tags: string[]
  classificationConfidence: Confidence
  classificationSource: ClassificationSource
  /** ISO date-time the record entered this catalogue. */
  dateAdded: string
  /** A clearly marked demonstration record, not a real video. */
  isDemo?: boolean
  /** Columns an import carried that Stillflow has no field for, kept rather than dropped. */
  extra?: Record<string, string>
}

export interface PracticeEntry {
  id: string
  sessionId: string
  /** YYYY-MM-DD, local date. */
  date: string
  /** Minutes practised; defaults to the session's duration. */
  minutes: number
  rating?: number
  note?: string
  /** How it felt, on the intensity scale (2 gentle, 3 steady, 4 strong). */
  feel?: number
  createdAt: string
}

export interface UserSessionData {
  sessionId: string
  favourite: boolean
  /** 1–5 stars, the latest rating given. */
  rating?: number
  notes?: string
  excluded?: boolean
}

export interface UserCollection {
  id: string
  name: string
  sessionIds: string[]
  createdAt: string
  updatedAt: string
}

/** A multi-day programme: one of Adriene's journeys, or one you define. */
export interface SeriesDef {
  id: string
  name: string
  year?: number
  /** Number of practices (days or weeks). */
  length: number
  unit: 'Day' | 'Week'
  kind: 'journey' | 'short' | 'custom'
  blurb?: string
  /** Where the series facts were checked. Absent on series you created. */
  sourceUrl?: string
  /** Lower-case names a session's `series` field may carry to belong here. */
  match: string[]
  instructor: string
}

/** idle: never started (a record may exist only to hold links). */
export type SeriesStatus = 'idle' | 'active' | 'completed' | 'abandoned'

export interface SeriesRun {
  startedAt: string
  endedAt: string
  status: 'completed' | 'abandoned'
  daysDone: number
}

/** Your journey through one series. One record per series; earlier attempts sit in `runs`. */
export interface SeriesProgress {
  seriesId: string
  status: SeriesStatus
  /** YYYY-MM-DD the current (or last) run began. */
  startedAt: string
  endedAt?: string
  /** Days ticked by hand in this run: day → date. Linked sessions in practice history count too. */
  manualDays: Record<string, string>
  /** Sessions you linked to a day yourself: day → session id. */
  links: Record<string, string>
  runs: SeriesRun[]
}

export type OpenMethod = 'auto' | 'link'

export interface Preferences {
  defaultInstructor: string
  /** auto: Android intent handoff to the YouTube app; link: plain https link everywhere. */
  openMethod: OpenMethod
  preferredStyles: string[]
  /** Intensities (1–5) you usually want; empty = no preference. */
  preferredIntensities: number[]
  /** Goals you practise for (Strength, Mobility…); empty = no preference. */
  favouriteGoals: string[]
  preferredMaxDuration?: number
  /** How Surprise Me picks when you open it. */
  surpriseMode: 'match' | 'random' | 'different' | 'challenge' | 'recovery' | 'short' | 'rediscover' | 'comfort'
  theme: 'system' | 'light' | 'dark'
  /** Offer "Did you finish…?" when you come back from YouTube. */
  askOnReturn: boolean
  weeklyTargetMinutes?: number
  view: 'grid' | 'list'
  welcomed: boolean
  /** ISO date-time of the last full backup saved from Settings. */
  lastBackupAt?: string
  /** When Today's backup suggestion was last answered "Not now"; it stays quiet for a week. */
  backupNudgeDismissedAt?: string
  /** Last check of which library videos still play on YouTube. */
  availabilityCheck?: { at: string; checked: number; gone: number }
  /** The last time the YouTube channel was checked, and what it found. */
  channelCheck?: { at: string; source: 'api' | 'rss'; found: number }
  /** Which version of the title reader last re-read channel sessions (see lib/migrations.ts). */
  seriesReaderVersion?: number
}

export const DEFAULT_PREFERENCES: Preferences = {
  defaultInstructor: 'Yoga With Adriene',
  openMethod: 'auto',
  preferredStyles: [],
  preferredIntensities: [],
  favouriteGoals: [],
  surpriseMode: 'match',
  theme: 'system',
  askOnReturn: true,
  view: 'grid',
  welcomed: false,
}

export function normalisePreferences(raw: Partial<Preferences> | undefined): Preferences {
  return { ...DEFAULT_PREFERENCES, ...(raw ?? {}) }
}

/** A full local backup: everything Stillflow keeps. */
export interface Backup {
  app: 'stillflow'
  version: 1
  exportedAt: string
  sessions: Session[]
  userData: UserSessionData[]
  history: PracticeEntry[]
  collections: UserCollection[]
  preferences: Preferences
  /** Added after the first release; absent in older backups. */
  seriesProgress?: SeriesProgress[]
  customSeries?: SeriesDef[]
}
