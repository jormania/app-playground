import type { Hand, Song, SongNote } from './song'

// The starter pack (KEYPATH_TUTOR.md §5): short public-domain melodies,
// arranged by us for beginners. Stored as data in source, not as .mid files,
// so content-boundary.test.js stays strict about music files in the repo.
//
// Provenance, per KEYPATH.md §7 — every entry is a melody whose composer died
// well over 70 years ago or a traditional tune, in an arrangement written
// here (the left-hand parts are plain root-note harmony, not copied from any
// edition):
//   twinkle   — traditional French melody “Ah ! vous dirai-je, maman”, first
//               printed 1761.
//   ode       — Beethoven, Symphony No. 9, finale theme (1824). Beethoven d. 1827.
//   jacques   — traditional French round “Frère Jacques”, 18th century.
//   lune      — traditional French song “Au clair de la lune”, 18th century.
//   buns      — “Hot Cross Buns”, English street cry, printed by the 1730s.
//   lamb      — “Mary Had a Little Lamb”, Lowell Mason's tune (1830s). Mason d. 1872.
//   london    — “London Bridge Is Falling Down”, English nursery rhyme, 18th century.
//   jingle    — “Jingle Bells” (chorus), James Lord Pierpont, 1857. Pierpont d. 1893.
//   birthday  — “Happy Birthday”: the Hill sisters' melody “Good Morning to All”
//               (1893). Mildred Hill d. 1916, Patty Hill d. 1946; public domain
//               in the EU since 2017, and in the US the claim fell in 2016.
//   elise     — Beethoven, “Für Elise” WoO 59, the opening theme, right hand
//               only (published 1867). Beethoven d. 1827.

const C3 = 48, G2 = 43, F3 = 53, G3 = 55
const C4 = 60, D4 = 62, E4 = 64, F4 = 65, G4 = 67, Gs4 = 68, A4 = 69, B4 = 71
const C5 = 72, D5 = 74, Ds5 = 75, E5 = 76, F5 = 77, G5 = 79

/** [pitch, beats] — one voice, one after another. */
type Line = [number, number][]

export interface StarterSong {
  id: string
  title: { en: string; ro: string }
  bpm: number
  beatsPerBar: number
  right: Line
  left?: Line
}

// C C G G | A A G- | F F E E | D D C- , then G G F F | E E D- twice, then the opening again.
const twinkleA: Line = [[C4, 1], [C4, 1], [G4, 1], [G4, 1], [A4, 1], [A4, 1], [G4, 2], [F4, 1], [F4, 1], [E4, 1], [E4, 1], [D4, 1], [D4, 1], [C4, 2]]
const twinkleB: Line = [[G4, 1], [G4, 1], [F4, 1], [F4, 1], [E4, 1], [E4, 1], [D4, 2]]
// Root of each half bar: I | IV I | IV I | V I, then I V | I V twice, then the opening.
const twinkleLeftA: Line = [[C3, 4], [F3, 2], [C3, 2], [F3, 2], [C3, 2], [G3, 2], [C3, 2]]
const twinkleLeftB: Line = [[C3, 2], [G3, 2], [C3, 2], [G3, 2]]

const odePhrase = (ending: Line): Line => [[E4, 1], [E4, 1], [F4, 1], [G4, 1], [G4, 1], [F4, 1], [E4, 1], [D4, 1], [C4, 1], [C4, 1], [D4, 1], [E4, 1], ...ending]

