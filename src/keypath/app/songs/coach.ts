import { barName, notesFor, type JudgeSummary, type Practice, type Report, type Song } from '../../engine'
import { MODEL_HAIKU } from '../../../shared/anthropic'
import { askClaude } from '../ai'
import { noteLabel } from '../i18n'
import type { Language, NoteNames } from '../profiles'
import { levelOf } from './level'

// The coach's note (KEYPATH_TUTOR.md §9, "The coach's note"): after a song,
// two or three sentences a teacher would say, written by Claude from the
// facts of this attempt and nothing else. The report stays as it is; the
// note is added below it when a key is set, the phone is online and the
// answer comes back in time. No name is sent: the song's title and how it
// went, that's all.

const BLACK = new Set([1, 3, 6, 8, 10])
const isBlack = (p: number) => BLACK.has(((p % 12) + 12) % 12)
const LEVEL = { 1: 'Easy', 2: 'Medium', 3: 'Harder' } as const

/** A bar with something to fix, as she'd find it on the page. */
export interface TroubleBar {
  bar: string
  missed: number
  wrong: number
  early: number
  late: number
  /** The notes she was to play there, in order, each with its finger where the song gives one: "E(3) F(4) G(5)". */
  notes: string
}

/** A wrong note that sits next to the one the song wanted: most often a black key and its white neighbour. */
export interface Swap {
  bar: string
  played: string
  expected: string
  times: number
  /** Whether the note she missed is a black key. */
  expectedIsBlack: boolean
}

export interface CoachFacts {
  song: string
  level: string
  hands: Practice
  /** 'wait': the song waited for each note; 'running': it kept time. */
  mode: 'wait' | 'running'
  speedPercent: number
  /** Played in parts: which bars this was. */
  bars?: string
  stars: number
  notesPlayed: number
  notesInSong: number
  missed: number
  wrongKeys: number
  timing: { early: number; onTime: number; late: number } | null
  troubleBars: TroubleBar[]
  swaps: Swap[]
  /** Her earlier finishes of this song, oldest first: stars and score (0–100). */
  earlier: { stars: number; score: number }[]
}

export interface FactsInput {
  song: Song
  summary: JudgeSummary
  report: Report
  practice: Practice
  tempo: number
  names: NoteNames
  language: Language
  /** Bars [from, to) when a part was played. */
  span?: { from: number; to: number } | null
  earlier: { stars: number; score: number }[]
}

/** Everything the coach is told: numbers and names, never who she is. */
export function coachFacts({ song, summary, report, practice, tempo, names, language, span, earlier }: FactsInput): CoachFacts {
  const name = (p: number) => noteLabel(p, names, language)
  const mine = notesFor(song, practice)
  const byBar = new Map<number, { missed: number; wrong: number; early: number; late: number }>()
  const tally = (bar: number) => {
    if (!byBar.has(bar)) byBar.set(bar, { missed: 0, wrong: 0, early: 0, late: 0 })
    return byBar.get(bar)!
  }
  for (const r of summary.results) {
    if (r.outcome === 'missed') tally(r.note.bar).missed++
    else if (r.timing === 'early') tally(r.note.bar).early++
    else if (r.timing === 'late') tally(r.note.bar).late++
  }
  for (const w of summary.wrong) tally(w.bar).wrong++
  const weight = (t: { missed: number; wrong: number; early: number; late: number }) => t.missed + t.wrong + (t.early + t.late) / 2
  const troubleBars = [...byBar.entries()]
    .filter(([, t]) => weight(t) > 0)
    .sort((a, b) => weight(b[1]) - weight(a[1]) || a[0] - b[0])
    .slice(0, 3)
    .map(([bar, t]): TroubleBar => ({
      bar: barName(song, bar),
      ...t,
      notes: mine
        .filter((n) => n.bar === bar)
        .slice(0, 16)
        .map((n) => `${name(n.pitch)}${n.finger ? `(${n.finger})` : ''}`)
        .join(' '),
    }))

  // A wrong key right beside a note of the same bar: the neighbour she meant.
  const swaps = new Map<string, Swap>()
  for (const w of summary.wrong) {
    const near = mine
      .filter((n) => n.bar === w.bar && n.pitch !== w.pitch && Math.abs(n.pitch - w.pitch) <= 2)
      .sort((a, b) => Math.abs(a.pitch - w.pitch) - Math.abs(b.pitch - w.pitch))[0]
    if (!near) continue
    const key = `${w.bar}:${w.pitch}:${near.pitch}`
    const s = swaps.get(key) ?? { bar: barName(song, w.bar), played: name(w.pitch), expected: name(near.pitch), times: 0, expectedIsBlack: isBlack(near.pitch) }
    s.times++
    swaps.set(key, s)
  }

  return {
    song: song.title,
    level: LEVEL[levelOf(song)],
    hands: practice,
    mode: summary.mode,
    speedPercent: Math.round(tempo * 100),
    ...(span ? { bars: `${barName(song, span.from)}–${barName(song, span.to - 1)}` } : {}),
    stars: report.stars,
    notesPlayed: report.hit,
    notesInSong: report.total,
    missed: report.missed,
    wrongKeys: report.wrong,
    timing: report.timing,
    troubleBars,
    swaps: [...swaps.values()].sort((a, b) => b.times - a.times).slice(0, 3),
    earlier: earlier.slice(-5),
  }
}

