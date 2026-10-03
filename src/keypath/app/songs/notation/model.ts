import type { BarTime, Song, SongNote } from '../../../engine'

// The music as it is written (app/songs/notation): KeyPath's notes, which
// say when a key goes down and for how long, turned into what a score says —
// in each bar and on each staff, notes and rests of written lengths, chords,
// and ties where a note runs on. It reads the song's own notes and bars, so
// the ids it keeps are the ones the judge reports against. Free of React and
// of the engraver (Score.tsx draws it with VexFlow).

export type Clef = 'treble' | 'bass'

export interface NotationEvent {
  /** Quarter notes from the start of the bar. */
  at: number
  /** Its written length in quarter notes: 4, 3, 2, 1.5, 1, 0.75, 0.5 or 0.25. */
  length: number
  /** The keys of a note or chord, lowest first; empty for a rest. */
  keys: { id: number; pitch: number }[]
  /** The same keys go on into the next event (a tie), across a bar line too. */
  tie: boolean
  /** A rest for the whole bar, written as a whole rest whatever the metre. */
  wholeBar?: boolean
}

export interface NotationBar {
  index: number
  /** Quarter notes in the bar. */
  quarters: number
  staves: Partial<Record<Clef, NotationEvent[]>>
}

/** Positions are rounded to sixteenths: fine enough for every song KeyPath plays. */
const GRID = 0.25
/** Notes starting this close together (ms) are one chord. */
const TOGETHER_MS = 30
/** The written lengths, longest first, in quarter notes. */
export const LENGTHS = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25] as const

/** The plain note values a short note is written as, longest first. */
const PLAIN = [4, 2, 1, 0.5, 0.25]

const snap = (q: number) => Math.round(q / GRID) * GRID

/**
 * Each bar's span. The song's own, when it was made with them; otherwise
 * worked out from its tempo and metre (a quarter a beat), placed so that
 * every note falls inside its own bar.
 */
export function barTimesOf(song: Pick<Song, 'barTimes' | 'bpm' | 'beatsPerBar'>, notes: readonly SongNote[]): BarTime[] {
  const bars = notes.length ? Math.max(...notes.map((n) => n.bar)) + 1 : 0
  if (song.barTimes && song.barTimes.length >= bars) return song.barTimes
  const quarters = song.beatsPerBar || 4
  const barMs = (quarters * 60000) / (song.bpm || 120)
  const origin = notes.length ? Math.min(0, ...notes.map((n) => n.startMs - n.bar * barMs)) : 0
  return Array.from({ length: bars }, (_, b) => ({ startMs: origin + b * barMs, endMs: origin + (b + 1) * barMs, quarters }))
}

/** A length split into written lengths, longest first (5 quarters is a whole note tied to a quarter). */
export function writtenLengths(q: number): number[] {
  const out: number[] = []
  let left = snap(q)
  while (left >= GRID - 1e-9) {
    const l = LENGTHS.find((x) => x <= left + 1e-9) ?? GRID
    out.push(l)
    left = snap(left - l)
  }
  return out
}

/** Which staff a note is written on: the hand decides, as on a piano score. */
export const clefOf = (n: Pick<SongNote, 'hand'>): Clef => (n.hand === 'left' ? 'bass' : 'treble')

/**
 * The song's bars as written, for the staves asked for. `notes` are the song's
 * own (the hands being practised), with their bars and times.
 */
