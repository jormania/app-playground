import { keyboardOutput } from '../../probe/audioContext'
import { SimpleSynth } from '../../probe/synth'
import { LOOKAHEAD_MS, type Sink } from './playback'

/**
 * The Yamaha plays the take, on channel 1, in its own piano voice. Stopping
 * silences it twice: at once, and again just after anything already handed
 * over would have sounded, so a queued Note On can't ring on.
 */
export function keyboardSink(send: (data: number[], atMs?: number) => boolean): Sink {
  const sounding = new Set<number>()
  const hush = (at?: number) => {
    for (const p of sounding) send([0x80, p, 0], at)
    send([0xb0, 64, 0], at)
    send([0xb0, 123, 0], at)
  }
  return {
    noteOn(pitch, velocity, at) {
      sounding.add(pitch)
      send([0x90, pitch, velocity], at)
    },
    noteOff(pitch, at) {
      sounding.delete(pitch)
      send([0x80, pitch, 0], at)
    },
    pedal(down, at) {
      send([0xb0, 64, down ? 127 : 0], at)
    },
    silence() {
      hush()
      hush(performance.now() + LOOKAHEAD_MS + 50)
      sounding.clear()
    },
  }
}

/**
 * The phone plays the take. With the keyboard attached, the sound goes
 * through the "sound through the keyboard" level, which starts at 0.
 * The pedal isn't voiced: the phone's notes end when the keys were released.
 */
export function phoneSink(throughKeyboardBus: boolean): Sink {
  const synth = new SimpleSynth(throughKeyboardBus ? () => keyboardOutput() : undefined)
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const at = (when: number, fn: () => void) => {
    const id = setTimeout(() => {
      timers.delete(id)
      fn()
    }, Math.max(0, when - performance.now()))
    timers.add(id)
  }
  return {
    noteOn: (pitch, velocity, when) => at(when, () => void synth.noteOn(pitch, velocity).catch(() => {})),
    noteOff: (pitch, when) => at(when, () => synth.noteOff(pitch)),
    pedal: () => {},
    silence() {
      for (const id of timers) clearTimeout(id)
      timers.clear()
      synth.allOff()
    },
  }
}
