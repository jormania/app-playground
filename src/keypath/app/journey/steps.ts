import type { Finger, Timing } from '../../engine'
import { starterSong, type StarterSong } from '../../engine/starterPack'
import type { StringKey } from '../i18n'
import { Chords, FindAll, Prompts, Tune, type Exercise, type Prompt } from './exercises'

// The Journey (KEYPATH_TUTOR.md §3, door B): small steps, each with a
// practice (keys lit) and a check (keys dark). Passing a step's check is what
// completes it, so anyone who can already do it tests out in about 30 s.
//
// Melodies here are public domain, arranged here, stored as data like the
// starter pack: Ode to Joy (Beethoven, d. 1827), Twinkle Twinkle (French
// melody, printed 1761), Mary Had a Little Lamb (Lowell Mason's 1830s tune).
// Steps 7–9 were added before Nora's first look: the left hand alone, the
// black keys, and reading up to the C above middle C. Finger numbers came
// after it (KEYPATH_TUTOR.md §10, "Learning curve"), as the second step.

const C3 = 48, D3 = 50, E3 = 52, F3 = 53, G3 = 55
const C4 = 60, D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, B4 = 71, C5 = 72, D5 = 74

export type StepId = 'middleC' | 'fingers' | 'cde' | 'fiveFinger' | 'chord' | 'twoHands' | 'notation' | 'leftHand' | 'blackKeys' | 'readingHigher'

/** One bar line in the staff step: pitches with their length in beats. */
export type StaffNote = [pitch: number, beats: 1 | 2]

export interface JourneyStep {
  id: StepId
  title: StringKey
  blurb: StringKey
  tip: StringKey
  /** Keys drawn: whole octaves, like the Songs keyboard. */
  range: { low: number; high: number }
  /** Tunes need "press middle C" first, to know the keyboard's octave. The others go by note name. */
  octaveGate: boolean
  /** Wrong keys a check can take and still pass. Practices always count as done. */
  allowWrong: number
  practice: (timing: Timing) => Exercise
  check: (timing: Timing) => Exercise
  /** The notation step draws a staff instead of falling notes. */
  staff?: { practice: StaffNote[]; check: StaffNote[] }
}

/** How close together a chord's keys must land (ms), by her Timing setting. */
export const CHORD_WINDOW_MS: Record<Timing, number> = { relaxed: 150, normal: 100, strict: 70 }

const isC = (p: number) => p % 12 === 0
const named = (pitch: number) => (p: number) => p % 12 === pitch % 12
const lit = (pitch: number, key: StringKey = 'jPlayLit'): Prompt => ({ accept: named(pitch), show: [pitch], say: { key, notes: [pitch] } })
const ask = (pitch: number): Prompt => ({ accept: named(pitch), say: { key: 'jPressNote', notes: [pitch] } })

const tune = (id: string, right: [number, number][], left?: [number, number][], fingers?: StarterSong['fingers']): StarterSong => ({
  id: `journey:${id}`,
  title: { en: id, ro: id },
  bpm: 80,
  beatsPerBar: 4,
  right,
  left,
  fingers,
})

const ODE = tune('ode', [[E4, 1], [E4, 1], [F4, 1], [G4, 1], [G4, 1], [F4, 1], [E4, 1], [D4, 1], [C4, 1], [C4, 1], [D4, 1], [E4, 1], [E4, 1.5], [D4, 0.5], [D4, 2]], undefined, { right: '334554321123 322' })
const TWINKLE = tune(
  'twinkle',
  [[C4, 1], [C4, 1], [G4, 1], [G4, 1], [A4, 1], [A4, 1], [G4, 2], [F4, 1], [F4, 1], [E4, 1], [E4, 1], [D4, 1], [D4, 1], [C4, 2]],
  [[C3, 4], [F3, 2], [C3, 2], [F3, 2], [C3, 2], [G3, 2], [C3, 2]],
  { right: '1144554 4433221', left: '5252515' },
)
const READ_PRACTICE: StaffNote[] = [[C4, 1], [D4, 1], [E4, 1], [F4, 1], [G4, 1], [F4, 1], [E4, 1], [D4, 1]]
const READ_CHECK: StaffNote[] = [[E4, 1], [D4, 1], [C4, 1], [D4, 1], [E4, 1], [E4, 1], [E4, 2]]
// Step 9: up the ladder to C, then a tune she knows, read from the staff.
const HIGHER_PRACTICE: StaffNote[] = [[C4, 1], [D4, 1], [E4, 1], [F4, 1], [G4, 1], [A4, 1], [B4, 1], [C5, 1]]
const HIGHER_CHECK: StaffNote[] = [[C4, 1], [C4, 1], [G4, 1], [G4, 1], [A4, 1], [A4, 1], [G4, 2]]
// Step 7: Ode to Joy's first line again, an octave down, in the left hand.
const ODE_LEFT = tune('odeLeft', [], [[E3, 1], [E3, 1], [F3, 1], [G3, 1], [G3, 1], [F3, 1], [E3, 1], [D3, 1], [C3, 1], [C3, 1], [D3, 1], [E3, 1], [E3, 1.5], [D3, 0.5], [D3, 2]], { left: '332112345543344' })
// Step 8: the five black keys, as sharps.
const SHARPS = [61, 63, 66, 68, 70] // C♯4 D♯4 F♯4 G♯4 A♯4

