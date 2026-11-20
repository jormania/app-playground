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

export type OpenMethod = 'auto' | 'link'

export interface Preferences {
  defaultInstructor: string
  /** auto: Android intent handoff to the YouTube app; link: plain https link everywhere. */
  openMethod: OpenMethod
  preferredStyles: string[]
  preferredMaxDuration?: number
  weeklyTargetMinutes?: number
  view: 'grid' | 'list'
  welcomed: boolean
}

export const DEFAULT_PREFERENCES: Preferences = {
  defaultInstructor: 'Yoga With Adriene',
  openMethod: 'auto',
  preferredStyles: [],
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
}
