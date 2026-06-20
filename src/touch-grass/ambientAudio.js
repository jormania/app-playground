// Procedural ambient soundscape via Web Audio — no audio files.
// Continuous beds (wind / water / whistle) sit low and steady; birds,
// crickets, and wind-chimes are scheduled one-shots with random timing.

const SCENES = {
  day:    { wind: 0.045, whistle: 0,    water: 0.065, crickets: 0,    birds: 0.6, chime: 0,   critters: true  },
  night:  { wind: 0.028, whistle: 0,    water: 0.04,  crickets: 0.25, birds: 0,   chime: 0,   critters: false },
  winter: { wind: 0.15,  whistle: 0.12, water: 0.02,  crickets: 0,    birds: 0,   chime: 0.5, critters: false },
}

const MASTER = 0.5

// biome beds layered over the scene: surf swell, traffic rumble, thin alpine
// wind, leaf rustle. `swell` modulates the level (a slow breath); `tone` slowly
// wanders the filter so the bed never sits as one flat block of sound.
const BIOME_BED = {
  coast:    { type: 'lowpass',  freq: 420,  gain: 0.075, swell: 0.55, tone: 0,  rate: 0.85 },
  city:     { type: 'lowpass',  freq: 200,  gain: 0.025, swell: 0.35, tone: 55, rate: 0.6 },
  mountain: { type: 'bandpass', freq: 950,  gain: 0.03,  swell: 0.20, tone: 35, rate: 1.2 },
  forest:   { type: 'bandpass', freq: 2200, gain: 0.022, swell: 0.12, tone: 0,  rate: 1.1 },
  plain:    { type: 'lowpass',  freq: 500,  gain: 0,     swell: 0,    tone: 0,  rate: 1.0 },
}

export function sceneFor(timeOfDay, season) {
  if (season === 'winter') return 'winter'
  if (timeOfDay === 'day' || timeOfDay === 'dawn') return 'day'
  return 'night'
}

