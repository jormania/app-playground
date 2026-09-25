import type { SongNote } from '../../engine'
import { LOOKAHEAD_MS, type Sink } from '../studio/playback'

// The other hand plays itself (KEYPATH_TUTOR.md §10, "Learning curve"): while
// she practises one hand, the other hand's notes sound, so the song sounds
// whole instead of a thin single line. On the Yamaha when it takes MIDI,
// otherwise on the phone, as Listen does. Free of React.

/** How close (ms) a key coming back from the keyboard must be to one sent, to be taken as its echo. */
const ECHO_MS = 80
const VELOCITY = 64

export class Accompanist {
  private next = 0
  private readonly sent = new Map<number, number>()

  /** `notes`: the other hand's, in song time; `tempo` as the song is played (1 = as written). */
  constructor(
    private readonly sink: Sink,
    private readonly notes: readonly SongNote[],
    private readonly tempo: number,
  ) {
    this.notes = [...notes].sort((a, b) => a.startMs - b.startMs)
  }

  private play(n: SongNote, at: number) {
    this.sink.noteOn(n.pitch, VELOCITY, at)
    this.sink.noteOff(n.pitch, at + n.durationMs / this.tempo)
    this.sent.set(n.pitch, at)
  }

  /** With a clock: hand over every note due by a little after `songMs`, each at its own moment. */
  tick(songMs: number, now: number): void {
    while (this.next < this.notes.length && this.notes[this.next].startMs <= songMs + LOOKAHEAD_MS * this.tempo) {
      const n = this.notes[this.next++]
      const at = now + (n.startMs - songMs) / this.tempo
      // A note whose moment has long passed (after a pause) is skipped, not blurted out late.
      if (at >= now - 50) this.play(n, at)
    }
  }

  /**
   * In "Wait for it" there's no clock: when she plays a step (at `fromMs` in the
   * song), the other hand's notes up to her next step (`toMs`) sound from now,
   * in the song's rhythm. Any it had left behind sound at once.
   */
  stepPlayed(fromMs: number, toMs: number, now: number): void {
    while (this.next < this.notes.length && this.notes[this.next].startMs < toMs) {
      const n = this.notes[this.next++]
      this.play(n, now + Math.max(0, n.startMs - fromMs) / this.tempo)
    }
  }

  /** A key from the keyboard that is really one of ours coming back. */
  isEcho(pitch: number, at: number): boolean {
    const sent = this.sent.get(pitch)
    return sent !== undefined && Math.abs(at - sent) < ECHO_MS
  }

  stop(): void {
    this.sink.silence()
  }
}
