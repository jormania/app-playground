import type { MidiEvent } from '../midi/types'

// The MIDI-out test (KEYPATH_TUTOR.md §8): can the phone make the Yamaha play?
// Studio's playback and a future "listen first" in Songs are best heard from
// the instrument itself, and the Data List only documents what the PSR-E383
// *sends*. Three checks answer it by ear, and one answers itself: whether the
// keyboard echoes what it receives back out, which the tutor would otherwise
// mistake for the player's own notes.

export type OutCheck = 'notes' | 'voice' | 'style'

export interface ScheduledMessage {
  data: number[]
  /** ms after the check starts. */
  at: number
}

/** C4 E4 G4 C5, one every 400 ms, each held 300 ms: easy to hear, easy to count. */
export const ARPEGGIO = [60, 64, 67, 72]
const STEP_MS = 400
const HOLD_MS = 300

function arpeggio(channel: number, startAt = 0): ScheduledMessage[] {
  const ch = channel - 1
  return ARPEGGIO.flatMap((note, i) => [
    { data: [0x90 | ch, note, 90], at: startAt + i * STEP_MS },
    { data: [0x80 | ch, note, 0], at: startAt + i * STEP_MS + HOLD_MS },
  ])
}

/** General MIDI program 49, String Ensemble 1 (0-based 48): unmistakably not a piano. */
export const STRINGS_PROGRAM = 48
/** How long the Style is left running before it's stopped again. */
export const STYLE_RUN_MS = 4000

/**
 * What each check sends. Every check ends by silencing what it used, so a
 * lost Note Off can't leave the Yamaha droning: All Notes Off (CC 123) on the
 * channels touched, and Stop for the Style.
 */
export function messagesFor(check: OutCheck): ScheduledMessage[] {
  switch (check) {
    case 'notes':
      return [...arpeggio(1), { data: [0xb0, 123, 0], at: ARPEGGIO.length * STEP_MS }]
    case 'voice':
      return [
        { data: [0xc1, STRINGS_PROGRAM], at: 0 },
        ...arpeggio(2, 100),
        { data: [0xb1, 123, 0], at: 100 + ARPEGGIO.length * STEP_MS },
        // Channel 2 back to piano, so the test leaves nothing changed behind it.
        { data: [0xc1, 0], at: 200 + ARPEGGIO.length * STEP_MS },
      ]
    case 'style':
      return [
        { data: [0xfa], at: 0 },
        { data: [0xfc], at: STYLE_RUN_MS },
      ]
  }
}

/** How long a check takes, so the question waits until it has finished. */
export const durationOf = (check: OutCheck) => Math.max(...messagesFor(check).map((m) => m.at))

/**
 * Did the keyboard send back what it was sent? A Note On for one of the test's
 * notes, arriving while the check ran (plus a little slack), counts as an echo.
 */
export function echoed(sentAtMs: number, events: readonly MidiEvent[], check: OutCheck = 'notes'): boolean {
  if (check === 'style') return false
  const end = sentAtMs + durationOf(check) + 500
  return events.some((e) => e.type === 'noteon' && ARPEGGIO.includes(e.note) && e.time >= sentAtMs && e.time <= end)
}

export type Heard = 'yes' | 'no'
export type VoiceHeard = 'different' | 'same' | 'nothing'

export interface MidiOutFindings {
  /** The port the notes went to, or null if there was none. */
  port: string | null
  notes: { heard: Heard | null; echoed: boolean | null }
  voice: VoiceHeard | null
  style: Heard | null
}

export const NO_FINDINGS: MidiOutFindings = { port: null, notes: { heard: null, echoed: null }, voice: null, style: null }