// Finger numbers, taught inside the C position (Hoffman's way): right thumb on
// middle C, left little finger on the C below. MIDI can't tell which finger
// pressed a key, but inside a fixed position each finger has exactly one key,
// so "finger 3" is checked as E.
const FINGER_KEY: Record<'right' | 'left', Record<Finger, number>> = {
  right: { 1: C4, 2: D4, 3: E4, 4: F4, 5: G4 },
  left: { 5: C3, 4: D3, 3: E3, 2: F3, 1: G3 },
}
const finger = (hand: 'right' | 'left', n: Finger, showKey: boolean): Prompt => {
  const pitch = FINGER_KEY[hand][n]
  const key: StringKey = hand === 'right' ? (showKey ? 'jFingerRightLit' : 'jFingerRight') : showKey ? 'jFingerLeftLit' : 'jFingerLeft'
  return { accept: (p) => p === pitch, show: showKey ? [pitch] : undefined, say: { key, notes: [pitch], vars: { n } }, finger: { hand, finger: n } }
}
type Ask = ['right' | 'left', Finger]
// The right hand up its five, the left down its five (little finger to thumb), then a few mixed.
const FINGERS_PRACTICE: Ask[] = [['right', 1], ['right', 2], ['right', 3], ['right', 4], ['right', 5], ['left', 5], ['left', 4], ['left', 3], ['left', 2], ['left', 1], ['right', 3], ['left', 3]]
const FINGERS_CHECK: Ask[] = [['right', 3], ['right', 1], ['left', 1], ['right', 5], ['left', 5], ['left', 2], ['right', 4], ['left', 3]]

const C_CHORD = { pitchClasses: [0, 4, 7], show: [C4, E4, G4], say: { key: 'jChord' as StringKey, notes: [C4, E4, G4] } }
const G_CHORD = { pitchClasses: [7, 11, 2], show: [G4, B4, D5], say: { key: 'jChord' as StringKey, notes: [G4, B4, D5] } }
const dark = <T extends { show?: number[] }>(t: T): T => ({ ...t, show: undefined })

