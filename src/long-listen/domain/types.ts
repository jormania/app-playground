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
  /**
   * Legacy: once copied from the first Spotify match, which let a wrong match
   * rename a work's movements. Movements now live on each recording's Spotify
   * reference (`trackNames`); this is no longer written or read.
   */
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
  /** Spotify's own names for those tracks — this recording's movements, as this album divides them. */
  trackNames?: string[]
  /** What the matcher saw: a strong match is accepted, a probable one waits for the listener. */
  confidence: 'strong' | 'probable'
  /** Set when the listener said "yes, this is the recording" to a probable match. */
  confirmedByListener?: Instant
  matchedAt: Instant
  /** Sum of the work's track lengths, from Spotify. Information, never a tally. */
  durationMs?: number
}

/**
 * unchecked   — not looked for yet
 * verified    — Spotify has this recording: linked, played, counted
 * unconfirmed — Spotify has something close (a probable match); shown with its
 *               differences for the listener to confirm, never treated as the
 *               recording until they do
 * not-found   — Spotify doesn't have it (or the listener said "not this one")
 */
export type Verification = 'unchecked' | 'verified' | 'unconfirmed' | 'not-found'

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
  /** The matcher version that last looked (see MATCHER_VERSION); an older decision is looked at again. */
  checkedWith?: number
  /** Albums the listener said are not this recording; never matched again. */
  rejectedAlbumIds?: string[]
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
  /** "More of this theme": further programmes asked for the same week, same thread. */
  extraProgrammeIds?: string[]
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
  /** Options offered earlier this week, before the listener asked for three others. */
  earlierOptionIds?: string[]
  promptVersion: string
  /** "This week, differently": a mood for this week only, sent with every curator job about the week. */
  mood?: WeekMood[]
}

/** A week's mood, said in one word each: fewer and shorter works, calmer music, further afield, better known. */
export type WeekMood = 'shorter' | 'quieter' | 'wider' | 'familiar'
export const WEEK_MOODS: { value: WeekMood; label: string }[] = [
  { value: 'shorter', label: 'shorter' },
  { value: 'quieter', label: 'quieter' },
  { value: 'wider', label: 'wider' },
  { value: 'familiar', label: 'more familiar' },
]

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
  /** Made because the programme's recording isn't on Spotify: the second perspective stands in for it. */
  standIn?: boolean
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
  /** Set on "more of this theme": the week's programme this one continues. */
  extends?: string
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
  /** spotify-recent: the session's first and last played_at, so a re-poll never counts it twice. */
  playedAt?: Instant
  playedUntil?: Instant
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
  /**
   * On a work: the listener knew it before the app suggested it. Familiarity,
   * not a verdict — it tells the curator what isn't a discovery. A later
   * `false` takes it back.
   */
  known?: boolean
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

/**
 * What the listener tells the curator directly, in Settings. Explicit
 * preferences outrank anything inferred from feedback; the taste profile is
 * what the curator noticed, these are what the listener said.
 */
export interface ListenerPreferences {
  /** How much music a week holds: roughly 1, 2–3, 4–5, or 6+ hours. */
  timePerWeek: 'short' | 'standard' | 'generous' | 'abundant'
  /**
   * How wide a week ranges, 1–5: one composer or one tight idea (1) … a
   * theme traced across centuries, with unexpected neighbours (5).
   */
  breadth: Level
  /**
   * How well known the music is, 1–5: the great cornerstones, to know more
   * deeply (1) … rarities, the avant-garde, music almost nobody plays (5).
   */
  familiarity: Level
  /**
   * "Same work, two perspectives": one work heard in two recordings, side by
   * side. Off, a week holds each work once.
   */
  pairs: boolean
  /** How much the curator writes around the music. */
  depth: 'concise' | 'standard' | 'deeper'
  recordingEra: 'any' | 'historic-welcome' | 'modern-sound' | 'period-practice'
  /** Works with voices — choral symphonies, orchestral songs. */
  includeVoices: boolean
  includeConcertos: boolean
  /** The language the curator writes in. Work titles keep their usual form. */
  language: 'en' | 'ro'
  /** A wish for next week's directions; read once, then cleared. */
  nextRequest: string
}

export type Level = 1 | 2 | 3 | 4 | 5

export const DEFAULT_PREFERENCES: ListenerPreferences = {
  timePerWeek: 'generous',
  breadth: 3,
  familiarity: 3,
  pairs: false,
  depth: 'standard',
  recordingEra: 'any',
  includeVoices: true,
  includeConcertos: true,
  language: 'en',
  nextRequest: '',
}

/**
 * Preferences as stored, brought up to date: the old three-step "adventure"
 * becomes a familiarity level; anything unknown falls back to the default.
 */
export function normalisePreferences(raw: Partial<ListenerPreferences> & { adventure?: string } | undefined): ListenerPreferences {
  const { adventure, ...rest } = raw ?? {}
  const p = { ...DEFAULT_PREFERENCES, ...rest }
  if (raw && raw.familiarity === undefined && adventure) p.familiarity = adventure === 'gentle' ? 2 : adventure === 'bold' ? 4 : 3
  const level = (v: unknown, d: Level): Level => (typeof v === 'number' && v >= 1 && v <= 5 ? (Math.round(v) as Level) : d)
  p.breadth = level(p.breadth, DEFAULT_PREFERENCES.breadth)
  p.familiarity = level(p.familiarity, DEFAULT_PREFERENCES.familiarity)
  if (!['short', 'standard', 'generous', 'abundant'].includes(p.timePerWeek)) p.timePerWeek = DEFAULT_PREFERENCES.timePerWeek
  p.pairs = Boolean(p.pairs)
  return p
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
  /** Hash of the columns last written, so an unchanged row is not rewritten. */
  hash: string
  /**
   * Programme pages: the part of the body that can change after the page is
   * written (further reading) — its hash, the blocks the app wrote for it, and
   * the block it sits after. Only these blocks are ever replaced.
   */
  bodyHash?: string
  bodyBlockIds?: string[]
  anchorBlockId?: string
  syncedAt: Instant
}

export interface NotionDatabases {
  journal: string
  threads: string
  recordings: string
  tastePage: string
}
