import type { Recording } from './recorder'

// Plays a take back through a Sink: the Yamaha over MIDI when it can take it
// (the probe's MIDI-out test), or the phone. Events are handed over a little
// ahead of time (LOOKAHEAD_MS) with their exact moment attached, so timing
// doesn't depend on when a timer happens to fire, and stopping never leaves
// more than that much already sent.

export interface Sink {
  noteOn(pitch: number, velocity: number, atMs: number): void
  noteOff(pitch: number, atMs: number): void
  pedal(down: boolean, atMs: number): void
  /** Stop every sound, including anything already handed over. */
  silence(): void
}

export interface Clock {
  now(): number
  every(ms: number, fn: () => void): () => void
}

export const LOOKAHEAD_MS = 250
const TICK_MS = 100

type Ev = { at: number; send: (sink: Sink, at: number) => void }

function eventsOf(r: Recording): Ev[] {
  return [
    ...r.notes.flatMap((n): Ev[] => [
      { at: n.startMs, send: (s, at) => s.noteOn(n.pitch, n.velocity, at) },
      { at: n.startMs + n.durationMs, send: (s, at) => s.noteOff(n.pitch, at) },
    ]),
    ...r.pedal.map((p): Ev => ({ at: p.atMs, send: (s, at) => s.pedal(p.down, at) })),
  ].sort((a, b) => a.at - b.at)
}

export class Playback {
  private readonly events: Ev[]
  private next = 0
  private origin = 0
  private cancel: (() => void) | null = null

  constructor(
    private readonly recording: Recording,
    private readonly sink: Sink,
    private readonly clock: Clock,
    private readonly onEnd: () => void = () => {},
  ) {
    this.events = eventsOf(recording)
  }

  get playing() {
    return this.cancel !== null
  }

  /** Where the playback is, in ms of the take. */
  position(): number {
    return this.playing ? Math.min(this.recording.ms, this.clock.now() - this.origin) : 0
  }

  start() {
    this.stop()
    this.next = 0
    this.origin = this.clock.now() + 50
    this.cancel = this.clock.every(TICK_MS, () => this.tick())
    this.tick()
  }

  stop() {
    if (!this.cancel) return
    this.cancel()
    this.cancel = null
    this.sink.silence()
  }

  private tick() {
    const horizon = this.clock.now() - this.origin + LOOKAHEAD_MS
    while (this.next < this.events.length && this.events[this.next].at <= horizon) {
      const e = this.events[this.next++]
      e.send(this.sink, this.origin + e.at)
    }
    if (this.next >= this.events.length && this.clock.now() >= this.origin + this.recording.ms) {
      this.cancel?.()
      this.cancel = null
      this.onEnd()
    }
  }
}

export const realClock: Clock = {
  now: () => performance.now(),
  every: (ms, fn) => {
    const id = setInterval(fn, ms)
    return () => clearInterval(id)
  },
}
