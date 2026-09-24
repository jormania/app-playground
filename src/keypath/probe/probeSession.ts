import { Emitter } from '../midi/emitter'
import { emptyTracker, track, type TrackerState } from '../midi/noteTracker'
import { emptyClock, trackClock, type ClockState } from '../midi/clockTracker'
import { pushSample } from '../midi/timing'
import type { ConnectionSnapshot, MidiConnection, MidiEvent, Unsubscribe } from '../midi/types'
import { evaluate, type NoteEvent, type TestKind, type TestResult } from './diagnostics'

const LOG_KEEP = 300

export interface ActiveTest {
  kind: TestKind
  events: NoteEvent[]
  finished: boolean
  result: TestResult
}

/** One change in the set of connected MIDI inputs — a plug, an unplug, or the OS dropping the port. */
export interface ConnectionChange {
  time: number
  inputs: string[]
}

export interface ProbeSnapshot {
  connection: ConnectionSnapshot
  sourceKind: MidiConnection['kind']
  /** performance.now() when this session started; the log shows times relative to it. */
  origin: number
  /** Newest first. Realtime bytes (clock, active sensing) are counted, not logged. */
  log: MidiEvent[]
  tracker: TrackerState
  /** The same, for the player's channels only (1–8) — what the keyboard display and tests use. */
  player: TrackerState
  /** MIDI Clock ticks and Style transport — the keyboard's own tempo. */
  clock: ClockState
  /** Platform timestamp → our handler, per note event. */
  dispatchLag: number[]
  /** Platform timestamp → the next animation frame: roughly when the key can appear on screen. */
  toFrame: number[]
  test: ActiveTest | null
  /**
   * Every change in which inputs are connected, oldest first. A drop nobody
   * caused is the thing to look for: Xiaomi phones switch OTG off by
   * themselves, and it would show up here as an input vanishing mid-session.
   */
  connectionHistory: ConnectionChange[]
  /** Last finished result per test, kept for the report. */
  results: Partial<Record<TestKind, TestResult>>
}

type Scheduler = (cb: () => void) => void
const defaultScheduler: Scheduler = (cb) => {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => cb())
}
// Where MIDI-driven updates are delivered to subscribers: at most once per
// frame. The first S24 run with a Style playing sent ~60 messages a second;
// publishing (and so re-rendering) on each one fell 12.8 s behind.
const defaultFrame: Scheduler = (cb) => {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => cb())
  else setTimeout(cb, 16)
}

/**
 * Channels the player's own keys arrive on. The PSR-E383 sent everything
 * played on channel 1, and a running Style's drums on 9 and 10 (S24,
 * 2026-09-24). Yamaha keyboards conventionally keep panel voices on the low
 * channels and Style parts on 9–16; the Split and built-in-Song tests are what
 * confirm this split for this model.
 */
const pageVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible'
/** Bumped every time the page is hidden, so a frame sample can tell it spanned one. */
let hiddenEpoch = 0
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') hiddenEpoch++
  })
}

export const isPlayerChannel = (channel: number) => channel >= 1 && channel <= 8

/**
 * The probe's whole state machine, outside React. It owns one MidiConnection,
 * folds every event through the tracker, samples timing, and feeds the active
 * test. React reads it through useSyncExternalStore; nothing here knows React
 * exists — this is the seam the lesson engine will plug into later.
 */
export class ProbeSession {
  private connection: MidiConnection
  private state: ProbeSnapshot
  private changes = new Emitter<ProbeSnapshot>()
  private unsubs: Unsubscribe[] = []
  private readonly now: () => number
  private readonly schedule: Scheduler
  private readonly frame: Scheduler
  private publishPending = false

  constructor(
    connection: MidiConnection,
    now: () => number = () => performance.now(),
    schedule: Scheduler = defaultScheduler,
    frame: Scheduler = defaultFrame,
  ) {
    this.connection = connection
    this.now = now
    this.schedule = schedule
    this.frame = frame
    this.state = this.fresh(connection)
    this.attach()
  }

  subscribe = (listener: () => void): Unsubscribe => this.changes.on(listener)
  getSnapshot = (): ProbeSnapshot => this.state

  get source(): MidiConnection {
    return this.connection
  }

  /** Swap the event source (real keyboard ↔ simulator) and start the counters over. */
  use(connection: MidiConnection): void {
    this.detach()
    this.connection.close()
    this.connection = connection
    this.state = this.fresh(connection)
    this.attach()
    this.publish()
  }

