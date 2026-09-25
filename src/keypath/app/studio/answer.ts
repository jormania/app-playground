import type { Song, SongNote } from '../../engine'
import { MODEL_SONNET } from '../../../shared/anthropic'
import { askClaude } from '../ai'
import type { Language } from '../profiles'
import type { Recording, TakeNote } from './recorder'

// Call and answer (KEYPATH_TUTOR.md §9, "Call and answer"): she plays a
// phrase in the Studio, and Claude answers it with a phrase of its own that
// she can hear and then learn in Songs. Claude composes; this file makes
// sure what comes back is something she can play: in the key she played in,
// near where her hands were, in simple rhythms, a phrase long. Anything else
// is dropped rather than played.

const NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const MINOR = [0, 2, 3, 5, 7, 8, 10]
/** Keys written with flats (their tonic's pitch class), major and minor. */
const FLAT_MAJORS = new Set([5, 10, 3, 8, 1, 6])
const FLAT_MINORS = new Set([2, 7, 0, 5, 10, 3])

/** Note values an answer may use, in beats: sixteenth to whole. */
const VALUES = new Set([0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4])
const MAX_BEATS = 16
/** Her phrase, as sent: the start of the take, this many notes at most. */
const MAX_CALL_NOTES = 24

export interface Key {
  tonic: number
  mode: 'major' | 'minor'
}

const pc = (p: number) => ((p % 12) + 12) % 12
export const scaleOf = (k: Key) => new Set((k.mode === 'major' ? MAJOR : MINOR).map((s) => (s + k.tonic) % 12))
const flats = (k: Key) => (k.mode === 'major' ? FLAT_MAJORS : FLAT_MINORS).has(k.tonic)
export const keyName = (k: Key) => `${(flats(k) ? NAMES_FLAT : NAMES_SHARP)[k.tonic]} ${k.mode}`
/** C4 is middle C, 60. */
export const noteName = (p: number, k: Key) => `${(flats(k) ? NAMES_FLAT : NAMES_SHARP)[pc(p)]}${Math.floor(p / 12) - 1}`

