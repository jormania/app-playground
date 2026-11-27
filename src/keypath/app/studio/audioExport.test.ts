import { describe, expect, it } from 'vitest'
import { audioFilename, heldLevel, renderRecording, wavBytes, type OfflineFactory } from './audioExport'

/** An offline context that records what is scheduled, and renders silence of the right length. */
function fakeOffline() {
  const params: { calls: [string, number, number][] }[] = []
  const oscs: { start: number; stop: number; type: string; freq: number }[] = []
  let made: { length: number; rate: number } | null = null
  const param = () => {
    const p = { value: 0, calls: [] as [string, number, number][] }
    params.push(p)
    const rec = (kind: string) => (v: number, at: number) => void p.calls.push([kind, v, at])
    return Object.assign(p, { setValueAtTime: rec('set'), linearRampToValueAtTime: rec('linear'), exponentialRampToValueAtTime: rec('exp') })
  }
  const node = () => ({ connect: (n: unknown) => n })
  const make: OfflineFactory = (_c, length, rate) => {
    made = { length, rate }
    return {
      destination: node(),
      createGain: () => ({ ...node(), gain: param() }),
      createDynamicsCompressor: () => node(),
      createOscillator: () => {
        const o = { ...node(), type: '', frequency: { value: 0 }, start: (t: number) => void (o.at = t), stop: (t: number) => oscs.push({ start: o.at, stop: t, type: o.type, freq: o.frequency.value }), at: 0 }
        return o
      },
      startRendering: async () => ({ sampleRate: rate, length, getChannelData: () => new Float32Array(length) }),
    } as unknown as ReturnType<OfflineFactory>
  }
  return { make, oscs, params, made: () => made }
}

describe('a recording as a sound file', () => {
  it('shapes each note as the phone does: up in 5 ms, down to 35% by 0.3 s, silent by 4 s', () => {
    expect(heldLevel(0.3, 0)).toBe(0)
    expect(heldLevel(0.3, 0.005)).toBeCloseTo(0.3)
    expect(heldLevel(0.3, 0.3)).toBeCloseTo(0.105)
    expect(heldLevel(0.3, 4)).toBeCloseTo(0.001)
    expect(heldLevel(0.3, 9)).toBe(0.001)
  })

  it('plays every note at its moment, in two voices, released where the key was let go, with room for the tail', async () => {
    const f = fakeOffline()
    const buffer = await renderRecording({ ms: 2000, notes: [{ pitch: 69, velocity: 100, startMs: 0, durationMs: 500 }, { pitch: 60, velocity: 60, startMs: 1000, durationMs: 100 }], pedal: [] }, 22_050, f.make)
    expect(f.oscs).toHaveLength(4)
    expect(f.oscs.filter((o) => o.freq === 440).map((o) => [o.type, o.start])).toEqual([['triangle', 0]])
    expect(f.oscs.find((o) => o.freq === 880)?.type).toBe('sine')
    // Released 0.25 s after the key, and stopped just after.
    expect(f.oscs.find((o) => o.freq === 440)!.stop).toBeCloseTo(0.8)
    // Two seconds of take, the release and a tail: never cut off at the last note.
    expect(buffer.length).toBe(Math.ceil((2 + 0.25 + 0.8) * 22_050))
    // Every ramp on a note's level runs forward in time.
    for (const p of f.params) for (let i = 1; i < p.calls.length; i++) expect(p.calls[i][2]).toBeGreaterThanOrEqual(p.calls[i - 1][2])
  })

  it('writes a 16-bit mono WAV any phone plays', () => {
    const samples = new Float32Array([0, 1, -1, 0.5, 2])
    const bytes = wavBytes({ sampleRate: 22_050, getChannelData: () => samples })
    const v = new DataView(bytes.buffer)
    const text = (at: number) => String.fromCharCode(...bytes.slice(at, at + 4))
    expect([text(0), text(8), text(12), text(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data'])
    expect([v.getUint16(20, true), v.getUint16(22, true), v.getUint32(24, true), v.getUint16(34, true)]).toEqual([1, 1, 22_050, 16])
    expect(v.getUint32(40, true)).toBe(10)
    expect([1, 2, 3, 4].map((i) => v.getInt16(44 + i * 2, true))).toEqual([32767, -32768, 16383, 32767]) // clipped, not wrapped
  })

  it('names the file after the take, Romanian letters kept', () => {
    expect(audioFilename('Interstellar Theme, take 1')).toBe('Interstellar-Theme-take-1.wav')
    expect(audioFilename('Cățeluș cu părul creț')).toBe('Cățeluș-cu-părul-creț.wav')
    expect(audioFilename('!!!')).toBe('KeyPath.wav')
  })
})
