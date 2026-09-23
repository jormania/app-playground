import { Emitter } from '../midi/emitter'
import { emptyTracker, track, type TrackerState } from '../midi/noteTracker'
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

  constructor(connection: MidiConnection, now: () => number = () => performance.now(), schedule: Scheduler = defaultScheduler) {
    this.connection = connection
    this.now = now
    this.schedule = schedule
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
    let next: ProbeSnapshot = {
      ...s,
      tracker: track(s.tracker, e),
      log: e.type === 'realtime' ? s.log : [e, ...s.log].slice(0, LOG_KEEP),
      dispatchLag: isNote ? pushSample(s.dispatchLag, e.receivedAt - e.time) : s.dispatchLag,
    }

    if (isNote && s.test && !s.test.finished) {
      const events = [...s.test.events, e]
      const result = evaluate(s.test.kind, events)
      const test = { ...s.test, events, result }
      next = { ...next, test }
      if (result.verdict !== 'waiting') {
        this.state = next
        this.settle({ ...test, finished: true })
        this.sampleFrame(e)
        return
      }
    }

    this.state = next
    if (e.type === 'noteon') this.sampleFrame(e)
    this.publish()
  }

  private settle(test: ActiveTest): void {
    this.state = { ...this.state, test, results: { ...this.state.results, [test.kind]: test.result } }
    this.publish()
  }

  private sampleFrame(e: MidiEvent): void {
    if (e.type !== 'noteon') return
    this.schedule(() => {
      this.state = { ...this.state, toFrame: pushSample(this.state.toFrame, this.now() - e.time) }
      this.publish()
    })
  }

  private publish(): void {
    this.changes.emit(this.state)
  }
}