export const STARTER_PACK: StarterSong[] = [
  {
    id: 'starter:twinkle',
    title: { en: 'Twinkle, Twinkle, Little Star', ro: 'Twinkle, Twinkle, Little Star' },
    bpm: 90,
    beatsPerBar: 4,
    right: [...twinkleA, ...twinkleB, ...twinkleB, ...twinkleA],
    left: [...twinkleLeftA, ...twinkleLeftB, ...twinkleLeftB, ...twinkleLeftA],
  },
  {
    id: 'starter:ode',
    title: { en: 'Ode to Joy', ro: 'Oda bucuriei' },
    bpm: 90,
    beatsPerBar: 4,
    // …E E F G | G F E D | C C D E | E. D D- , then the same ending on D. C C-
    right: [...odePhrase([[E4, 1.5], [D4, 0.5], [D4, 2]]), ...odePhrase([[D4, 1.5], [C4, 0.5], [C4, 2]])],
    // I | V | I | V , then I | V | I | V I
    left: [[C3, 4], [G2, 4], [C3, 4], [G2, 4], [C3, 4], [G2, 4], [C3, 4], [G2, 2], [C3, 2]],
  },
  {
    id: 'starter:jacques',
    title: { en: 'Frère Jacques', ro: 'Frate Ioane' },
    bpm: 100,
    beatsPerBar: 4,
    right: [
      [C4, 1], [D4, 1], [E4, 1], [C4, 1], [C4, 1], [D4, 1], [E4, 1], [C4, 1],
      [E4, 1], [F4, 1], [G4, 2], [E4, 1], [F4, 1], [G4, 2],
      [G4, 0.5], [A4, 0.5], [G4, 0.5], [F4, 0.5], [E4, 1], [C4, 1], [G4, 0.5], [A4, 0.5], [G4, 0.5], [F4, 0.5], [E4, 1], [C4, 1],
      [C4, 1], [G3, 1], [C4, 2], [C4, 1], [G3, 1], [C4, 2],
    ],
  },
  {
    id: 'starter:lune',
    title: { en: 'Au clair de la lune', ro: 'Au clair de la lune' },
    bpm: 90,
    beatsPerBar: 4,
    right: [
      [C4, 1], [C4, 1], [C4, 1], [D4, 1], [E4, 2], [D4, 2], [C4, 1], [E4, 1], [D4, 1], [D4, 1], [C4, 4],
      [C4, 1], [C4, 1], [C4, 1], [D4, 1], [E4, 2], [D4, 2], [C4, 1], [E4, 1], [D4, 1], [D4, 1], [C4, 4],
    ],
  },
  {
    id: 'starter:buns',
    title: { en: 'Hot Cross Buns', ro: 'Hot Cross Buns' },
    bpm: 90,
    beatsPerBar: 4,
    right: [[E4, 1], [D4, 1], [C4, 2], [E4, 1], [D4, 1], [C4, 2], [C4, 0.5], [C4, 0.5], [C4, 0.5], [C4, 0.5], [D4, 0.5], [D4, 0.5], [D4, 0.5], [D4, 0.5], [E4, 1], [D4, 1], [C4, 2]],
  },
  {
    id: 'starter:lamb',
    title: { en: 'Mary Had a Little Lamb', ro: 'Mary Had a Little Lamb' },
    bpm: 100,
    beatsPerBar: 4,
    right: [
      [E4, 1], [D4, 1], [C4, 1], [D4, 1], [E4, 1], [E4, 1], [E4, 2], [D4, 1], [D4, 1], [D4, 2], [E4, 1], [G4, 1], [G4, 2],
      [E4, 1], [D4, 1], [C4, 1], [D4, 1], [E4, 1], [E4, 1], [E4, 1], [E4, 1], [D4, 1], [D4, 1], [E4, 1], [D4, 1], [C4, 4],
    ],
  },
  {
    id: 'starter:london',
    title: { en: 'London Bridge', ro: 'London Bridge' },
    bpm: 100,
    beatsPerBar: 4,
    right: [
      [G4, 1.5], [A4, 0.5], [G4, 1], [F4, 1], [E4, 1], [F4, 1], [G4, 2], [D4, 1], [E4, 1], [F4, 2], [E4, 1], [F4, 1], [G4, 2],
      [G4, 1.5], [A4, 0.5], [G4, 1], [F4, 1], [E4, 1], [F4, 1], [G4, 2], [D4, 2], [G4, 2], [E4, 1], [C4, 3],
    ],
  },
  {
    id: 'starter:jingle',
    title: { en: 'Jingle Bells', ro: 'Jingle Bells' },
    bpm: 110,
    beatsPerBar: 4,
    right: [
      [E4, 1], [E4, 1], [E4, 2], [E4, 1], [E4, 1], [E4, 2], [E4, 1], [G4, 1], [C4, 1.5], [D4, 0.5], [E4, 4],
      [F4, 1], [F4, 1], [F4, 1.5], [F4, 0.5], [F4, 1], [E4, 1], [E4, 1], [E4, 0.5], [E4, 0.5], [E4, 1], [D4, 1], [D4, 1], [E4, 1], [D4, 2], [G4, 2],
      [E4, 1], [E4, 1], [E4, 2], [E4, 1], [E4, 1], [E4, 2], [E4, 1], [G4, 1], [C4, 1.5], [D4, 0.5], [E4, 4],
      [F4, 1], [F4, 1], [F4, 1.5], [F4, 0.5], [F4, 1], [E4, 1], [E4, 1], [E4, 0.5], [E4, 0.5], [G4, 1], [G4, 1], [F4, 1], [D4, 1], [C4, 4],
    ],
  },
  {
    id: 'starter:birthday',
    title: { en: 'Happy Birthday', ro: 'Happy Birthday' },
    bpm: 100,
    beatsPerBar: 3,
    // Starts on the last beat of a bar (the pickup), so the last bar is a beat short.
    right: [
      [G4, 0.75], [G4, 0.25], [A4, 1], [G4, 1], [C5, 1], [B4, 2],
      [G4, 0.75], [G4, 0.25], [A4, 1], [G4, 1], [D5, 1], [C5, 2],
      [G4, 0.75], [G4, 0.25], [G5, 1], [E5, 1], [C5, 1], [B4, 1], [A4, 1],
      [F5, 0.75], [F5, 0.25], [E5, 1], [C5, 1], [D5, 1], [C5, 2],
    ],
  },
  {
    id: 'starter:elise',
    title: { en: 'Für Elise (opening)', ro: 'Für Elise (începutul)' },
    // Counted in sixteenths (six to a 3/8 bar), slow: a dotted quarter is 60 bpm.
    bpm: 360,
    beatsPerBar: 6,
    right: [
      [E5, 1], [Ds5, 1],
      [E5, 1], [Ds5, 1], [E5, 1], [B4, 1], [D5, 1], [C5, 1],
      [A4, 3], [C4, 1], [E4, 1], [A4, 1],
      [B4, 3], [E4, 1], [Gs4, 1], [B4, 1],
      [C5, 3], [E4, 1], [E5, 1], [Ds5, 1],
      [E5, 1], [Ds5, 1], [E5, 1], [B4, 1], [D5, 1], [C5, 1],
      [A4, 3], [C4, 1], [E4, 1], [A4, 1],
      [B4, 3], [E4, 1], [C5, 1], [B4, 1],
      [A4, 4],
    ],
  },
]