  open(): Promise<ConnectionSnapshot> {
    return this.connection.open()
  }

  resetCounters(): void {
    this.state = { ...this.fresh(this.connection), connection: this.state.connection }
    this.publish()
  }

  startTest(kind: TestKind): void {
    this.state = { ...this.state, test: { kind, events: [], finished: false, result: evaluate(kind, []) } }
    this.publish()
  }

  finishTest(): void {
    const t = this.state.test
    if (!t) return
    this.settle({ ...t, finished: true, result: evaluate(t.kind, t.events, true) })
  }

  cancelTest(): void {
    this.state = { ...this.state, test: null }
    this.publish()
  }

  dispose(): void {
    this.detach()
    this.connection.close()
  }

  private fresh(connection: MidiConnection): ProbeSnapshot {
    return {
      connection: connection.snapshot(),
      sourceKind: connection.kind,
      origin: this.now(),
      log: [],
      tracker: emptyTracker(),
      player: emptyTracker(),
      clock: emptyClock(),
      dispatchLag: [],
      toFrame: [],
      test: null,
      connectionHistory: this.state?.connectionHistory ?? [],
      results: this.state?.results ?? {},
    }
  }

  private attach(): void {
    this.unsubs = [
      this.connection.onChange((connection) => {
        const names = connection.inputs.filter((d) => d.state === 'connected').map((d) => d.name || d.id)
        const history = this.state.connectionHistory
        const last = history.at(-1)
        const changed = !last || last.inputs.join('\n') !== names.join('\n')
        // Only record once access exists; "no inputs" before the prompt isn't an unplug.
        const record = changed && connection.access === 'granted'
        this.state = {
          ...this.state,
          connection,
          connectionHistory: record ? [...history, { time: this.now(), inputs: names }].slice(-100) : history,
        }
        this.publish()
      }),
      this.connection.onEvent((e) => this.receive(e)),
    ]
  }

  private detach(): void {
    for (const u of this.unsubs) u()
    this.unsubs = []
  }

  private receive(e: MidiEvent): void {
    const s = this.state
    const isNote = e.type === 'noteon' || e.type === 'noteoff'
    const fromPlayer = (e.type === 'noteon' || e.type === 'noteoff' || e.type === 'cc') && isPlayerChannel(e.channel)
    let next: ProbeSnapshot = {
      ...s,
      tracker: track(s.tracker, e),
      player: fromPlayer ? track(s.player, e) : s.player,
      clock: e.type === 'realtime' ? trackClock(s.clock, e) : s.clock,
      log: e.type === 'realtime' ? s.log : [e, ...s.log].slice(0, LOG_KEEP),
      dispatchLag: isNote ? pushSample(s.dispatchLag, e.receivedAt - e.time) : s.dispatchLag,
    }

    // Tests listen to the player only: a running Style must not play the chord for you.
    if (isNote && fromPlayer && s.test && !s.test.finished) {
      const events = [...s.test.events, e]
      const result = evaluate(s.test.kind, events)
      const test = { ...s.test, events, result }
      next = { ...next, test }
      if (result.verdict !== 'waiting') {
        const done = { ...test, finished: true }
        next = { ...next, test: done, results: { ...next.results, [done.kind]: done.result } }
      }
    }

    this.state = next
    if (e.type === 'noteon') this.sampleFrame(e)
    this.publishSoon()
  }

  private settle(test: ActiveTest): void {
    this.state = { ...this.state, test, results: { ...this.state.results, [test.kind]: test.result } }
    this.publish()
  }

  private sampleFrame(e: MidiEvent): void {
    if (e.type !== 'noteon' || !pageVisible()) return
    // A browser holds back frames while the page is hidden, then runs them all
    // on return — which on the S24 recorded 12–14 s "frame" times for notes
    // played while another app was in front. Only a frame that follows the
    // note without the page having been hidden in between is a real sample.
    const epoch = hiddenEpoch
    this.schedule(() => {
      if (epoch !== hiddenEpoch || !pageVisible()) return
      this.state = { ...this.state, toFrame: pushSample(this.state.toFrame, this.now() - e.time) }
      this.publishSoon()
    })
  }

  /** Coalesce MIDI-driven updates into one publish per frame. */
  private publishSoon(): void {
    if (this.publishPending) return
    this.publishPending = true
    this.frame(() => {
      this.publishPending = false
      this.publish()
    })
  }

  private publish(): void {
    this.changes.emit(this.state)
  }
}
