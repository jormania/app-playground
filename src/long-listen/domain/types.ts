/**
 * The Long Listen's knowledge model.
 *
 * Three ideas shape everything here (LONG_LISTEN.md §3):
 *
 * - A **recording is not an attribute of a work**. A Work has many Recordings;
 *   a Recording names its own conductor, orchestra and soloists, carries its own
 *   interpretive character, and may sit on an Album. Listening and feedback point
 *   at the recording, never just the work.
 * - A **theme is a thread, not a week**. A Theme collects Explorations, one per
 *   week it was chosen, and keeps what was covered, how it landed, and where it
 *   could go next. A returning theme continues from that, it never restarts.
 * - A **programme is a snapshot**. What the curator wrote, and what it proposed,
 *   is frozen in the Programme the week it was made. Spotify verification adds a
 *   link beside it later; it never rewrites the curator's text.
 *
 * Taste is deliberately not a vector of scores: it is a set of observations in
 * prose, each with the evidence that produced it and how settled it is.
 */

/** ISO week key in the listener's own time zone, e.g. `2026-W41`. */
export type WeekKey = string
/** Calendar date, `YYYY-MM-DD`. */
export type ISODate = string
/** Instant, `new Date().toISOString()`. */
export type Instant = string

// ── People ────────────────────────────────────────────────────────────────

export type ArtistKind = 'composer' | 'conductor' | 'orchestra' | 'ensemble' | 'choir' | 'soloist'

/** Anyone who makes the music: a composer, a conductor, an orchestra, a soloist. */
export interface Artist {
  id: string
  name: string
  kind: ArtistKind
  /** e.g. "piano", "violin" — soloists only. */
  instrument?: string
  /** Filled in when a verified Spotify recording credits them. */
  spotifyArtistId?: string
}

// ── Music ─────────────────────────────────────────────────────────────────

export interface Movement {
  index: number
  title: string
}

export interface Work {
  id: string
  composerId: string
  title: string
  /** "Op. 67", "BWV 1048", "K. 550" */
  catalogue?: string
  /** As the curator gave it — "1903–05". Curatorial, shown as such. */
  composed?: string
  /** "symphony", "symphonic poem", "concerto" … */
  form?: string
  /** One or two sentences of historical context. */
  context?: string
  movements?: Movement[]
}

/** What Spotify confirmed about a recording — the factual layer. */
export interface SpotifyRecordingRef {
  albumId: string
  albumName: string
  albumUri: string
  /** Spotify's album release date — not necessarily the recording date. */
  releaseDate?: string
  /** From the album's ℗ line; Spotify no longer exposes `label` (Feb 2026). */
  phonographic?: string
  imageUrl?: string
  /** Every artist Spotify credits on the matched tracks. */
  artistNames: string[]
  /** The tracks that make up this work on this album, in order. */
  trackIds: string[]
  trackUris: string[]
  /** What the matcher saw, for honesty about a near miss. */
  confidence: 'strong' | 'probable'
  matchedAt: Instant
}

export type Verification = 'unchecked' | 'verified' | 'not-found'

export interface Recording {
  id: string
  workId: string
  conductorId?: string
  orchestraId?: string
  ensembleId?: string
  soloistIds: string[]
  /** As proposed by the curator, e.g. "1975". Shown only as "c." and never as fact. */
  proposedYear?: string
  /** Curatorial: what this interpretation is like ("architectural, transparent"). */
  character: string[]
  verification: Verification
  spotify?: SpotifyRecordingRef
  albumId?: string
  checkedAt?: Instant
}

/** An album as Spotify knows it. One album can hold several works. */
export interface Album {
  id: string // Spotify album id
  name: string
  releaseDate?: string
  imageUrl?: string
  artistNames: string[]
  phonographic?: string
  recordingIds: string[]
}

// ── Themes and weeks ──────────────────────────────────────────────────────

export interface Theme {
  id: string
  title: string
  summary: string
  firstIntroduced: WeekKey
  explorationIds: string[]
  /** The curator's reading of how it landed, rewritten after each exploration. */
  reaction?: string
  openQuestions: string[]
  adjacentTopics: string[]
  nextDirections: string[]
  updatedAt: Instant
}

export interface ThemeExploration {
  id: string
  themeId: string
  weekKey: WeekKey
  /** 1 for the first visit, 2 for the first return, … */
  stage: number
  /** The route taken this time. */
  angle: string
  programmeId: string
  /** Set when the week ended and the continuity planner read it. */
  closedAt?: Instant
  closingNote?: string
  /**
   * The listener changed direction that week. The programme stays in the
   * record, but only what they actually heard of it counts as covered.
   */
  setAside?: boolean
}

export type OptionMood = 'immersive' | 'curious' | 'adventurous'

export interface ProgrammeOption {
  id: string
  weekKey: WeekKey
  position: 1 | 2 | 3
  mood: OptionMood
  title: string
  pitch: string
  /** A handful of words: "atmospheric", "20th/21st century". */
  character: string[]
  why: string
  /** The route this option would take into its theme. */
  angle: string
  /** When the option returns to an earlier thread. */
  returning?: { themeId: string; note: string }
  /**
   * offered → chosen, or offered → open (a path not taken that week — kept,
   * never "rejected") → taken later, if it is.
   */
  status: 'offered' | 'chosen' | 'open' | 'taken-later' | 'set-aside'
  takenInWeek?: WeekKey
}

