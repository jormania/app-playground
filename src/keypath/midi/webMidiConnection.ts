import { Emitter } from './emitter'
import { looksLikeYamaha } from './identify'
import { parseMidiMessage } from './parse'
import type { AccessState, ConnectionSnapshot, MidiConnection, MidiDevice, MidiEvent } from './types'

type Env = {
  navigator?: Navigator
  isSecureContext?: boolean
  now: () => number
}

const defaultEnv = (): Env => ({
  navigator: typeof navigator === 'undefined' ? undefined : navigator,
  isSecureContext: typeof window === 'undefined' ? undefined : window.isSecureContext,
  now: () => performance.now(),
})

/**
 * MidiConnection over the browser's Web MIDI API. On Chrome for Android this
 * is backed by android.media.midi, which sees any class-compliant USB MIDI
 * device the phone hosts — so if this works, the browser route works.
 */
export class WebMidiConnection implements MidiConnection {
  readonly kind = 'webmidi' as const
  private access: MIDIAccess | null = null
  private state: ConnectionSnapshot = { access: 'idle', error: null, inputs: [] }
  private events = new Emitter<MidiEvent>()
  private changes = new Emitter<ConnectionSnapshot>()
  private bound = new Map<string, MIDIInput>()
  private readonly env: Env

  constructor(env: Env = defaultEnv()) {
    this.env = env
  }

  /** What the environment allows before anything is requested. */
  static precheck(env: Env = defaultEnv()): AccessState {
    if (env.isSecureContext === false) return 'insecure'
    if (!env.navigator || typeof env.navigator.requestMIDIAccess !== 'function') return 'unsupported'
    return 'idle'
  }

  async open(): Promise<ConnectionSnapshot> {
    const pre = WebMidiConnection.precheck(this.env)
    if (pre !== 'idle') return this.set({ access: pre, error: null, inputs: [] })

    this.set({ ...this.state, access: 'requesting', error: null })
    try {
      // No sysex: nothing here needs it, and asking for it makes the prompt scarier.
      const access = await this.env.navigator!.requestMIDIAccess({ sysex: false })
      this.access = access
      access.onstatechange = () => this.refresh()
      this.refresh()
    } catch (err) {
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      this.set({ access: 'denied', error: message, inputs: [] })
    }
    return this.state
  }

  close(): void {
    for (const input of this.bound.values()) input.onmidimessage = null
    this.bound.clear()
    if (this.access) this.access.onstatechange = null
    this.access = null
    this.set({ access: 'idle', error: null, inputs: [] })
  }

  snapshot(): ConnectionSnapshot {
    return this.state
  }

  onEvent(listener: (event: MidiEvent) => void) {
    return this.events.on(listener)
  }

  onChange(listener: (snapshot: ConnectionSnapshot) => void) {
    return this.changes.on(listener)
  }

  /** Re-read the port list and (re)bind a handler to every input — hot-plug included. */
  private refresh(): void {
    if (!this.access) return
    const inputs: MidiDevice[] = []
    for (const input of this.access.inputs.values()) {
      inputs.push({
        id: input.id,
        name: input.name ?? '',
        manufacturer: input.manufacturer ?? '',
        state: input.state,
        looksLikeYamaha: looksLikeYamaha(input.name ?? '', input.manufacturer ?? ''),
      })
      if (this.bound.get(input.id) !== input) {
        input.onmidimessage = (e) => this.handle(input.id, e)
        this.bound.set(input.id, input)
      }
    }
    this.set({ access: 'granted', error: null, inputs })
  }

  private handle(deviceId: string, e: MIDIMessageEvent): void {
    const receivedAt = this.env.now()
    if (!e.data) return
    // Chrome stamps each message on the performance.now() timeline. A zero or
    // missing stamp would silently corrupt every timing figure, so fall back to
    // arrival time and let the report show the two clocks agreeing exactly.
    const time = e.timeStamp > 0 ? e.timeStamp : receivedAt
    const event = parseMidiMessage(e.data, { time, receivedAt, source: 'webmidi', deviceId })
    if (event) this.events.emit(event)
  }

  private set(next: ConnectionSnapshot): ConnectionSnapshot {
    this.state = next
    this.changes.emit(next)
    return next
  }
}