export const JOURNEY: JourneyStep[] = [
  {
    id: 'middleC',
    title: 'j1Title',
    blurb: 'j1Blurb',
    tip: 'j1Tip',
    range: { low: C3, high: C5 },
    octaveGate: false,
    allowWrong: 1,
    practice: () =>
      new Prompts([
        { accept: isC, show: [C4], say: { key: 'jFindMiddleC' } },
        { accept: isC, show: [C5], say: { key: 'jFindHigherC' } },
        { accept: isC, show: [C3], say: { key: 'jFindLowerC' } },
        { accept: isC, show: [C4], say: { key: 'jBackToMiddleC' } },
      ]),
    check: () => new FindAll(0, 3, { key: 'jFindThreeCs' }),
  },
  {
    id: 'fingers',
    title: 'jFingersTitle',
    blurb: 'jFingersBlurb',
    tip: 'jFingersTip',
    range: { low: C3, high: C5 },
    octaveGate: true,
    allowWrong: 1,
    practice: () => new Prompts(FINGERS_PRACTICE.map(([h, n]) => finger(h, n, true))),
    check: () => new Prompts(FINGERS_CHECK.map(([h, n]) => finger(h, n, false))),
  },
  {
    id: 'cde',
    title: 'j2Title',
    blurb: 'j2Blurb',
    tip: 'j2Tip',
    range: { low: C4, high: C5 },
    octaveGate: false,
    allowWrong: 1,
    practice: () => new Prompts([C4, D4, E4, D4, C4, E4, D4, C4].map((p) => lit(p))),
    check: () => new Prompts([D4, C4, E4, D4, E4, C4].map(ask)),
  },
  {
    id: 'fiveFinger',
    title: 'j3Title',
    blurb: 'j3Blurb',
    tip: 'j3Tip',
    range: { low: C4, high: C5 },
    octaveGate: true,
    allowWrong: 2,
    practice: () => new Tune(starterSong(ODE), 'right', true, { key: 'jFollowLit' }),
    check: () => new Tune(starterSong(ODE), 'right', false, { key: 'jPlayTune' }),
  },
  {
    id: 'chord',
    title: 'j4Title',
    blurb: 'j4Blurb',
    tip: 'j4Tip',
    range: { low: C4, high: 84 },
    octaveGate: false,
    allowWrong: 1,
    practice: (timing) => new Chords([C_CHORD, C_CHORD, G_CHORD, G_CHORD], CHORD_WINDOW_MS[timing]),
    check: (timing) => new Chords([C_CHORD, G_CHORD, C_CHORD].map(dark), CHORD_WINDOW_MS[timing]),
  },
  {
    id: 'twoHands',
    title: 'j5Title',
    blurb: 'j5Blurb',
    tip: 'j5Tip',
    range: { low: C3, high: C5 },
    octaveGate: true,
    allowWrong: 2,
    practice: () => new Tune(starterSong(TWINKLE), 'both', true, { key: 'jFollowLit' }),
    check: () => new Tune(starterSong(TWINKLE), 'both', false, { key: 'jPlayTune' }),
  },
  {
    id: 'notation',
    title: 'j6Title',
    blurb: 'j6Blurb',
    tip: 'j6Tip',
    range: { low: C4, high: C5 },
    octaveGate: true,
    allowWrong: 2,
    practice: () => new Tune(starterSong(tune('read', READ_PRACTICE, undefined, { right: '12345432' })), 'right', true, { key: 'jReadLabelled' }),
    check: () => new Tune(starterSong(tune('lamb', READ_CHECK, undefined, { right: '3212333' })), 'right', false, { key: 'jReadStaff' }),
    staff: { practice: READ_PRACTICE, check: READ_CHECK },
  },
  {
    id: 'leftHand',
    title: 'j7Title',
    blurb: 'j7Blurb',
    tip: 'j7Tip',
    range: { low: C3, high: C4 },
    octaveGate: true,
    allowWrong: 2,
    practice: () => new Tune(starterSong(ODE_LEFT), 'left', true, { key: 'jFollowLit' }),
    check: () => new Tune(starterSong(ODE_LEFT), 'left', false, { key: 'jPlayTune' }),
  },
  {
    id: 'blackKeys',
    title: 'j8Title',
    blurb: 'j8Blurb',
    tip: 'j8Tip',
    range: { low: C3, high: C5 },
    octaveGate: false,
    allowWrong: 1,
    practice: () => new Prompts([...SHARPS, 66, 61].map((p) => lit(p))),
    check: () => new Prompts([63, 66, 70, 61, 68, 66].map(ask)),
  },
  {
    id: 'readingHigher',
    title: 'j9Title',
    blurb: 'j9Blurb',
    tip: 'j9Tip',
    range: { low: C4, high: C5 },
    octaveGate: true,
    allowWrong: 2,
    practice: () => new Tune(starterSong(tune('higher', HIGHER_PRACTICE, undefined, { right: '12312345' })), 'right', true, { key: 'jReadLabelled' }),
    check: () => new Tune(starterSong(tune('twinkleRead', HIGHER_CHECK, undefined, { right: '1144554' })), 'right', false, { key: 'jReadStaff' }),
    staff: { practice: HIGHER_PRACTICE, check: HIGHER_CHECK },
  },
]

export const stepById = (id: string) => JOURNEY.find((s) => s.id === id) ?? null
