import { audioContext } from './audioContext'

const freq = (note: number) => 440 * 2 ** ((note - 69) / 12)

interface Voice {
  osc: OscillatorNode[]
  gain: GainNode
}

/**
 * A plain piano-ish voice for the simulator only, so tapping the on-screen
 * keys makes a sound. It never plays for the real keyboard: the Yamaha sounds
 * its own notes instantly, and a second, later copy from the phone would be
 * both redundant and audibly behind. The delay you can hear between tapping
 * the screen and this sound is the phone's audio path, and it's exactly the
 * delay the real app avoids by letting the instrument make the sound.
 */
export class SimpleSynth {
  private voices = new Map<number, Voice>()

  /**
   * `output`: where the sound goes. The speaker by default; the tutor passes
   * the keyboard bus (audioContext.ts) when the Yamaha is connected, so its
   * level (default 0) applies.
   */
  constructor(private readonly output: (ctx: AudioContext) => Promise<AudioNode> | AudioNode = (ctx) => ctx.destination) {}

  async noteOn(note: number, velocity: number): Promise<void> {
    const ctx = await audioContext()
    this.noteOff(note)
    const t = ctx.currentTime
    const gain = ctx.createGain()
    const peak = 0.08 + (velocity / 127) * 0.22
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(peak, t + 0.005)
    // Piano-like: a quick fall to a quieter tail that keeps decaying while held.
    gain.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.3)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 4)
    gain.connect(await this.output(ctx))
    const osc = (['triangle', 'sine'] as const).map((type, i) => {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = freq(note) * (i + 1)
      const g = ctx.createGain()
      g.gain.value = i === 0 ? 1 : 0.25
      o.connect(g).connect(gain)
      o.start(t)
      return o
    })
    this.voices.set(note, { osc, gain })
  }

  noteOff(note: number): void {
    const v = this.voices.get(note)
    if (!v) return
    this.voices.delete(note)
    const ctx = v.gain.context
    const t = ctx.currentTime
    v.gain.gain.cancelScheduledValues(t)
    v.gain.gain.setValueAtTime(v.gain.gain.value, t)
    v.gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
    for (const o of v.osc) o.stop(t + 0.3)
  }

  allOff(): void {
    for (const note of [...this.voices.keys()]) this.noteOff(note)
  }
}
