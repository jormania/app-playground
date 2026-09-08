// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { DEFAULT_MIX, SCENE_PRESETS, MIX_MAX } from './storage'
import {
  taper,
  resolveMix,
  driftStep,
  reverbImpulse,
  createNightSoundscape,
  CHIME_PARTIALS,
  CHIME_DAMPING,
} from './soundscape'

// Yoru's eight blendable layers (it keeps `drone`, unlike Touch Grass).
const LAYER_KEYS = ['rain', 'waves', 'stream', 'wind', 'leaves', 'chime', 'warmth', 'drone']
const SHAPERS = ['volume', 'brightness', 'motion', 'pace']

describe('scene presets', () => {
  it('every preset defines exactly the eight layers', () => {
    for (const key of Object.keys(SCENE_PRESETS)) {
      expect(Object.keys(SCENE_PRESETS[key]).sort()).toEqual([...LAYER_KEYS].sort())
    }
  })

  it('presets leave the shapers alone (so a scene pick keeps your volume/tone)', () => {
    for (const key of Object.keys(SCENE_PRESETS)) {
      for (const s of SHAPERS) expect(SCENE_PRESETS[key]).not.toHaveProperty(s)
    }
  })

  it('every preset value is an integer in 0..MIX_MAX', () => {
    for (const key of Object.keys(SCENE_PRESETS)) {
      for (const v of Object.values(SCENE_PRESETS[key])) {
        expect(Number.isInteger(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(MIX_MAX)
      }
    }
  })

  it('DEFAULT_MIX carries all eight layers plus the four shapers', () => {
    for (const k of LAYER_KEYS) expect(DEFAULT_MIX).toHaveProperty(k)
    for (const s of SHAPERS) expect(DEFAULT_MIX).toHaveProperty(s)
  })
})

describe('taper', () => {
  it('pins 0 to true silence and 1 to unity', () => {
    expect(taper(0, 1.9)).toBe(0)
    expect(taper(1, 1.9)).toBe(1)
  })

  it('is monotonically non-decreasing', () => {
    let prev = -1
    for (let t = 0; t <= 1.00001; t += 0.05) {
      const v = taper(t, 1.4)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('clamps out-of-range input', () => {
    expect(taper(-1, 1.9)).toBe(0)
    expect(taper(2, 1.9)).toBe(1)
  })
})

describe('resolveMix', () => {
  it('volume 0 is true silence', () => {
    expect(resolveMix({ volume: 0 }).master).toBe(0)
  })

  it('the default volume 8 gives the tuned master ceiling', () => {
    expect(resolveMix({ volume: 8 }).master).toBeCloseTo(Math.pow(0.8, 1.9) * 0.24, 6)
  })

  it('maps brightness to a log-frequency low-pass', () => {
    expect(resolveMix({ brightness: 8 }).toneHz).toBeCloseTo(520 * Math.pow(8200 / 520, 0.8), 3)
  })

  it('resolves each layer through the gentler taper', () => {
    expect(resolveMix({ rain: 6 }).rain).toBeCloseTo(Math.pow(0.6, 1.4), 6)
    expect(resolveMix({ drone: 3 }).drone).toBeCloseTo(Math.pow(0.3, 1.4), 6)
  })

  it('tolerates missing input and ignores unknown keys', () => {
    expect(() => resolveMix(null)).not.toThrow()
    expect(resolveMix(null).master).toBe(0)
    expect(resolveMix({ nonsense: 99 }).rain).toBe(0)
  })
})

describe('driftStep — the aperiodic walk that replaced the LFOs', () => {
  it('stays inside [-1, 1] from any starting point', () => {
    for (const start of [-1, -0.5, 0, 0.5, 1]) {
      let v = start
      for (let i = 0; i < 2000; i++) {
        v = driftStep(v)
        expect(v).toBeGreaterThanOrEqual(-1)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })

  it('actually moves, and spends most of its time near calm', () => {
    let v = 0
    let sum = 0
    let peak = 0
    const n = 6000
    for (let i = 0; i < n; i++) {
      v = driftStep(v)
      sum += Math.abs(v)
      peak = Math.max(peak, Math.abs(v))
    }
    // gusts happen...
    expect(peak).toBeGreaterThan(0.7)
    // ...but the average is well below them, which is the whole point of the
    // shaped target: calm most of the time, not a sine forever at full swing
    expect(sum / n).toBeLessThan(0.45)
    expect(sum / n).toBeGreaterThan(0.05)
  })
})

describe('reverbImpulse', () => {
  it('normalises each channel to unit energy, whatever the sample rate', () => {
    for (const rate of [8000, 44100]) {
      for (const ch of reverbImpulse(rate, 1.6)) {
        let e = 0
        for (const x of ch) e += x * x
        expect(e).toBeCloseTo(1, 5)
      }
    }
  })

  it('leaves the pre-delay silent so the direct sound still arrives first', () => {
    const [l] = reverbImpulse(8000, 1.6, 0.02)
    for (let i = 0; i < 8000 * 0.02; i++) expect(l[i]).toBe(0)
    expect(l.some((x) => x !== 0)).toBe(true)
  })

  it('decays — the tail is quieter than the head', () => {
    const [l] = reverbImpulse(8000, 1.6)
    const rms = (from, to) => {
      let e = 0
      for (let i = from; i < to; i++) e += l[i] * l[i]
      return Math.sqrt(e / (to - from))
    }
    expect(rms(200, 2000)).toBeGreaterThan(rms(l.length - 2000, l.length))
  })

  it('generates its two channels independently (a correlated IR has no width)', () => {
    const [l, r] = reverbImpulse(8000, 1.6)
    let dot = 0
    for (let i = 0; i < l.length; i++) dot += l[i] * r[i]
    expect(Math.abs(dot)).toBeLessThan(0.2) // both are unit-energy, so this is the correlation
  })
})

// ── A stub just rich enough to build the graph. It exists for one assertion
// the pure helpers can't make: that no two noise sources read the same samples.
// Every droplet, bubble and rustle used to start at sample 0 of one shared
// buffer, so all of them were the same few milliseconds of noise in different
// filters — invisible in review, glaring in the ear. ─────────────────────────
function stubAudio() {
  const started = []
  const swept = { count: 0 }
  const clock = { t: 0 } // a getter on the context, so tests can move time forward
  const ramps = { count: 0 }
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {
      ramps.count++
    },
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
    cancelScheduledValues() {},
  })
  const node = (extra = {}) => ({
    connect() {},
    disconnect() {
      swept.count++
    },
    ...extra,
  })
  const filter = () => node({ type: '', frequency: param(), Q: param(), gain: param() })
  class Stub {
    constructor() {
      this.sampleRate = 8000
      this.state = 'running'
      this.destination = node()
    }
    get currentTime() {
      return clock.t
    }
    createGain() { return node({ gain: param() }) }
    createBiquadFilter() { return filter() }
    createStereoPanner() { return node({ pan: param() }) }
    createDynamicsCompressor() {
      return node({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() })
    }
    createOscillator() {
      return node({ type: '', frequency: param(), detune: param(), start() {}, stop() {} })
    }
    createConstantSource() { return node({ offset: param(), start() {}, stop() {} }) }
    createConvolver() { return node({ normalize: true, buffer: null }) }
    createBufferSource() {
      return node({
        buffer: null,
        loop: false,
        playbackRate: param(),
        start(when, offset) { started.push(offset) },
        stop() {},
      })
    }
    createBuffer(channels, length, sampleRate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length))
      return {
        duration: length / sampleRate,
        length,
        getChannelData: (i) => data[i],
        copyToChannel: (src, i) => data[i].set(src),
      }
    }
    resume() { return Promise.resolve() }
    close() { return Promise.resolve() }
  }
  window.AudioContext = Stub
  return {
    started,
    swept,
    ramps,
    advance: (sec) => {
      clock.t += sec
    },
  }
}

describe('the engine, built end to end', () => {
  let sound = null
  afterEach(() => {
    sound?.stop(0)
    sound = null
    vi.useRealTimers()
    delete window.AudioContext
    delete window.webkitAudioContext
  })

  const everything = { ...DEFAULT_MIX, rain: 6, waves: 5, stream: 5, wind: 5, leaves: 5, chime: 4 }

  it('builds every layer at once without throwing', async () => {
    const { started } = stubAudio()
    sound = createNightSoundscape()
    await sound.start({ totalSec: 900, mix: everything })
    expect(started.length).toBeGreaterThan(0)
  })

  it('gives every noise source its own offset into the shared buffer', async () => {
    const { started } = stubAudio()
    sound = createNightSoundscape()
    await sound.start({ totalSec: 900, mix: everything })
    // no source may start at the default (undefined / sample 0)...
    expect(started.every((o) => typeof o === 'number' && o > 0)).toBe(true)
    // ...and they must not all be reading the same place
    expect(new Set(started).size).toBeGreaterThan(1)
  })

  it('still starts, and still offsets, with stereo width off', async () => {
    const { started } = stubAudio()
    sound = createNightSoundscape()
    await sound.start({ totalSec: 900, mix: everything, stereo: false })
    expect(started.every((o) => typeof o === 'number' && o > 0)).toBe(true)
  })

  it('stays silent — and builds nothing — at volume 0', async () => {
    const { started } = stubAudio()
    sound = createNightSoundscape()
    await sound.start({ totalSec: 900, mix: { ...everything, volume: 0 } })
    expect(started).toHaveLength(0)
  })
})

describe('the sweeper', () => {
  let sound = null
  afterEach(() => {
    sound?.stop(0)
    sound = null
    vi.useRealTimers()
    delete window.AudioContext
    delete window.webkitAudioContext
  })

  // Waves opens a fresh gain + panner per breaking wave, hung off a foam chain
  // that never stops — so nothing about them is ever collectable on their own.
  // Left alone that is ~1000 live nodes by the end of a 90-minute night, all
  // processing silence, and nothing in the app would ever show it.
  it('disconnects a wave\'s foam nodes once its drain is finished', async () => {
    vi.useFakeTimers()
    const audio = stubAudio()
    sound = createNightSoundscape()
    await sound.start({
      totalSec: 5400,
      mix: { volume: 8, brightness: 8, motion: 5, pace: 5, waves: 6 },
    })
    // waves are scheduled from the layer's own interval, not at build time, so
    // the first tick is what puts any breaking waves on the timeline at all
    vi.advanceTimersByTime(1000)
    const before = audio.swept.count
    audio.advance(60) // a minute of waves have broken and drained
    vi.advanceTimersByTime(1000) // the sweep tick that should collect them
    expect(audio.swept.count).toBeGreaterThan(before)
  })
})

describe('chime partials', () => {
  it('damps the high partials fastest, so the tone darkens as it rings out', () => {
    const decays = CHIME_PARTIALS.map(([ratio]) => 1 / Math.pow(ratio, CHIME_DAMPING))
    for (let i = 1; i < decays.length; i++) expect(decays[i]).toBeLessThan(decays[i - 1])
  })

  it('keeps the partials inharmonic and descending in level', () => {
    const [ratios, amps] = [CHIME_PARTIALS.map((p) => p[0]), CHIME_PARTIALS.map((p) => p[1])]
    expect(ratios[0]).toBe(1)
    for (let i = 1; i < ratios.length; i++) {
      expect(ratios[i]).toBeGreaterThan(ratios[i - 1])
      expect(Number.isInteger(ratios[i])).toBe(false) // integer ratios would sound musical, not metallic
      expect(amps[i]).toBeLessThan(amps[i - 1])
    }
  })
})

describe('the granular rustle', () => {
  let sound = null
  afterEach(() => {
    sound?.stop(0)
    sound = null
    vi.useRealTimers()
    delete window.AudioContext
    delete window.webkitAudioContext
  })

  // A leaf rustle shares its band with the wind hush it sits on, so its SHAPE
  // is the only thing that can separate it — a cluster of very short ticks
  // does, a smooth swell never will at any level. That is easy to regress back
  // to by accident, and it looks like nothing in a diff, so assert it: one
  // blob is a single ramp, a tick cluster is dozens.
  it('schedules a rustle as dozens of ticks, not one swell', async () => {
    vi.useFakeTimers()
    const audio = stubAudio()
    sound = createNightSoundscape()
    await sound.start({
      totalSec: 900,
      mix: { volume: 8, brightness: 8, motion: 5, pace: 5, leaves: 6 },
    })
    const before = audio.ramps.count // the drifts' own automation
    vi.advanceTimersByTime(1000) // the rustle scheduler's first tick
    expect(audio.ramps.count - before).toBeGreaterThan(20)
  })
})