export function notationBars(song: Pick<Song, 'barTimes' | 'bpm' | 'beatsPerBar'>, notes: readonly SongNote[], clefs: readonly Clef[]): NotationBar[] {
  const times = barTimesOf(song, notes)
  const bars: NotationBar[] = times.map((t, index) => ({ index, quarters: snap(t.quarters) || GRID, staves: {} }))
  for (const clef of clefs) {
    const mine = notes.filter((n) => clefOf(n) === clef)
    /** A note still sounding into the next bar: its keys and how long it goes on. */
    let carry: { keys: NotationEvent['keys']; left: number } | null = null
    bars.forEach((bar, b) => {
      const t = times[b]
      const span = Math.max(1, t.endMs - t.startMs)
      const qMs = span / bar.quarters
      const toQ = (ms: number) => Math.min(bar.quarters - GRID, Math.max(0, snap(((ms - t.startMs) / span) * bar.quarters)))
      // Onsets in this bar, chords together, at their written place.
      const groups: { at: number; startMs: number; keys: NotationEvent['keys']; endMs: number }[] = []
      for (const n of mine.filter((x) => x.bar === b).sort((x, y) => x.startMs - y.startMs || x.pitch - y.pitch)) {
        const last = groups[groups.length - 1]
        const at = toQ(n.startMs)
        if (last && (last.at === at || n.startMs - last.startMs < TOGETHER_MS)) {
          if (!last.keys.some((k) => k.pitch === n.pitch)) last.keys.push({ id: n.id, pitch: n.pitch })
          last.endMs = Math.max(last.endMs, n.startMs + n.durationMs)
        } else groups.push({ at, startMs: n.startMs, keys: [{ id: n.id, pitch: n.pitch }], endMs: n.startMs + n.durationMs })
      }
      for (const g of groups) g.keys.sort((x, y) => x.pitch - y.pitch)
      const events: NotationEvent[] = []
      const push = (at: number, q: number, keys: NotationEvent['keys'], tieLast: boolean) => {
        const parts = writtenLengths(q)
        let x = at
        parts.forEach((length, i) => {
          events.push({ at: x, length, keys, tie: keys.length > 0 && (i < parts.length - 1 || tieLast) })
          x = snap(x + length)
        })
      }
      // What runs on from the bar before fills the start, up to the first new note.
      let cursor = 0
      const firstAt = groups.length ? groups[0].at : bar.quarters
      if (carry && firstAt > 0) {
        // Held at least half the way to the next note, it is written up to it (a note sounds a little short of its length).
        const q = carry.left >= firstAt / 2 ? firstAt : carry.left
        const goesOn = snap(carry.left - q)
        const onward = goesOn > GRID / 2 && firstAt >= bar.quarters
        push(0, q, carry.keys, onward)
        cursor = q
        carry = onward ? { keys: carry.keys, left: goesOn } : null
      } else {
        // The note before was tied into a bar that starts with a new note: it ends at the bar line.
        if (carry) {
          const prev = [...bars[b - 1]?.staves[clef] ?? []].reverse().find((e) => e.keys.length)
          if (prev) prev.tie = false
        }
        carry = null
      }
      // Nothing in the bar at all: a whole-bar rest. Otherwise a rest up to the first note.
      if (groups.length === 0 && cursor === 0) events.push({ at: 0, length: bar.quarters, keys: [], tie: false, wholeBar: true })
      else if (cursor < firstAt - 1e-9) push(cursor, firstAt - cursor, [], false)
      groups.forEach((g, i) => {
        const next = groups[i + 1]?.at ?? bar.quarters
        const slot = snap(next - g.at)
        if (slot <= 0) return
        const sounds = Math.max(GRID, snap((g.endMs - g.startMs) / qMs))
        const last = i === groups.length - 1
        if (last && sounds > slot + GRID / 2) {
          // On past the bar line: tied into the next bar.
          push(g.at, slot, g.keys, true)
          carry = { keys: g.keys, left: snap(sounds - slot) }
        } else if (sounds >= slot / 2 || slot - sounds < 1) push(g.at, slot, g.keys, false)
        else {
          // Short, with a beat or more of silence after: a plain note value, and a rest for the silence.
          const length = PLAIN.find((l) => l <= sounds + GRID + 1e-9 && l <= slot) ?? GRID
          push(g.at, length, g.keys, false)
          push(snap(g.at + length), snap(slot - length), [], false)
        }
      })
      bar.staves[clef] = events
    })
    // A tie out of the last bar goes nowhere.
    const lastBar = bars[bars.length - 1]?.staves[clef]
    const lastNote = lastBar && [...lastBar].reverse().find((e) => e.keys.length)
    if (lastNote && lastNote === lastBar[lastBar.length - 1]) lastNote.tie = false
  }
  return bars
}