export function parseNote(name: string): number | null {
  const m = name.trim().match(/^([A-Ga-g])([#♯b♭]?)(-?\d)$/)
  if (!m) return null
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase() as 'C']
  const alter = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0
  return (Number(m[3]) + 1) * 12 + base + alter
}

/**
 * The key she played in: the major or minor scale holding most of her notes
 * (by how long they sound), leaning to one that starts or ends on her first
 * or last note; major on a tie.
 */
export function keyOf(notes: readonly Pick<TakeNote, 'pitch' | 'durationMs'>[]): Key {
  let best: Key = { tonic: 0, mode: 'major' }
  let bestScore = -Infinity
  const first = notes.length ? pc(notes[0].pitch) : 0
  const last = notes.length ? pc(notes[notes.length - 1].pitch) : 0
  const total = notes.reduce((s, n) => s + Math.max(1, n.durationMs), 0) || 1
  for (const mode of ['major', 'minor'] as const) {
    for (let tonic = 0; tonic < 12; tonic++) {
      const scale = scaleOf({ tonic, mode })
      const inScale = notes.reduce((s, n) => s + (scale.has(pc(n.pitch)) ? Math.max(1, n.durationMs) : 0), 0) / total
      const score = inScale * 10 + (tonic === last ? 1 : 0) + (tonic === first ? 0.5 : 0) - (mode === 'minor' ? 0.01 : 0)
      if (score > bestScore) {
        bestScore = score
        best = { tonic, mode }
      }
    }
  }
  return best
}

export interface Call {
  key: Key
  bpm: number
  /** Her notes, on a grid of sixteenths: where each starts and how long it is, in beats. */
  notes: { pitch: number; start: number; beats: number }[]
  beats: number
  low: number
  high: number
}

const toGrid = (beats: number) => Math.round(beats * 4) / 4

/**
 * Her phrase, from the start of a take. The beat is the take's count-in when
 * it had one; otherwise the usual gap between her notes.
 */
export function callOf(take: Recording & { bpm?: number }): Call | null {
  const notes = [...take.notes].sort((a, b) => a.startMs - b.startMs).slice(0, MAX_CALL_NOTES)
  if (notes.length < 3) return null
  let bpm = take.bpm
  if (!bpm) {
    const gaps = notes
      .slice(1)
      .map((n, i) => n.startMs - notes[i].startMs)
      .filter((g) => g > 80)
      .sort((a, b) => a - b)
    const median = gaps[Math.floor(gaps.length / 2)] ?? 500
    bpm = Math.round(Math.min(140, Math.max(50, 60000 / median)))
  }
  const beatMs = 60000 / bpm
  const origin = notes[0].startMs
  const grid = notes.map((n) => ({ pitch: n.pitch, start: toGrid((n.startMs - origin) / beatMs), beats: Math.max(0.25, toGrid(n.durationMs / beatMs)) }))
  const kept = grid.filter((n) => n.start < MAX_BEATS)
  const pitches = kept.map((n) => n.pitch)
  return {
    key: keyOf(notes),
    bpm,
    notes: kept,
    beats: Math.max(1, Math.ceil(Math.max(...kept.map((n) => n.start + n.beats)))),
    low: Math.min(...pitches),
    high: Math.max(...pitches),
  }
}

export interface Answer {
  key: Key
  bpm: number
  /** In order; a rest is a note with no pitch. */
  notes: { pitch: number | null; start: number; beats: number }[]
  beats: number
  /** One sentence to her about how it answers her phrase. */
  idea: string
}

/** Where the answer may go: a fifth either side of her phrase, within the keys the Studio shows and a little more. */
const bounds = (c: Call) => ({ low: Math.max(48, c.low - 7), high: Math.min(84, c.high + 7) })

/** Claude's reply, if it's a phrase she can play: JSON with notes in the key, near her hands, in plain note values. */
export function checkAnswer(text: string, call: Call): Answer | null {
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  let raw: { idea?: unknown; notes?: unknown }
  try {
    raw = JSON.parse(json)
  } catch {
    return null
  }
  if (!Array.isArray(raw.notes)) return null
  const scale = scaleOf(call.key)
  const { low, high } = bounds(call)
  const notes: Answer['notes'] = []
  let at = 0
  for (const item of raw.notes as { note?: unknown; beats?: unknown }[]) {
    const beats = Number(item?.beats)
    if (!VALUES.has(beats) || typeof item?.note !== 'string') return null
    if (/^rest$/i.test(item.note.trim())) notes.push({ pitch: null, start: at, beats })
    else {
      const pitch = parseNote(item.note)
      if (pitch === null || pitch < low || pitch > high || !scale.has(pc(pitch))) return null
      notes.push({ pitch, start: at, beats })
    }
    at += beats
  }
  const sounding = notes.filter((n) => n.pitch !== null).length
  if (sounding < 2 || sounding > 32 || at > MAX_BEATS) return null
  const idea = typeof raw.idea === 'string' ? raw.idea.replace(/\s+/g, ' ').trim().slice(0, 200) : ''
  return { key: call.key, bpm: call.bpm, notes, beats: at, idea }
}

const LANGUAGE_NAME: Record<Language, string> = { en: 'English', ro: 'Romanian (speaking to the student as "tu", with correct diacritics)' }

function prompt(call: Call, language: Language) {
  const { low, high } = bounds(call)
  const name = (p: number) => noteName(p, call.key)
  return {
    system: `You are a friendly piano teacher playing "call and answer" with a student. The student has just played a short phrase; you answer it with a phrase of your own, which the student will hear and then learn to play.

Your answer must:
- stay in ${keyName(call.key)}, using only notes of that scale;
- stay between ${name(low)} and ${name(high)} (C4 is middle C);
- be about as long as the call (${call.beats} beats), and never longer than ${MAX_BEATS} beats;
- use simple rhythms a beginner can play: mostly quarter and eighth notes, a longer note to end;
- pick up one idea from the call (its rhythm, or its rising or falling shape) and answer it, ending on the key's home note;
- be playable by one hand without big jumps.

Reply with JSON only, no other text:
{"idea": "<one short, warm sentence to the student about how your answer answers theirs, in ${LANGUAGE_NAME[language]}>", "notes": [{"note": "E4", "beats": 1}, {"note": "rest", "beats": 1}]}
Note names are letters with an octave number; sharps are written #, flats b. Allowed beat values: 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4.`,
    user: `The call, in ${keyName(call.key)} at ${call.bpm} beats a minute, each note with where it starts and how long it lasts, in beats:\n${JSON.stringify(call.notes.map((n) => ({ note: name(n.pitch), start: n.start, beats: n.beats })))}`,
  }
}

/** Ask Claude to answer her phrase. Null when no playable answer comes back. */
export async function askAnswer(key: string, call: Call, language: Language, options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {}): Promise<Answer | null> {
  const p = prompt(call, language)
  const text = await askClaude(key, { model: MODEL_SONNET, maxTokens: 2000, ...p, extra: { output_config: { effort: 'low' } } }, options)
  return text === null ? null : checkAnswer(text, call)
}

/** The answer as a take, to play back the way her takes play: 90% of each value sounding. */
export function answerRecording(a: Answer): Recording {
  const beatMs = 60000 / a.bpm
  const notes = a.notes.flatMap((n) => (n.pitch === null ? [] : [{ pitch: n.pitch, velocity: 80, startMs: n.start * beatMs, durationMs: n.beats * beatMs * 0.9 }]))
  return { ms: a.beats * beatMs, notes, pedal: [] }
}

/** The answer as a song of her own, to learn in Songs: right hand, four beats a bar. */
export function answerSong(a: Answer, id: string, title: string): Song {
  const beatMs = 60000 / a.bpm
  const notes: SongNote[] = a.notes.flatMap((n) => (n.pitch === null ? [] : [{ id: 0, pitch: n.pitch, startMs: Math.round(n.start * beatMs), durationMs: Math.round(n.beats * beatMs * 0.9), hand: 'right' as const, bar: Math.floor(n.start / 4) }]))
  notes.forEach((n, i) => (n.id = i))
  return { id, title, notes, bpm: a.bpm, beatsPerBar: 4, durationMs: notes.length ? Math.max(...notes.map((n) => n.startMs + n.durationMs)) : 0 }
}

/** Her answer's notes, bar by bar, for the screen: "E4 D4 C4 | D4 E4". */
export function answerLine(a: Answer, label: (p: number) => string): string {
  const bars = new Map<number, string[]>()
  for (const n of a.notes) if (n.pitch !== null) bars.set(Math.floor(n.start / 4), [...(bars.get(Math.floor(n.start / 4)) ?? []), label(n.pitch)])
  return [...bars.values()].map((b) => b.join(' ')).join('  |  ')
}
