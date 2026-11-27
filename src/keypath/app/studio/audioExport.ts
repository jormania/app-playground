import type { Recording } from './recorder'

// A take, or her try at a song, as a sound file she can send: rendered with
// the phone's own voice (the same as SimpleSynth's, probe/synth.ts) into an
// offline audio context, and written as a WAV, which any phone plays and
// Chrome's share sheet passes on (a .mid file it won't, see saveFile.ts).
// It is the notes she played, in the phone's sound, not the Yamaha's.

/** Mono at 22.05 kHz: plenty for a plain piano voice, and half the size of CD rate. */
export const AUDIO_RATE = 22_050
/** Silence after the last note, for its tail to ring out. */
const TAIL_S = 0.8
const RELEASE_S = 0.25

const freq = (note: number) => 440 * 2 ** ((note - 69) / 12)
const peakOf = (velocity: number) => 0.08 + (velocity / 127) * 0.22

/**
 * The voice's level `held` seconds after its key went down, as SimpleSynth
 * shapes it: a 5 ms attack, a fall to 35% by 0.3 s, then a slow decay to
 * silence by 4 s. Where the key is let go, the release starts from here.
 */
export function heldLevel(peak: number, held: number): number {
  if (held <= 0) return 0
  if (held <= 0.005) return (peak * held) / 0.005
  if (held <= 0.3) return peak * 0.35 ** ((held - 0.005) / 0.295)
  if (held <= 4) return peak * 0.35 * (0.001 / (peak * 0.35)) ** ((held - 0.3) / 3.7)
  return 0.001
}

type Offline = Pick<OfflineAudioContext, 'createGain' | 'createOscillator' | 'createDynamicsCompressor' | 'destination' | 'startRendering'>
export type OfflineFactory = (channels: number, length: number, rate: number) => Offline

const defaultFactory: OfflineFactory = (channels, length, rate) => new OfflineAudioContext(channels, length, rate)

/** Every note of a recording, played into an offline context: what the phone would sound, at once. */
export async function renderRecording(r: Recording, rate = AUDIO_RATE, make: OfflineFactory = defaultFactory): Promise<AudioBuffer> {
  const end = Math.max(r.ms, ...r.notes.map((n) => n.startMs + n.durationMs)) / 1000 + RELEASE_S + TAIL_S
  const ctx = make(1, Math.ceil(end * rate), rate)
  // Chords add up: a gentle master level and a compressor keep them from clipping.
  const comp = ctx.createDynamicsCompressor()
  comp.connect(ctx.destination)
  const master = ctx.createGain()
  master.gain.value = 0.6
  master.connect(comp)
  for (const n of r.notes) {
    const t = n.startMs / 1000
    const off = t + Math.max(0.01, n.durationMs / 1000)
    const held = off - t
    const peak = peakOf(n.velocity)
    const g = ctx.createGain()
    const p = g.gain
    p.setValueAtTime(0, t)
    // The attack and decay as far as the key was held, then the release from where it was.
    if (held <= 0.005) p.linearRampToValueAtTime(heldLevel(peak, held), off)
    else {
      p.linearRampToValueAtTime(peak, t + 0.005)
      if (held <= 0.3) p.exponentialRampToValueAtTime(heldLevel(peak, held), off)
      else {
        p.exponentialRampToValueAtTime(peak * 0.35, t + 0.3)
        p.exponentialRampToValueAtTime(Math.max(0.001, heldLevel(peak, held)), Math.min(off, t + 4))
      }
    }
    p.exponentialRampToValueAtTime(0.001, off + RELEASE_S)
    g.connect(master)
    ;(['triangle', 'sine'] as const).forEach((type, i) => {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = freq(n.pitch) * (i + 1)
      const h = ctx.createGain()
      h.gain.value = i === 0 ? 1 : 0.25
      o.connect(h).connect(g)
      o.start(t)
      o.stop(off + RELEASE_S + 0.05)
    })
  }
  return ctx.startRendering()
}

/** 16-bit PCM WAV of the first channel. */
export function wavBytes(buffer: Pick<AudioBuffer, 'sampleRate' | 'getChannelData'>): Uint8Array {
  const samples = buffer.getChannelData(0)
  const out = new Uint8Array(44 + samples.length * 2)
  const v = new DataView(out.buffer)
  const text = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  v.setUint32(4, 36 + samples.length * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, buffer.sampleRate, true)
  v.setUint32(28, buffer.sampleRate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  text(36, 'data')
  v.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return out
}

/** A name as a file name: letters and digits kept (ș and ț too), the rest as dashes. */
export function audioFilename(name: string): string {
  const base = name
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${base || 'KeyPath'}.wav`
}

/** The recording as a WAV file, named for sending. */
export async function recordingToWav(r: Recording, name: string, make?: OfflineFactory): Promise<File> {
  const bytes = wavBytes(await renderRecording(r, AUDIO_RATE, make))
  return new File([bytes as BlobPart], audioFilename(name), { type: 'audio/wav' })
}
