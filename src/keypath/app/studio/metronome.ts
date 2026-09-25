import { LOOKAHEAD_MS, realClock, type Clock, type Sink } from './playback'

// Studio's metronome: a click on every beat for the whole take, the first of
// each bar louder, after the count-in has set the tempo. Clicks are handed to
// the sink a little ahead with their exact time, as Playback does, so they
// stay on the beat whatever the timers do.

/** C6 on the piano, as the count-in and Rhythm echo use: any keyboard plays it. */
export const CLICK = 84
const TICK_MS = 100
const CLICK_MS = 60

export class Metronome {
  private next = 0
  private cancel: (() => void) | null = null
  /** The last few click times, so an echo of one from the keyboard can be told from her playing. */
  private recent: number[] = []

  constructor(
    private readonly sink: Sink,
    readonly bpm: number,
    /** When beat 1 of bar 1 falls, on the clock's timeline. */
    private readonly startAt: number,
    private readonly clock: Clock = realClock,
    readonly beatsPerBar = 4,
  ) {}

  get running() {
    return this.cancel !== null
  }

  start() {
    this.cancel = this.clock.every(TICK_MS, () => this.tick())
    this.tick()
  }

  stop() {
    if (!this.cancel) return
    this.cancel()
    this.cancel = null
    this.sink.silence()
  }

  /** True for a note that is this metronome's own click, echoed back (same key, within a few ms). */
  isClick(pitch: number, at: number): boolean {
    return pitch === CLICK && this.recent.some((c) => Math.abs(c - at) <= CLICK_MS)
  }

  private tick() {
    const beat = 60_000 / this.bpm
    const horizon = this.clock.now() + LOOKAHEAD_MS
    while (this.startAt + this.next * beat <= horizon) {
      const at = this.startAt + this.next * beat
      this.sink.noteOn(CLICK, this.next % this.beatsPerBar === 0 ? 110 : 70, at)
      this.sink.noteOff(CLICK, at + CLICK_MS)
      this.recent = [...this.recent.slice(-7), at]
      this.next++
    }
  }
}
