// The MIDI layer's public vocabulary. Nothing in src/keypath/midi/ imports React
// or touches the DOM beyond the browser MIDI/USB objects it wraps — the eventual
// lesson engine must be able to consume these events with no UI mounted at all.

/** Where an event came from: the real keyboard, or the on-screen simulator. */
export type MidiSourceKind = 'webmidi' | 'simulated'

/**
 * Fields every event carries. Two clocks, deliberately:
 *
 * - `time` is the event's own timestamp as the platform reports it, in ms on
 *   the `performance.now()` timeline. This is the one to judge rhythm by.
 * - `receivedAt` is `performance.now()` when our handler actually ran. The gap
 *   between the two is how late the page heard about the key — dispatch lag,
 *   not key-to-sound latency (the Yamaha makes its own sound and never waits
 *   for us).
 */
interface EventBase {
  time: number
  receivedAt: number
  /** MIDI channel, 1–16 (the human numbering, not the 0–15 wire nibble). */
  channel: number
  source: MidiSourceKind
  /** Id of the input port this arrived on. */
  deviceId: string
}

export interface NoteOn extends EventBase {
  type: 'noteon'
  note: number
  /** 1–127. A wire Note On with velocity 0 is a NoteOff, never this. */
  velocity: number
}

export interface NoteOff extends EventBase {
  type: 'noteoff'
  note: number
  /** Release velocity. The PSR-E383 sends none (its Note Off is 9nH v=0), so 0. */
  velocity: number
  /** True when the wire message was a Note On with velocity 0 — the Yamaha's form. */
  viaZeroVelocity: boolean
}

export interface ControlChange extends EventBase {
  type: 'cc'
  controller: number
  value: number
}

export interface ProgramChange extends EventBase {
  type: 'program'
  program: number
}

/** Clock, start/stop, active sensing — counted, never shown one by one. */
export interface Realtime extends Omit<EventBase, 'channel'> {
  type: 'realtime'
  status: number
}

/** Anything else (SysEx, pitch bend, aftertouch…) — kept raw for the log. */
export interface Other extends Omit<EventBase, 'channel'> {
  type: 'other'
  data: number[]
}

export type MidiEvent = NoteOn | NoteOff | ControlChange | ProgramChange | Realtime | Other

export interface MidiDevice {
  id: string
  name: string
  manufacturer: string
  state: 'connected' | 'disconnected'
  /** Our best guess that this is the PSR-E383 (or a sibling on the same USB id). */
  looksLikeYamaha: boolean
}

export type AccessState =
  | 'idle'          // nothing requested yet
  | 'requesting'    // permission prompt showing
  | 'granted'
  | 'denied'        // user or policy said no
  | 'unsupported'   // no navigator.requestMIDIAccess at all
  | 'insecure'      // not a secure context, so the API is withheld

export interface ConnectionSnapshot {
  access: AccessState
  /** The error text when access failed, verbatim — it is the diagnosis. */
  error: string | null
  inputs: MidiDevice[]
  /**
   * Ports KeyPath can send to (the Yamaha plays what it receives there).
   * Absent where a connection has no way out, like the simulator.
   */
  outputs?: MidiDevice[]
}

export type Unsubscribe = () => void

/**
 * One source of MIDI events. The Web MIDI implementation and the simulator both
 * satisfy it, and a native Android bridge would be a third.
 */
export interface MidiConnection {
  readonly kind: MidiSourceKind
  /** Ask for access. Must be called from a user gesture on Chrome for Android. */
  open(): Promise<ConnectionSnapshot>
  close(): void
  snapshot(): ConnectionSnapshot
  onEvent(listener: (event: MidiEvent) => void): Unsubscribe
  onChange(listener: (snapshot: ConnectionSnapshot) => void): Unsubscribe
  /**
   * Send raw MIDI bytes to the keyboard (the Yamaha if several outputs are
   * attached), optionally scheduled at a `performance.now()` time. Returns
   * false when there is nowhere to send them.
   */
  send?(data: number[], atMs?: number): boolean
}