/**
 * Turn a starter song into the engine's Song. Notes sound for 90% of their
 * value, so repeated notes (C C C D) read as separate falling notes.
 */
export function starterSong(s: StarterSong, lang: 'en' | 'ro' = 'en'): Song {
  const msPerBeat = 60000 / s.bpm
  const notes: SongNote[] = []
  const add = (line: Line, hand: Hand) => {
    let beat = 0
    for (const [pitch, beats] of line) {
      notes.push({
        id: 0,
        pitch,
        startMs: Math.round(beat * msPerBeat),
        durationMs: Math.round(beats * msPerBeat * 0.9),
        hand,
        bar: Math.floor(beat / s.beatsPerBar + 1e-9),
      })
      beat += beats
    }
  }
  add(s.right, 'right')
  if (s.left) add(s.left, 'left')
  notes.sort((a, b) => a.startMs - b.startMs || a.pitch - b.pitch)
  notes.forEach((n, i) => (n.id = i))
  return {
    id: s.id,
    title: s.title[lang],
    notes,
    bpm: s.bpm,
    beatsPerBar: s.beatsPerBar,
    durationMs: Math.max(...notes.map((n) => n.startMs + n.durationMs)),
  }
}

/** Beats in a line — used by the tests to prove both hands end together. */
export const lineBeats = (line: Line) => line.reduce((sum, [, b]) => sum + b, 0)
