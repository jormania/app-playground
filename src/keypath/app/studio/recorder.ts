import { isPlayerChannel } from '../../midi/channels'
import type { MidiEvent } from '../../midi/types'

// Studio's recorder: what she plays, never the Style. Only the player's
// channels (1–8) are kept (KEYPATH.md §1); the drums, bass and chords of a
// running Style arrive on 9–16 and are left out, since the keyboard makes
// them again at playback if she starts the Style.

export interface TakeNote {
  pitch: number
  velocity: number
  /** ms from the start of the take. */
  startMs: number
  durationMs: number
}

export interface PedalChange {
  atMs: number
  down: boolean
}

export interface Recording {
  ms: number
  notes: TakeNote[]
  pedal: PedalChange[]
}

/** A take stops by itself after ten minutes: long enough to play, short enough to store. */
export const MAX_TAKE_MS = 10 * 60_000

export class Recorder {
  private readonly held = new Map<number, { velocity: number; startMs: number }>()
  private readonly notes: TakeNote[] = []
  private readonly pedalChanges: PedalChange[] = []
  private pedalDown = false

  constructor(private readonly startAt: number) {}

  private rel(at: number) {
    return Math.max(0, Math.round(at - this.startAt))
  }

  get noteCount() {
    return this.notes.length + this.held.size
  }

  noteOn(pitch: number, velocity: number, at: number) {
    this.noteOff(pitch, at) // a key struck again before its release: close the first
    this.held.set(pitch, { velocity, startMs: this.rel(at) })
  }

  noteOff(pitch: number, at: number) {
    const h = this.held.get(pitch)
    if (!h) return
    this.held.delete(pitch)
    this.notes.push({ pitch, velocity: h.velocity, startMs: h.startMs, durationMs: Math.max(1, this.rel(at) - h.startMs) })
  }

  pedal(down: boolean, at: number) {
    if (down === this.pedalDown) return
    this.pedalDown = down
    this.pedalChanges.push({ atMs: this.rel(at), down })
  }

  /** One event from the keyboard. Anything but the player's notes and sustain pedal is ignored. */
  feed(e: MidiEvent) {
    if (e.type === 'noteon' && isPlayerChannel(e.channel)) this.noteOn(e.note, e.velocity, e.time)
    else if (e.type === 'noteoff' && isPlayerChannel(e.channel)) this.noteOff(e.note, e.time)
    else if (e.type === 'cc' && e.controller === 64 && isPlayerChannel(e.channel)) this.pedal(e.value >= 64, e.time)
  }

  /** End the take: keys still down end here, and so does the pedal. */
  stop(at: number): Recording {
    for (const pitch of [...this.held.keys()]) this.noteOff(pitch, at)
    if (this.pedalDown) this.pedal(false, at)
    const ms = this.rel(at)
    return { ms, notes: [...this.notes].sort((a, b) => a.startMs - b.startMs || a.pitch - b.pitch), pedal: [...this.pedalChanges] }
  }
}