export interface WeekRecord {
  weekKey: WeekKey
  startsOn: ISODate
  endsOn: ISODate
  createdAt: Instant
  optionIds: string[]
  chosenOptionId?: string
  chosenAt?: Instant
  programmeId?: string
  /** Earlier programmes of the week, kept when the listener changed direction. */
  setAsideProgrammeIds: string[]
  promptVersion: string
}

// ── The programme snapshot ────────────────────────────────────────────────

/** The curator's proposal for one item, exactly as it was written. */
export interface ProposedRecording {
  composer: string
  work: string
  catalogue?: string
  conductor?: string
  orchestra?: string
  ensemble?: string
  soloists: { name: string; instrument?: string }[]
  year?: string
}

export interface ProgrammeItem {
  id: string
  workId: string
  recordingId: string
  proposed: ProposedRecording
  why: string
  whyThisRecording: string
  listenFor: string[]
  /** Set when this item comes back to a work heard before, on purpose. */
  revisitReason?: string
}

export interface ProgrammeSection {
  id: string
  /** start | then | contrast | deeper | context | compare | coda — or the curator's own. */
  role: string
  heading: string
  note?: string
  items: ProgrammeItem[]
}

export interface ComparisonPerspective {
  recordingId: string
  proposed: ProposedRecording
  character: string
  listenFor?: string
}

export interface Comparison {
  id: string
  workId: string
  framing: string
  perspectives: ComparisonPerspective[]
  whyBoth: string
  origin: 'programme' | 'on-request'
  createdAt: Instant
}

export interface Programme {
  id: string
  weekKey: WeekKey
  optionId: string
  themeId: string
  explorationId: string
  stage: number
  title: string
  dek: string
  introduction: string
  whyNow: string
  historicalPlace: string
  howTheyRelate: string
  continuityNote?: string
  sections: ProgrammeSection[]
  comparisonIds: string[]
  createdAt: Instant
  promptVersion: string
  model: string
}

// ── Listening and feedback ────────────────────────────────────────────────

export type ListeningKind =
  | 'opened'
  | 'play-started'
  | 'listening'
  | 'heard'
  | 'partial'
  | 'skipped'
  | 'reset'

export interface ListeningEvent {
  id: string
  at: Instant
  kind: ListeningKind
  recordingId: string
  workId: string
  programmeId?: string
  source: 'manual' | 'app' | 'spotify-recent'
  /** spotify-recent: how many of the work's tracks were played. */
  tracksPlayed?: number
  tracksTotal?: number
  /** spotify-recent: the played_at stamp, so a re-poll never double counts. */
  playedAt?: Instant
}

/** What a listener sees: memory, not measurement. */
export type ListeningState = 'not-started' | 'listening' | 'heard' | 'skipped'

export type Reaction = 'loved' | 'liked' | 'interesting' | 'not-for-me' | 'too-difficult'
export type WantMore = 'yes' | 'maybe' | 'no'

export type FeedbackTargetType = 'theme' | 'programme' | 'work' | 'recording' | 'album' | 'interpretation'

export interface Feedback {
  id: string
  at: Instant
  target: { type: FeedbackTargetType; id: string }
  /** For context in the notebook and the curator: which programme it came from. */
  programmeId?: string
  reaction?: Reaction
  more?: WantMore
  note?: string
  /** When the taste interpreter last read this note. */
  interpretedAt?: Instant
}

// ── Taste ─────────────────────────────────────────────────────────────────

export type TasteFacet =
  | 'composer'
  | 'period'
  | 'form'
  | 'orchestral-sound'
  | 'contemporary-music'
  | 'challenge'
  | 'recording-era'
  | 'conductor'
  | 'orchestra'
  | 'soloist'
  | 'interpretation'
  | 'programme-length'
  | 'programming-style'
  | 'other'

export type TasteStance = 'drawn-to' | 'wary-of' | 'curious-about' | 'mixed'
export type TasteConfidence = 'tentative' | 'emerging' | 'settled'

export interface TasteObservation {
  id: string
  facet: TasteFacet
  /** What it is about: "Sibelius", "late Romantic brass", "repetition". */
  subject: string
  /** The observation itself, in prose. */
  statement: string
  stance: TasteStance
  confidence: TasteConfidence
  evidence: string[] // feedback ids
  firstSeen: Instant
  lastSeen: Instant
  /** Set when a later observation replaced this one. Kept for the record. */
  supersededBy?: string
}

export interface TasteProfile {
  observations: TasteObservation[]
  /** Questions the listener seems to be asking. */
  questions: string[]
  /** Free text the listener wrote to the curator in Settings. */
  notesToCurator: string
  updatedAt: Instant
}

// ── Resources ─────────────────────────────────────────────────────────────

export type ResourceKind = 'listen' | 'read' | 'watch'

export interface Resource {
  id: string
  programmeId: string
  kind: ResourceKind
  title: string
  url: string
  source: string
  purpose: string
  /** Which work or idea it serves. */
  relatesTo?: string
  foundAt: Instant
}

// ── Cached curator extras ─────────────────────────────────────────────────

export interface Explanation {
  id: string // `${programmeId}:${itemId}`
  heading: string
  body: string
  createdAt: Instant
  promptVersion: string
}

// ── Notion mirror ─────────────────────────────────────────────────────────

export interface NotionSyncState {
  /** `${entity}:${id}` */
  key: string
  pageId: string
  /** Hash of what was last written, so an unchanged entity is not rewritten. */
  hash: string
  syncedAt: Instant
}

export interface NotionDatabases {
  journal: string
  threads: string
  recordings: string
  tastePage: string
}