export function createAmbience() {
  let ctx = null
  let master = null
  let n = {}
  let scene = 'day'
  let enabled = false
  let birdTimer = 0
  let crickTimer = 0
  let chimeTimer = 0
  let catTimer = 0
  let dogTimer = 0
  let planeTimer = 0
  let thunderTimer = 0
  let noiseBuf = null
  let walkers = []
  let disposed = false
  let weatherCond = null
  let weatherWind = 0
  let weatherIntensity = 0
  let biome = null
  let gullTimer = 0
  let solo = false
  let voiceTimers = []

  // Brownian-ish drift: nudge a param toward a new nearby target over a long,
  // randomized interval. Because each target builds on the last, it meanders
  // and trends like real weather rather than oscillating on a fixed period.
  function makeWalker(param, { min, max, step, minDur, maxDur }) {
    let current = (min + max) / 2
    param.setValueAtTime(current, ctx.currentTime)
    let timer
    const tick = () => {
      if (disposed) return
      current = Math.max(min, Math.min(max, current + (Math.random() * 2 - 1) * step))
      const dur = minDur + Math.random() * (maxDur - minDur)
      param.linearRampToValueAtTime(current, ctx.currentTime + dur)
      timer = setTimeout(tick, dur * 1000)
    }
    tick()
    return () => clearTimeout(timer)
  }

  // pink noise (Paul Kellet) — more natural than brown, far less audible looping
  function pinkNoiseBuffer(seconds) {
    const len = ctx.sampleRate * seconds
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.96900 * b2 + w * 0.1538520
      b3 = 0.86650 * b3 + w * 0.3104856
      b4 = 0.55000 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.0168980
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
      b6 = w * 0.115926
    }
    return buf
  }

  // looping source, decorrelated by playback rate + random start offset
  function loopNoise(buf, rate) {
    const s = ctx.createBufferSource()
    s.buffer = buf
    s.loop = true
    s.playbackRate.value = rate
    s.start(0, Math.random() * buf.duration)
    return s
  }

  function set(param, v, tc) {
    param.setTargetAtTime(v, ctx.currentTime, tc)
  }

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
    noiseBuf = pinkNoiseBuffer(8)

    // WIND: pink noise -> soft lowpass -> base gain -> very gentle drift -> master
    const windSrc = loopNoise(noiseBuf, 1.0)
    const windLP = ctx.createBiquadFilter()
    windLP.type = 'lowpass'; windLP.frequency.value = 320
    const windGain = ctx.createGain(); windGain.gain.value = 0
    const windDrift = ctx.createGain(); windDrift.gain.value = 0.9
    windSrc.connect(windLP).connect(windGain).connect(windDrift).connect(master)

    // WHISTLE (cold-wind overtone, winter): noise -> bandpass -> gain -> master
    const whSrc = loopNoise(noiseBuf, 1.11)
    const whBP = ctx.createBiquadFilter()
    whBP.type = 'bandpass'; whBP.frequency.value = 1200; whBP.Q.value = 6
    const whGain = ctx.createGain(); whGain.gain.value = 0
    const whSwell = ctx.createGain(); whSwell.gain.value = 0.7
    whSrc.connect(whBP).connect(whGain).connect(whSwell).connect(master)
    const whLfo = ctx.createOscillator(); whLfo.frequency.value = 0.045
    const whDepth = ctx.createGain(); whDepth.gain.value = 0.22
    whLfo.connect(whDepth).connect(whSwell.gain)
    whLfo.start()

    // WATER: noise -> highpass -> gentle bandpass -> gain -> master (steady trickle)
    const wSrc = loopNoise(noiseBuf, 0.91)
    const wHP = ctx.createBiquadFilter()
    wHP.type = 'highpass'; wHP.frequency.value = 650
    const wBP = ctx.createBiquadFilter()
    wBP.type = 'bandpass'; wBP.frequency.value = 1500; wBP.Q.value = 0.5
    const waterGain = ctx.createGain(); waterGain.gain.value = 0
    const waterDrift = ctx.createGain(); waterDrift.gain.value = 0.85
    wSrc.connect(wHP).connect(wBP).connect(waterGain).connect(waterDrift).connect(master)

    // RAIN: a brighter noise bed, gated by live weather (gain 0 when dry)
    const rSrc = loopNoise(noiseBuf, 1.07)
    const rHP = ctx.createBiquadFilter(); rHP.type = 'highpass'; rHP.frequency.value = 900
    const rLP = ctx.createBiquadFilter(); rLP.type = 'lowpass'; rLP.frequency.value = 5500
    const rainGain = ctx.createGain(); rainGain.gain.value = 0
    rSrc.connect(rHP).connect(rLP).connect(rainGain).connect(master)

    // BIOME BED: a place-coloured noise layer (surf / traffic / thin wind / rustle)
    const bSrc = loopNoise(noiseBuf, 1.0)
    const bFilter = ctx.createBiquadFilter(); bFilter.type = 'lowpass'; bFilter.frequency.value = 500
    const biomeGain = ctx.createGain(); biomeGain.gain.value = 0
    const biomeSwell = ctx.createGain(); biomeSwell.gain.value = 1
    bSrc.connect(bFilter).connect(biomeGain).connect(biomeSwell).connect(master)
    const bLfo = ctx.createOscillator(); bLfo.frequency.value = 0.085 // slow level swell
    const bDepth = ctx.createGain(); bDepth.gain.value = 0
    bLfo.connect(bDepth).connect(biomeSwell.gain); bLfo.start()
    // a second, slower LFO wanders the filter cutoff so the timbre drifts too
    const bToneLfo = ctx.createOscillator(); bToneLfo.frequency.value = 0.05
    const bToneDepth = ctx.createGain(); bToneDepth.gain.value = 0
    bToneLfo.connect(bToneDepth).connect(bFilter.frequency); bToneLfo.start()

    n = { windGain, whGain, waterGain, rainGain, biomeGain, bFilter, bDepth, bToneDepth, bSrc }
    applyScene(true)
    applyWeather()
    applyBiome()
    startSchedulers()

    // organic drift so wind & water swell and ebb over long, irregular spans
    walkers.push(makeWalker(windDrift.gain, { min: 0.28, max: 1.55, step: 0.32, minDur: 7, maxDur: 20 }))
    walkers.push(makeWalker(waterDrift.gain, { min: 0.45, max: 1.30, step: 0.24, minDur: 9, maxDur: 24 }))
  }

  function applyScene(immediate) {
    if (!ctx) return
    const tg = SCENES[scene]
    const tc = immediate ? 0.01 : 1.6
    const windBoost = Math.min(0.3, weatherWind * 0.006) // real wind raises the bed
    set(n.windGain.gain, solo ? 0 : tg.wind + windBoost, tc)
    set(n.whGain.gain, solo ? 0 : tg.whistle, tc)
    set(n.waterGain.gain, solo ? 0 : tg.water, tc)
  }

  function applyWeather() {
    if (!ctx) return
    const raining = weatherCond === 'rain' || weatherCond === 'thunder'
    const rainTarget = solo ? 0 : (raining ? 0.10 + weatherIntensity * 0.20 : 0)
    set(n.rainGain.gain, rainTarget, raining ? 1.2 : 2.0)
    applyScene(false) // refresh the wind boost
  }

  function applyBiome() {
    if (!ctx || !n.biomeGain) return
    const p = BIOME_BED[biome]
    if (!p) {
      set(n.biomeGain.gain, 0, 2.0); set(n.bDepth.gain, 0, 2.0); set(n.bToneDepth.gain, 0, 2.0)
      return
    }
    n.bFilter.type = p.type
    set(n.bFilter.frequency, p.freq, 1.5)
    set(n.bSrc.playbackRate, p.rate, 1.5)
    set(n.biomeGain.gain, p.gain, 2.2)
    set(n.bDepth.gain, p.swell, 2.2)
    set(n.bToneDepth.gain, p.tone || 0, 2.2)
  }

  // a gull's two-tone cry — a coastal one-shot, sparse
  function gull(t, level) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 5
    const g = ctx.createGain(); g.gain.value = 0.0001
    o.connect(bp).connect(g).connect(master)
    const base = 1500 + Math.random() * 500
    o.frequency.setValueAtTime(base, t)
    o.frequency.linearRampToValueAtTime(base * 1.12, t + 0.05)
    o.frequency.linearRampToValueAtTime(base * 0.62, t + 0.28)
    const peak = 0.05 * level
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.04)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32)
    o.start(t); o.stop(t + 0.36)
  }

  // an owl's soft low hoot — two notes, night woods
  function owl(t, level) {
    const base = 320 + Math.random() * 60
    ;[0, 0.5].forEach((dt, idx) => {
      const tt = t + dt
      const o = ctx.createOscillator(); o.type = 'sine'
      const g = ctx.createGain(); g.gain.value = 0.0001
      o.connect(g).connect(master)
      o.frequency.setValueAtTime(base * (idx ? 1.05 : 1), tt)
      o.frequency.linearRampToValueAtTime(base * 0.92, tt + 0.3)
      const peak = 0.06 * level
      g.gain.setValueAtTime(0.0001, tt)
      g.gain.linearRampToValueAtTime(peak, tt + 0.05)
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.42)
      o.start(tt); o.stop(tt + 0.5)
    })
  }

  // a crow's harsh caw — one to three rasps
  function crow(t, level) {
    const n = 1 + Math.floor(Math.random() * 3)
    for (let k = 0; k < n; k++) {
      const tt = t + k * (0.28 + Math.random() * 0.12)
      const o = ctx.createOscillator(); o.type = 'sawtooth'
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 3
      const g = ctx.createGain(); g.gain.value = 0.0001
      o.connect(bp).connect(g).connect(master)
      const f = 700 + Math.random() * 180
      o.frequency.setValueAtTime(f, tt)
      o.frequency.linearRampToValueAtTime(f * 0.7, tt + 0.18)
      const peak = 0.05 * level
      g.gain.setValueAtTime(0.0001, tt)
      g.gain.linearRampToValueAtTime(peak, tt + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.2)
      o.start(tt); o.stop(tt + 0.24)
    }
  }

  // a pigeon's soft coo — a few low warbles (city)
  function pigeon(t, level) {
    const o = ctx.createOscillator(); o.type = 'sine'
    const g = ctx.createGain(); g.gain.value = 0.0001
    o.connect(g).connect(master)
    const base = 470 + Math.random() * 60
    ;[0, 0.34, 0.62].forEach((dt, i) => {
      const tt = t + dt
      o.frequency.setValueAtTime(base * 0.9, tt)
      o.frequency.linearRampToValueAtTime(base * (i === 0 ? 1.15 : 1.05), tt + 0.08)
      o.frequency.linearRampToValueAtTime(base * 0.95, tt + 0.26)
      const peak = 0.045 * level
      g.gain.setValueAtTime(0.0001, tt)
      g.gain.linearRampToValueAtTime(peak, tt + 0.05)
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.3)
    })
    o.start(t); o.stop(t + 0.95)
  }

  // a raptor's high keening cry — descending (mountain / coast)
  function raptor(t, level) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 6
    const g = ctx.createGain(); g.gain.value = 0.0001
    o.connect(bp).connect(g).connect(master)
    const f = 2400 + Math.random() * 500
    o.frequency.setValueAtTime(f, t)
    o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.5)
    const peak = 0.04 * level
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.04)
    g.gain.setValueAtTime(peak, t + 0.18)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
    o.start(t); o.stop(t + 0.6)
  }

  // a bee/fly drifting past — a buzzing tremolo that swells in and out
  function bee(t, level) {
    const dur = 1.6 + Math.random() * 1.2
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 170 + Math.random() * 40
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900
    const env = ctx.createGain(); env.gain.value = 0.0001
    const tg = ctx.createGain(); tg.gain.value = 1
    o.connect(lp).connect(env).connect(tg).connect(master)
    const trem = ctx.createOscillator(); trem.type = 'sine'; trem.frequency.value = 24
    const td = ctx.createGain(); td.gain.value = 0.4
    trem.connect(td).connect(tg.gain)
    const peak = 0.03 * level
    env.gain.setValueAtTime(0.0001, t)
    env.gain.linearRampToValueAtTime(peak, t + dur * 0.4)
    env.gain.setValueAtTime(peak, t + dur * 0.6)
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.frequency.linearRampToValueAtTime(200 + Math.random() * 50, t + dur)
    o.start(t); trem.start(t); o.stop(t + dur + 0.1); trem.stop(t + dur + 0.1)
  }

  // a frog's low croak — a short train of pulses (night, near water)
  function frog(t, level) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 150 + Math.random() * 40
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600
    const g = ctx.createGain(); g.gain.value = 0.0001
    o.connect(lp).connect(g).connect(master)
    const pulses = 3 + Math.floor(Math.random() * 3)
    let tt = t
    for (let k = 0; k < pulses; k++) {
      g.gain.setValueAtTime(0.0001, tt)
      g.gain.linearRampToValueAtTime(0.05 * level, tt + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.07)
      tt += 0.09 + Math.random() * 0.03
    }
    o.start(t); o.stop(tt + 0.1)
  }

  // a rolling thunder clap — low-passed noise rumble plus a deep boom
  function thunderClap(t) {
    if (!noiseBuf) return
    const dur = 2.4 + Math.random() * 2.6
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = 0.35
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 190
    const g = ctx.createGain(); g.gain.value = 0.0001
    s.connect(lp).connect(g).connect(master)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.22, t + 0.04 + Math.random() * 0.12)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 44 + Math.random() * 16
    const og = ctx.createGain(); og.gain.value = 0.0001
    o.connect(og).connect(master)
    og.gain.setValueAtTime(0.0001, t)
    og.gain.linearRampToValueAtTime(0.10, t + 0.05)
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.8)
    s.start(t, Math.random() * noiseBuf.duration); s.stop(t + dur + 0.2)
    o.start(t); o.stop(t + dur + 0.2)
  }

  function chirp(t, level) {
    const o = ctx.createOscillator(); o.type = 'sine'
    const g = ctx.createGain(); g.gain.value = 0.0001
    o.connect(g).connect(master)
    const base = 1900 + Math.random() * 1900
    o.frequency.setValueAtTime(base, t)
    o.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.06)
    o.frequency.exponentialRampToValueAtTime(base * 0.85, t + 0.16)
    const peak = 0.12 * level
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    o.start(t); o.stop(t + 0.26)
  }

  // a single cricket's trill: a short burst of pulses at a random pitch
  function cricketTrill(t, level) {
    const o = ctx.createOscillator(); o.type = 'triangle'
    o.frequency.value = 4200 + Math.random() * 700
    const g = ctx.createGain(); g.gain.value = 0.0001
    o.connect(g).connect(master)
    const pulses = 3 + Math.floor(Math.random() * 4)
    let tt = t
    for (let k = 0; k < pulses; k++) {
      g.gain.setValueAtTime(0.0001, tt)
      g.gain.linearRampToValueAtTime(0.06 * level, tt + 0.008)
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.05)
      tt += 0.058 + Math.random() * 0.02
    }
    o.start(t); o.stop(tt + 0.1)
  }

  function chime(t, level) {
    const roots = [1568, 2093, 2637, 3136]
    const root = roots[Math.floor(Math.random() * roots.length)]
    ;[root, root * 2].forEach((f, idx) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f
      const g = ctx.createGain(); g.gain.value = 0.0001
      o.connect(g).connect(master)
      const peak = (idx === 0 ? 0.10 : 0.04) * level
      const decay = idx === 0 ? 3.2 : 2.2
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(peak, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
      o.start(t); o.stop(t + decay + 0.2)
    })
  }

  // a cat's meow — pitch glide up then down through a vocal formant
  function meow(t, level) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1000; bp.Q.value = 4
    const g = ctx.createGain(); g.gain.value = 0.0001
    o.connect(bp).connect(g).connect(master)
    o.frequency.setValueAtTime(520, t)
    o.frequency.linearRampToValueAtTime(840, t + 0.18)
    o.frequency.linearRampToValueAtTime(660, t + 0.40)
    o.frequency.linearRampToValueAtTime(430, t + 0.6)
    bp.frequency.setValueAtTime(900, t)
    bp.frequency.linearRampToValueAtTime(1500, t + 0.2)
    bp.frequency.linearRampToValueAtTime(700, t + 0.6)
    const peak = 0.09 * level
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.06)
    g.gain.setValueAtTime(peak, t + 0.4)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.66)
    o.start(t); o.stop(t + 0.7)
  }

  // a single distant woof
  function woof(t, level) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'
    o.frequency.setValueAtTime(260, t)
    o.frequency.exponentialRampToValueAtTime(150, t + 0.12)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 850
    const g = ctx.createGain(); g.gain.value = 0.0001
    o.connect(lp).connect(g).connect(master)
    const peak = 0.10 * level
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    o.start(t); o.stop(t + 0.2)
  }

  function dog(t, level) {
    woof(t, level)
    if (Math.random() < 0.6) woof(t + 0.24 + Math.random() * 0.12, level * 0.9)
  }

  // distant airplane — heavily low-passed rumble that swells in and fades out
  function airplane(t, level) {
    if (!noiseBuf) return
    const dur = 18 + Math.random() * 8
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = 0.5
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260
    const g = ctx.createGain(); g.gain.value = 0.0001
    s.connect(lp).connect(g).connect(master)
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 95
    const og = ctx.createGain(); og.gain.value = 0.0001
    o.connect(og).connect(master)
    const peak = 0.05 * level
    const opeak = 0.022 * level
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + dur * 0.45)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    og.gain.setValueAtTime(0.0001, t)
    og.gain.linearRampToValueAtTime(opeak, t + dur * 0.45)
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    s.start(t, Math.random() * noiseBuf.duration); s.stop(t + dur + 0.2)
    o.start(t); o.stop(t + dur + 0.2)
  }

  function startSchedulers() {
    const ready = () => enabled && ctx.state === 'running' && !solo
    const running = () => enabled && ctx.state === 'running'
    // a biome "voice": plays for matching biomes, and survives solo (it is part
    // of the biome) as long as a biome is actually set; null = the no-location case
    const voice = (...allowed) => running() && allowed.includes(biome) && (!solo || biome != null)
    const repeat = (fn, minMs, maxMs) => {
      const h = { id: 0 }
      const tick = () => {
        if (disposed) return
        fn()
        h.id = setTimeout(tick, minMs + Math.random() * (maxMs - minMs))
      }
      h.id = setTimeout(tick, minMs + Math.random() * (maxMs - minMs))
      voiceTimers.push(h)
    }
    const scheduleBird = () => {
      if (disposed) return
      const tg = SCENES[scene]
      if (ready() && tg.birds > 0) {
        const burst = 1 + Math.floor(Math.random() * 3)
        for (let i = 0; i < burst; i++) chirp(ctx.currentTime + i * 0.16 + Math.random() * 0.08, tg.birds)
      }
      birdTimer = setTimeout(scheduleBird, 800 + Math.random() * 2400)
    }
    const scheduleCat = () => {
      if (disposed) return
      if (ready() && SCENES[scene].critters) meow(ctx.currentTime, 0.7)
      catTimer = setTimeout(scheduleCat, 28000 + Math.random() * 30000)
    }
    const scheduleDog = () => {
      if (disposed) return
      if (ready() && SCENES[scene].critters) dog(ctx.currentTime, 0.7)
      dogTimer = setTimeout(scheduleDog, 32000 + Math.random() * 38000)
    }
    const schedulePlane = () => {
      if (disposed) return
      if (ready() && scene !== 'winter') airplane(ctx.currentTime, 1)
      planeTimer = setTimeout(schedulePlane, 120000 + Math.random() * 180000)
    }
    const scheduleCricket = () => {
      if (disposed) return
      const tg = SCENES[scene]
      if (enabled && !solo && tg.crickets > 0 && ctx.state === 'running') {
        cricketTrill(ctx.currentTime, tg.crickets)
        if (Math.random() < 0.4) cricketTrill(ctx.currentTime + 0.2 + Math.random() * 0.4, tg.crickets * 0.7)
      }
      crickTimer = setTimeout(scheduleCricket, 700 + Math.random() * 2400)
    }
    const scheduleChime = () => {
      if (disposed) return
      const tg = SCENES[scene]
      if (enabled && !solo && tg.chime > 0 && ctx.state === 'running') chime(ctx.currentTime, tg.chime)
      chimeTimer = setTimeout(scheduleChime, 10000 + Math.random() * 15000)
    }
    const scheduleThunder = () => {
      if (disposed) return
      if (ready() && weatherCond === 'thunder') thunderClap(ctx.currentTime + 0.1)
      thunderTimer = setTimeout(scheduleThunder, 8000 + Math.random() * 13000)
    }
    const scheduleGull = () => {
      if (disposed) return
      // part of the biome, so it plays in solo too (not gated by ready's !solo)
      if (enabled && ctx.state === 'running' && biome === 'coast') {
        const burst = 1 + Math.floor(Math.random() * 3)
        for (let i = 0; i < burst; i++) gull(ctx.currentTime + i * (0.3 + Math.random() * 0.25), 0.8)
      }
      gullTimer = setTimeout(scheduleGull, 14000 + Math.random() * 26000)
    }
    scheduleBird()
    scheduleCricket()
    scheduleChime()
    scheduleCat()
    scheduleDog()
    schedulePlane()
    scheduleThunder()
    scheduleGull()

    // biome- and time-aware voices, for a more varied, place-rooted soundscape.
    // null in the allow-list means "also when there's no location" (general).
    repeat(() => { if (voice(null, 'forest', 'plain', 'mountain') && scene === 'night') owl(ctx.currentTime, 0.7) }, 24000, 52000)
    repeat(() => { if (voice(null, 'forest', 'city', 'plain', 'mountain') && scene === 'day') crow(ctx.currentTime, 0.7) }, 22000, 46000)
    repeat(() => { if (voice('city') && scene === 'day') pigeon(ctx.currentTime, 0.7) }, 16000, 36000)
    repeat(() => { if (voice('mountain', 'coast') && scene === 'day') raptor(ctx.currentTime, 0.6) }, 28000, 62000)
    repeat(() => { if (voice(null, 'plain', 'forest') && scene === 'day') bee(ctx.currentTime, 0.7) }, 20000, 44000)
    repeat(() => { if (voice(null, 'plain', 'forest', 'coast') && scene === 'night') frog(ctx.currentTime, 0.7) }, 18000, 40000)
  }

  function buzz(pattern) {
    if (enabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(pattern) } catch (_) {}
    }
  }

  // short soft tick for button presses
  function tap() {
    buzz(10)
    if (!ctx || ctx.state !== 'running') return
    const t = ctx.currentTime
    const o = ctx.createOscillator(); o.type = 'sine'
    const g = ctx.createGain(); g.gain.value = 0.0001
    o.connect(g).connect(master)
    o.frequency.setValueAtTime(660, t)
    o.frequency.exponentialRampToValueAtTime(330, t + 0.06)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.28, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
    o.start(t); o.stop(t + 0.12)
  }

  // soft descending breath — marks stepping out across the threshold
  function depart() {
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    buzz(14)
    const t0 = ctx.currentTime + 0.02
    const notes = [659.25, 523.25, 392.00] // E5 C5 G4 descending
    notes.forEach((f, i) => {
      const t = t0 + i * 0.12
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f
      const g = ctx.createGain(); g.gain.value = 0.0001
      o.connect(g).connect(master)
      const peak = 0.14 - i * 0.022
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(peak, t + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
      o.start(t); o.stop(t + 1.0)
    })
  }

  // warm ascending shimmer — the "aha" when a discovery is revealed
  function reveal() {
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    buzz([20, 40, 20])
    const t0 = ctx.currentTime + 0.02
    const notes = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
    notes.forEach((f, i) => {
      const t = t0 + i * 0.10
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 1.004
      const g = ctx.createGain(); g.gain.value = 0.0001
      o.connect(g); o2.connect(g); g.connect(master)
      const peak = 0.16 - i * 0.018
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(peak, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2)
      o.start(t); o2.start(t); o.stop(t + 1.3); o2.stop(t + 1.3)
    })
  }

  return {
    tap,
    reveal,
    depart,
    setScene(s) {
      if (s === scene) return
      scene = s
      applyScene(false)
    },
    setWeather(w) {
      weatherCond = w ? w.condition : null
      weatherWind = w ? (w.wind || 0) : 0
      weatherIntensity = w ? (w.intensity || 0) : 0
      applyWeather()
    },
    setBiome(b) {
      if (b === biome) return
      biome = b
      applyBiome()
    },
    setSolo(on) {
      if (on === solo) return
      solo = on
      applyScene(false)
      applyWeather()
    },
    setEnabled(on) {
      enabled = on
      if (on) {
        if (!ctx) build()
        this.resume()
        set(master.gain, MASTER, 0.6)
      } else if (ctx) {
        set(master.gain, 0, 0.4)
      }
    },
    resume() {
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
    },
    dispose() {
      disposed = true
      clearTimeout(birdTimer)
      clearTimeout(crickTimer)
      clearTimeout(chimeTimer)
      clearTimeout(catTimer)
      clearTimeout(dogTimer)
      clearTimeout(planeTimer)
      clearTimeout(thunderTimer)
      clearTimeout(gullTimer)
      voiceTimers.forEach(h => clearTimeout(h.id))
      voiceTimers = []
      walkers.forEach(stop => stop())
      walkers = []
      if (ctx) ctx.close().catch(() => {})
      ctx = null
    },
  }
}
