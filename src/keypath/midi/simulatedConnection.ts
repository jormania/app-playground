import { Emitter } from './emitter'
import type { ConnectionSnapshot, MidiConnection, MidiEvent } from './types'

const DEVICE_ID = 'simulated'

/**
 * A stand-in keyboard, so every screen and test can be exercised before the
 * cable arrives: tap the on-screen keys (or a computer keyboard) and it emits
 * exactly the events the Yamaha would — including Note Off as a zero-velocity
 * Note On, which is what the real instrument sends.
 */
export class SimulatedConnection implements MidiConnection {
  readonly kind = 'simulated' as const
  private state: ConnectionSnapshot = { access: 'idle', error: null, inputs: [] }
  private events = new Emitter<MidiEvent>()
  private changes = new Emitter<ConnectionSnapshot>()
  private readonly now: () => number

  constructor(now: () => number = () => performance.now()) {
    this.now = now
  }

  async open(): Promise<ConnectionSnapshot> {
    return this.set({
      access: 'granted',
      error: null,
      inputs: [{ id: DEVICE_ID, name: 'On-screen simulator', manufacturer: 'KeyPath', state: 'connected', looksLikeYamaha: false }],
    })
  }

  close(): void {
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

  press(note: number, velocity = 80, channel = 1): void {
    if (this.state.access !== 'granted') return
    const t = this.now()
    this.events.emit({ type: 'noteon', note, velocity, channel, time: t, receivedAt: t, source: 'simulated', deviceId: DEVICE_ID })
  }

  release(note: number, channel = 1): void {
    if (this.state.access !== 'granted') return
    const t = this.now()
    this.events.emit({ type: 'noteoff', note, velocity: 0, viaZeroVelocity: true, channel, time: t, receivedAt: t, source: 'simulated', deviceId: DEVICE_ID })
  }

  private set(next: ConnectionSnapshot): ConnectionSnapshot {
    this.state = next
    this.changes.emit(next)
    return next
  }
}