const SYSTEM = `You are a warm, precise piano teacher. A student has just played a piece in a practice app, and you write the short note they read under their result.

The student may be a child of about ten or an adult beginner: write plainly and kindly, never childish, never gushing.

Use only the facts you are given. Refer to bars only by the bar numbers in the facts and to notes only by the note names in the facts; finger numbers are in brackets after a note (1 is the thumb, 5 the little finger).

Write two or three short sentences, at most 60 words, addressed to the student:
- first, one specific thing that went well;
- then the single most useful thing to fix, and exactly how to practise it: for example, play that bar alone and slowly, say the finger numbers aloud, look for the black key beside it;
- if nothing went wrong, say so plainly and suggest one next challenge: a faster speed, both hands, or letting the song keep time.

No lists, headings, emojis or quotation marks.`

const LANGUAGE_LINE: Record<Language, string> = {
  en: 'Write in English.',
  ro: 'Write in Romanian, speaking to the student as "tu", with correct diacritics (ă, â, î, ș, ț).',
}

const BAR_WORDS = /\b(?:bars?|măsur(?:a|ile|ă|i))\s+((?:\d+[a-z]?(?:\s*(?:[–,-]|and|și|or|sau)\s*)?)+)/giu

/**
 * The note, if it can be trusted: short, and naming no bar that isn't in the
 * song. Anything else is dropped rather than shown.
 */
export function checkNote(text: string, song: Song): string | null {
  const clean = text.replace(/^["“„]|["”]$/g, '').replace(/\s+/g, ' ').trim()
  if (!clean || clean.length > 600) return null
  const labels = new Set<string>()
  const bars = song.notes.length ? Math.max(...song.notes.map((n) => n.bar)) + 1 : 0
  for (let b = 0; b < bars; b++) labels.add(barName(song, b))
  for (const m of clean.matchAll(BAR_WORDS)) {
    for (const n of m[1].match(/\d+[a-z]?/g) ?? []) if (!labels.has(n)) return null
  }
  return clean
}

/** How long to wait for the note before giving up on it: the report never waits. */
export const COACH_TIMEOUT_MS = 15_000

/** Ask Claude for the note. Null when there's no answer worth showing; never throws. */
export async function askCoach(key: string, facts: CoachFacts, language: Language, song: Song, signal?: AbortSignal, fetchImpl?: typeof fetch): Promise<string | null> {
  const text = await askClaude(
    key,
    { model: MODEL_HAIKU, maxTokens: 300, system: `${SYSTEM}\n\n${LANGUAGE_LINE[language]}`, user: `Facts about this attempt, as JSON:\n${JSON.stringify(facts)}` },
    { signal, fetchImpl },
  )
  return text === null ? null : checkNote(text, song)
}
