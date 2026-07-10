// Procedural ambient soundscape via Web Audio — no audio files.
//
// Architecture:
//   master ← dry one-shots (each through its own StereoPanner) and the beds
//   master ← reverb return (a stereo impulse) ← per-voice send (amount per biome)
// Continuous beds (wind/whistle/water/rain/biome/city-sub) sit low and steady;
// everything else is a scheduled one-shot, placed in the stereo field. A slow
// "liveliness" drift swells and calms the whole field so it breathes over time.
// Gusts, after-rain transitions, dawn/dusk shaping and rare surprises keep it
// alive and warm without ever crowding the listener.

const SCENES = {
  day:    { wind: 0.028, whistle: 0,    water: 0.042, crickets: 0,    birds: 0.6, chime: 0,   critters: true  },
  night:  { wind: 0.018, whistle: 0,    water: 0.026, crickets: 0.25, birds: 0,   chime: 0,   critters: false },
  winter: { wind: 0.095, whistle: 0.07, water: 0.014, crickets: 0,    birds: 0,   chime: 0.5, critters: false },
}

const MASTER = 0.5

// biome beds layered over the scene: surf swell, traffic rumble, thin alpine
// wind, leaf rustle. `swell` modulates the level (a slow breath); `tone` wanders
// the filter so the bed never sits as one flat block; `verb` is its reverb send.
const BIOME_BED = {
  coast:    { type: 'lowpass',  freq: 420,  gain: 0.050, swell: 0.28, tone: 0,  rate: 0.85, verb: 0.20 },
  city:     { type: 'lowpass',  freq: 200,  gain: 0.016, swell: 0.10, tone: 40, rate: 0.6,  verb: 0.12 },
  mountain: { type: 'bandpass', freq: 950,  gain: 0.020, swell: 0.10, tone: 30, rate: 1.2,  verb: 0.34 },
  forest:   { type: 'bandpass', freq: 2200, gain: 0.015, swell: 0.07, tone: 0,  rate: 1.1,  verb: 0.22 },
  plain:    { type: 'lowpass',  freq: 500,  gain: 0,     swell: 0,    tone: 0,  rate: 1.0,  verb: 0.10 },
}
const DEFAULT_VERB = 0.15

// The Chorus (the mixer): five category buses grouping every scheduled voice
// and continuous bed, plus three shapers. Every category/volume default is
// UNITY (10/10 = gain 1) and warmth defaults fully open — the mixer is a set
// of user overrides layered on top of the existing, already-tuned sound, so
// until someone touches a slider, nothing about today's mix changes at all.
const WARMTH_MIN_HZ = 700 // fully closed: hushed and close
const WARMTH_MAX_HZ = 16000 // fully open: today's untouched tone
const ACTIVITY_MIN = 0.4
const ACTIVITY_MAX = 1.6

export function sceneFor(timeOfDay, season) {
  if (season === 'winter') return 'winter'
  if (timeOfDay === 'day' || timeOfDay === 'dawn') return 'day'
  return 'night'
}

export function createAmbience() {
  // ---- state ----
  let ctx = null
  let master = null
  let warmthFilter = null
  let reverbSend = null
  let noiseBuf = null
  let n = {}
  let catGains = {}       // { place, weather, wildlife, city, events } — built lazily, see build()
  let scene = 'day'
  let phase = 'day'        // exact time of day: dawn | day | dusk | night
  let season = 'summer'
  let biome = null
  let enabled = false
  let solo = false
  let disposed = false
  let weatherCond = null
  let weatherWind = 0
  let weatherIntensity = 0
  let prevCond = null
  let meteor = false
  let liveliness = 0.6     // 0.25..1, drifts slowly to make the field breathe
  let lastSurprise = -1e9
  let lastBellHour = -1
  let walkers = []
  let timers = []          // every self-rescheduling timer, cleared on dispose

  // ---- the Chorus mix (0..1 each; may be set before the graph exists — e.g.
  // sound is off — so it's held here and (re)applied whenever the graph is
  // built or a value changes; see applyMix() ----
  let mixPlace = 1, mixWeather = 1, mixWildlife = 1, mixCity = 1, mixEvents = 1
  let mixVolume = 1
  let activityMul = 1
  let warmthHz = WARMTH_MAX_HZ

  // ---- small helpers ----
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  const clamp01 = (v) => clamp(v, 0, 1)
  const rpan = (w) => (Math.random() * 2 - 1) * w
  const ready = () => enabled && ctx && ctx.state === 'running' && !solo
  // a biome "voice": plays for matching biomes and survives solo (it IS the
  // biome) as long as a biome is set; null in the list = the no-location case
  const voice = (...allowed) =>
    enabled && ctx && ctx.state === 'running' && allowed.includes(biome) && (!solo || biome != null)
  const lively = (p = 1) => Math.random() < p * liveliness * activityMul

  function set(param, v, tc) {
    param.setTargetAtTime(v, ctx.currentTime, tc)
  }

  // Brownian-ish drift: nudge a param toward a new nearby target over a long,
  // randomized interval, so it meanders like weather rather than oscillating.
  function makeWalker(param, { min, max, step, minDur, maxDur }) {
    let current = (min + max) / 2
    param.setValueAtTime(current, ctx.currentTime)
    let timer
    const tick = () => {
      if (disposed) return
      current = clamp(current + (Math.random() * 2 - 1) * step, min, max)
      const dur = minDur + Math.random() * (maxDur - minDur)
      param.linearRampToValueAtTime(current, ctx.currentTime + dur)
      timer = setTimeout(tick, dur * 1000)
    }
    tick()
    return () => clearTimeout(timer)
  }

  // self-rescheduling timer with a randomized period, registered for cleanup
  function every(minMs, maxMs, fn) {
    const h = { id: 0 }
    const tick = () => {
      if (disposed) return
      fn()
      h.id = setTimeout(tick, minMs + Math.random() * (maxMs - minMs))
    }
    h.id = setTimeout(tick, minMs + Math.random() * (maxMs - minMs))
    timers.push(h)
  }

  // pink noise (Paul Kellet) — natural, far less audible looping than white
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

  function loopNoise(buf, rate) {
    const s = ctx.createBufferSource()
    s.buffer = buf
    s.loop = true
    s.playbackRate.value = rate
    s.start(0, Math.random() * buf.duration)
    return s
  }

  // a stereo exponential-decay impulse — two decorrelated channels for width
  function makeIR(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
    return buf
  }

  // a placed, CATEGORIZED output: panner → that category's bus, which the
  // Chorus mixer can fade (and which itself forwards to master + the reverb
  // send — see the catGains wiring in build()). Every scheduled voice below
  // is tagged with one of 'place' | 'weather' | 'wildlife' | 'city' | 'events'.
  // Returns the panner so callers can automate its pan (e.g. a plane drifting
  // across).
  function out(pan = 0, category = 'place') {
    const p = ctx.createStereoPanner()
    p.pan.value = clamp(pan, -1, 1)
    p.connect(catGains[category] || master)
    return p
  }

  // a placed output for INTERACTION sounds (tap/depart/reveal) — always
  // straight to master + the reverb send, deliberately outside the Chorus's
  // five ambient categories (a confirmatory UI sound shouldn't go quiet just
  // because Wildlife is muted). Still scales with the master Volume shaper.
  function outUI(pan = 0) {
    const p = ctx.createStereoPanner()
    p.pan.value = clamp(pan, -1, 1)
    p.connect(master)
    if (reverbSend) p.connect(reverbSend)
    return p
  }

  // ============================ build the graph ============================
  function build() {
    const AC = window.AudioContext || window.webkitAudioContext
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0
    // WARMTH: one global tone shaper downstream of everything, the Chorus's
    // third shaper (cosy/muffled <-> today's untouched open tone).
    warmthFilter = ctx.createBiquadFilter()
    warmthFilter.type = 'lowpass'
    warmthFilter.frequency.value = warmthHz
    master.connect(warmthFilter).connect(ctx.destination)
    noiseBuf = pinkNoiseBuffer(8)

    // REVERB: a warm stereo room shared by the one-shots (send amount per biome)
    const convolver = ctx.createConvolver()
    convolver.buffer = makeIR(2.4, 3.2)
    const verbLP = ctx.createBiquadFilter(); verbLP.type = 'lowpass'; verbLP.frequency.value = 3600
    const reverbReturn = ctx.createGain(); reverbReturn.gain.value = 0.9
    reverbSend = ctx.createGain(); reverbSend.gain.value = DEFAULT_VERB
    reverbSend.connect(convolver)
    convolver.connect(verbLP).connect(reverbReturn).connect(master)

    // THE CHORUS: five category buses. Every scheduled voice and continuous
    // bed below routes into one of these (via out()'s category argument, or
    // directly for the beds) instead of straight to master, so each can be
    // faded independently; each bus forwards its own dry AND wet (reverb)
    // signal, so muting a category silences its reverb tail too, not just
    // the direct sound.
    catGains = {
      place: ctx.createGain(), weather: ctx.createGain(), wildlife: ctx.createGain(),
      city: ctx.createGain(), events: ctx.createGain(),
    }
    Object.values(catGains).forEach((g) => {
      g.gain.value = 1
      g.connect(master)
      g.connect(reverbSend)
    })

    // WIND: stereo bed (two decorrelated sources panned L/R) → level → slow
    // drift → gust gain (transient swells) → the Weather bus
    const windDrift = ctx.createGain(); windDrift.gain.value = 0.9
    const gustGain = ctx.createGain(); gustGain.gain.value = 1
    const windGain = ctx.createGain(); windGain.gain.value = 0
    windGain.connect(windDrift).connect(gustGain).connect(catGains.weather)
    ;[[-0.7, 0.98], [0.7, 1.03]].forEach(([pan, rate]) => {
      const s = loopNoise(noiseBuf, rate)
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320
      const pn = ctx.createStereoPanner(); pn.pan.value = pan
      s.connect(lp).connect(pn).connect(windGain)
    })

    // WHISTLE (cold-wind overtone, winter)
    const whSrc = loopNoise(noiseBuf, 1.11)
    const whBP = ctx.createBiquadFilter(); whBP.type = 'bandpass'; whBP.frequency.value = 1200; whBP.Q.value = 6
    const whGain = ctx.createGain(); whGain.gain.value = 0
    const whSwell = ctx.createGain(); whSwell.gain.value = 0.7
    whSrc.connect(whBP).connect(whGain).connect(whSwell).connect(catGains.weather)
    const whLfo = ctx.createOscillator(); whLfo.frequency.value = 0.035
    const whDepth = ctx.createGain(); whDepth.gain.value = 0.14
    whLfo.connect(whDepth).connect(whSwell.gain); whLfo.start()

    // WATER: a steady trickle
    const wSrc = loopNoise(noiseBuf, 0.91)
    const wHP = ctx.createBiquadFilter(); wHP.type = 'highpass'; wHP.frequency.value = 650
    const wBP = ctx.createBiquadFilter(); wBP.type = 'bandpass'; wBP.frequency.value = 1500; wBP.Q.value = 0.5
    const waterGain = ctx.createGain(); waterGain.gain.value = 0
    const waterDrift = ctx.createGain(); waterDrift.gain.value = 0.85
    wSrc.connect(wHP).connect(wBP).connect(waterGain).connect(waterDrift).connect(catGains.place)

    // RAIN: brighter bed, gated by live weather (gain 0 when dry)
    const rSrc = loopNoise(noiseBuf, 1.07)
    const rHP = ctx.createBiquadFilter(); rHP.type = 'highpass'; rHP.frequency.value = 900
    const rLP = ctx.createBiquadFilter(); rLP.type = 'lowpass'; rLP.frequency.value = 5500
    const rainGain = ctx.createGain(); rainGain.gain.value = 0
    rSrc.connect(rHP).connect(rLP).connect(rainGain).connect(catGains.weather)

    // BIOME BED: place-coloured noise (surf / traffic / thin wind / rustle),
    // with a level swell LFO and a slow tonal filter wander; sent to reverb too
    const bSrc = loopNoise(noiseBuf, 1.0)
    const bFilter = ctx.createBiquadFilter(); bFilter.type = 'lowpass'; bFilter.frequency.value = 500
    const biomeGain = ctx.createGain(); biomeGain.gain.value = 0
    const biomeSwell = ctx.createGain(); biomeSwell.gain.value = 1
    bSrc.connect(bFilter).connect(biomeGain).connect(biomeSwell).connect(catGains.place)
    // this bed's own dedicated reverb send (distinct from the Chorus buses'
    // shared one, an existing, separate design) — kept in `n` so applyMix()
    // can scale it by the Place level too, or it'd linger audibly even with
    // Place faded to 0
    const biomeVerb = ctx.createGain(); biomeVerb.gain.value = 0.12
    biomeSwell.connect(biomeVerb).connect(convolver) // widen the bed through the room
    const bLfo = ctx.createOscillator(); bLfo.frequency.value = 0.04
    const bDepth = ctx.createGain(); bDepth.gain.value = 0
    bLfo.connect(bDepth).connect(biomeSwell.gain); bLfo.start()
    const bToneLfo = ctx.createOscillator(); bToneLfo.frequency.value = 0.05
    const bToneDepth = ctx.createGain(); bToneDepth.gain.value = 0
    bToneLfo.connect(bToneDepth).connect(bFilter.frequency); bToneLfo.start()

    // CITY SUB: a deep distant throb, only in the city
    const csSrc = loopNoise(noiseBuf, 0.6)
    const csLP = ctx.createBiquadFilter(); csLP.type = 'lowpass'; csLP.frequency.value = 90
    const citySub = ctx.createGain(); citySub.gain.value = 0
    csSrc.connect(csLP).connect(citySub).connect(catGains.place)

    n = { windGain, gustGain, whGain, waterGain, rainGain, biomeGain, bFilter, bDepth, bToneDepth, bSrc, citySub, biomeVerb, reverbSend }

    applyScene(true)
    applyWeather()
    applyBiome()
    applyMix() // push any mix already set (e.g. sound was off) onto the freshly built graph
    startSchedulers()
    startLiveliness()

    // very gentle, very slow breathing — a narrow range crossed over long spans,
    // so the bed only barely stirs; real dynamism comes from gusts
    walkers.push(makeWalker(windDrift.gain, { min: 0.72, max: 1.05, step: 0.07, minDur: 26, maxDur: 60 }))
    walkers.push(makeWalker(waterDrift.gain, { min: 0.74, max: 1.04, step: 0.06, minDur: 28, maxDur: 64 }))
  }

  // ============================ the Chorus mix ============================
  // Applies the current mix values to the live graph (a no-op before build()
  // has run — see build()'s own applyMix() call, which catches up once it has).
  function applyMix() {
    if (!ctx) return
    set(catGains.place.gain, mixPlace, 1.2)
    set(catGains.weather.gain, mixWeather, 1.2)
    set(catGains.wildlife.gain, mixWildlife, 1.2)
    set(catGains.city.gain, mixCity, 1.2)
    set(catGains.events.gain, mixEvents, 1.2)
    if (n.biomeVerb) set(n.biomeVerb.gain, 0.12 * mixPlace, 1.2)
    if (warmthFilter) set(warmthFilter.frequency, warmthHz, 1.5)
    if (master) set(master.gain, enabled ? MASTER * mixVolume : 0, 0.6)
  }

  // ============================ bed levels ============================
  function applyScene(immediate) {
    if (!ctx) return
    const tg = SCENES[scene]
    const tc = immediate ? 0.01 : 1.6
    const windBoost = Math.min(0.3, weatherWind * 0.006)
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
    set(n.reverbSend.gain, p ? p.verb : DEFAULT_VERB, 2.0)
    set(n.citySub.gain, biome === 'city' ? 0.03 : 0, 2.2)
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

  // ============================ voices (one-shots) ============================
  function chirp(t, level, pan = 0) {
    const o = ctx.createOscillator(); o.type = 'sine'
    const g = ctx.createGain(); g.gain.value = 0.0001
    o.connect(g).connect(out(pan, 'wildlife'))
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

  function cricketTrill(t, level, pan = 0) {
    const o = ctx.createOscillator(); o.type = 'triangle'
    o.frequency.value = 4200 + Math.random() * 700
    const g = ctx.createGain(); g.gain.value = 0.0001
    o.connect(g).connect(out(pan, 'wildlife'))
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

  function chime(t, level, pan = 0) {
    const roots = [1568, 2093, 2637, 3136]
    const root = roots[Math.floor(Math.random() * roots.length)]
    const dest = out(pan, 'weather')
    ;[root, root * 2].forEach((f, idx) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f
      const g = ctx.createGain(); g.gain.value = 0.0001
      o.connect(g).connect(dest)
      const peak = (idx === 0 ? 0.10 : 0.04) * level
      const decay = idx === 0 ? 3.2 : 2.2
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(peak, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
      o.start(t); o.stop(t + decay + 0.2)
    })
  }

  function meow(t, level, pan = 0) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1000; bp.Q.value = 4
    const g = ctx.createGain(); g.gain.value = 0.0001
    o.connect(bp).connect(g).connect(out(pan, 'wildlife'))
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

  function woof(t, level, dest) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'
    o.frequency.setValueAtTime(260, t)
    o.frequency.exponentialRampToValueAtTime(150, t + 0.12)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 850
    const g = ctx.createGain(); g.gain.value = 0.0001
    o.connect(lp).connect(g).connect(dest)
    const peak = 0.10 * level
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    o.start(t); o.stop(t + 0.2)
  }
  function dog(t, level, pan = 0) {
    const dest = out(pan, 'wildlife')
    woof(t, level, dest)
    if (Math.random() < 0.6) woof(t + 0.24 + Math.random() * 0.12, level * 0.9, dest)
  }

  // distant airplane — heavily low-passed rumble that drifts across the stereo field
  function airplane(t, level) {
    if (!noiseBuf) return
    const dur = 18 + Math.random() * 8
    const dest = out(-0.85, 'city')
    dest.pan.setValueAtTime(-0.85, t)
    dest.pan.linearRampToValueAtTime(0.85, t + dur)
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = 0.5
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260
    const g = ctx.createGain(); g.gain.value = 0.0001
    s.connect(lp).connect(g).connect(dest)
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 95
    const og = ctx.createGain(); og.gain.value = 0.0001
    o.connect(og).connect(dest)
    const peak = 0.05 * level, opeak = 0.022 * level
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(opeak, t + dur * 0.45); og.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    s.start(t, Math.random() * noiseBuf.duration); s.stop(t + dur + 0.2)
    o.start(t); o.stop(t + dur + 0.2)
  }

  // a rolling thunder clap — deep sub boom + low rumble (felt, not sharp)
  function thunderClap(t) {
    if (!noiseBuf) return
    const dur = 2.6 + Math.random() * 2.8
    const dest = out(rpan(0.4), 'weather')
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = 0.3
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140
    const g = ctx.createGain(); g.gain.value = 0.0001
    s.connect(lp).connect(g).connect(dest)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.22, t + 0.05 + Math.random() * 0.12)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const o = ctx.createOscillator(); o.type = 'sine'
    o.frequency.setValueAtTime(40 + Math.random() * 10, t)
    o.frequency.exponentialRampToValueAtTime(27, t + dur * 0.9)
    const og = ctx.createGain(); og.gain.value = 0.0001
    o.connect(og).connect(out(0, 'weather'))
    og.gain.setValueAtTime(0.0001, t)
    og.gain.linearRampToValueAtTime(0.15, t + 0.06)
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.85)
    s.start(t, Math.random() * noiseBuf.duration); s.stop(t + dur + 0.2)
    o.start(t); o.stop(t + dur + 0.2)
  }

  function gull(t, level, pan = 0) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 5
    const g = ctx.createGain(); g.gain.value = 0.0001
    o.connect(bp).connect(g).connect(out(pan, 'wildlife'))
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

  function owl(t, level, pan = 0) {
    const base = 320 + Math.random() * 60
    const dest = out(pan, 'wildlife')
    ;[0, 0.5].forEach((dt, idx) => {
      const tt = t + dt
      const o = ctx.createOscillator(); o.type = 'sine'
      const g = ctx.createGain(); g.gain.value = 0.0001
      o.connect(g).connect(dest)
      o.frequency.setValueAtTime(base * (idx ? 1.05 : 1), tt)
      o.frequency.linearRampToValueAtTime(base * 0.92, tt + 0.3)
      const peak = 0.06 * level
      g.gain.setValueAtTime(0.0001, tt)
      g.gain.linearRampToValueAtTime(peak, tt + 0.05)
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.42)
      o.start(tt); o.stop(tt + 0.5)
    })
  }

  function crow(t, level, pan = 0) {
    const dest = out(pan, 'wildlife')
    const reps = 1 + Math.floor(Math.random() * 3)
    for (let k = 0; k < reps; k++) {
      const tt = t + k * (0.28 + Math.random() * 0.12)
      const o = ctx.createOscillator(); o.type = 'sawtooth'
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 3
      const g = ctx.createGain(); g.gain.value = 0.0001
      o.connect(bp).connect(g).connect(dest)
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

  function pigeon(t, level, pan = 0) {
    const o = ctx.createOscillator(); o.type = 'sine'
    const g = ctx.createGain(); g.gain.value = 0.0001
    o.connect(g).connect(out(pan, 'wildlife'))
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

  function raptor(t, level, pan = 0) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 6
    const g = ctx.createGain(); g.gain.value = 0.0001
    o.connect(bp).connect(g).connect(out(pan, 'wildlife'))
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

  function bee(t, level, pan = 0) {
    const dur = 1.6 + Math.random() * 1.2
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 170 + Math.random() * 40
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900
    const env = ctx.createGain(); env.gain.value = 0.0001
    const tg = ctx.createGain(); tg.gain.value = 1
    o.connect(lp).connect(env).connect(tg).connect(out(pan, 'wildlife'))
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

  function frog(t, level, pan = 0) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 150 + Math.random() * 40
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600
    const g = ctx.createGain(); g.gain.value = 0.0001
    o.connect(lp).connect(g).connect(out(pan, 'wildlife'))
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

  // skylark — a fast, sustained high warble overhead (meadow, day)
  function skylark(t, pan = 0) {
    const dur = 2.0 + Math.random() * 2
    const o = ctx.createOscillator(); o.type = 'sine'
    const g = ctx.createGain(); g.gain.value = 0.0001
    o.connect(g).connect(out(pan, 'wildlife'))
    let tt = t
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.04, t + 0.12)
    while (tt < t + dur) {
      o.frequency.setValueAtTime(3000 * (0.8 + Math.random() * 0.5), tt)
      tt += 0.05 + Math.random() * 0.04
    }
    g.gain.setValueAtTime(0.04, t + dur - 0.3)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.start(t); o.stop(t + dur + 0.05)
  }

  // a gust: a long, soft swell of the wind bed + a gentle panned whoosh that
  // rises and ebbs over many seconds — background, never a sudden surge
  function gust(t, level, pan = rpan(0.5)) {
    if (n.gustGain) {
      const gg = n.gustGain.gain
      gg.cancelScheduledValues(t)
      gg.setValueAtTime(gg.value, t)
      gg.linearRampToValueAtTime(1 + 0.22 * level, t + 5 + Math.random() * 2) // long, slow rise
      gg.linearRampToValueAtTime(1, t + 13 + Math.random() * 5)               // even slower ebb
    }
    if (!noiseBuf) return
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = 1.0
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.6
    const f0 = biome === 'forest' ? 2200 : 650
    bp.frequency.setValueAtTime(f0 * 0.6, t)
    bp.frequency.linearRampToValueAtTime(f0, t + 4)
    bp.frequency.linearRampToValueAtTime(f0 * 0.65, t + 11)
    const g = ctx.createGain(); g.gain.value = 0.0001
    s.connect(bp).connect(g).connect(out(pan, 'weather'))
    const peak = 0.022 * level
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 4)        // gentle ~4s fade-in
    g.gain.linearRampToValueAtTime(0.0001, t + 11)     // ~7s fade-out (linear, no exp snap)
    s.start(t, Math.random() * noiseBuf.duration); s.stop(t + 11.3)
  }

  // ---- per-biome ambient accents: one distinct, soft, widely-panned voice for
  // each biome, scheduled sparsely so the field is richer but never crowded ----

  // coast: a single wave washing in and receding — gentle filtered swell
  function waveWash(t, level, pan) {
    if (!noiseBuf) return
    const dur = 6 + Math.random() * 2
    const dest = out(pan, 'place')
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = 0.8
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.setValueAtTime(280, t)
    lp.frequency.linearRampToValueAtTime(720, t + dur * 0.4) // wash builds, brighter
    lp.frequency.linearRampToValueAtTime(240, t + dur)       // recedes, darker
    const g = ctx.createGain(); g.gain.value = 0.0001
    s.connect(lp).connect(g).connect(dest)
    const peak = 0.04 * level
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + dur * 0.4)
    g.gain.linearRampToValueAtTime(0.0001, t + dur)
    s.start(t, Math.random() * noiseBuf.duration); s.stop(t + dur + 0.2)
  }

  // forest: a soft hollow wood knock or two — distant, woody, unhurried
  function woodKnock(t, level, pan) {
    const dest = out(pan, 'place')
    const reps = 1 + Math.floor(Math.random() * 2)
    for (let k = 0; k < reps; k++) {
      const tt = t + k * (0.18 + Math.random() * 0.12)
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 170 + Math.random() * 50
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 430; bp.Q.value = 4
      const g = ctx.createGain(); g.gain.value = 0.0001
      o.connect(bp).connect(g).connect(dest)
      const peak = 0.04 * level
      g.gain.setValueAtTime(0.0001, tt)
      g.gain.linearRampToValueAtTime(peak, tt + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.18)
      o.start(tt); o.stop(tt + 0.22)
    }
  }

  // city: a distant car drifting past — a low whoosh that pans across the field
  function carPass(t, level) {
    if (!noiseBuf) return
    const dur = 5 + Math.random() * 2.5
    const dest = out(-0.85, 'city')
    dest.pan.setValueAtTime(-0.85, t)
    dest.pan.linearRampToValueAtTime(0.85, t + dur)
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = 0.9
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380
    const g = ctx.createGain(); g.gain.value = 0.0001
    s.connect(lp).connect(g).connect(dest)
    const peak = 0.03 * level
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + dur * 0.5)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    s.start(t, Math.random() * noiseBuf.duration); s.stop(t + dur + 0.2)
  }

  // mountain: a far-off cowbell — soft metallic clank, pastoral and sparse
  function cowbell(t, level, pan) {
    const dest = out(pan, 'place')
    const clanks = 1 + Math.floor(Math.random() * 2)
    for (let c = 0; c < clanks; c++) {
      const ct = t + c * (0.28 + Math.random() * 0.14)
      const base = 520 + Math.random() * 90
      ;[1, 1.5, 2.4].forEach((mult, idx) => {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = base * mult
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = base * 1.6; bp.Q.value = 7
        const g = ctx.createGain(); g.gain.value = 0.0001
        o.connect(bp).connect(g).connect(dest)
        const peak = (0.028 / (idx + 1)) * level
        g.gain.setValueAtTime(0.0001, ct)
        g.gain.linearRampToValueAtTime(peak, ct + 0.005)
        g.gain.exponentialRampToValueAtTime(0.0001, ct + 0.45)
        o.start(ct); o.stop(ct + 0.55)
      })
    }
  }

  // plain: a soft breath of wind through tall grass — airy high-passed swell
  function grassRustle(t, level, pan) {
    if (!noiseBuf) return
    const dur = 3.5 + Math.random() * 2
    const dest = out(pan, 'place')
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = 1.2
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200
    const g = ctx.createGain(); g.gain.value = 0.0001
    s.connect(hp).connect(lp).connect(g).connect(dest)
    const peak = 0.022 * level
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + dur * 0.45)
    g.gain.linearRampToValueAtTime(0.0001, t + dur)
    s.start(t, Math.random() * noiseBuf.duration); s.stop(t + dur + 0.2)
  }

  // a single water drip — used as rain clears
  function drip(t, pan = 0) {
    const o = ctx.createOscillator(); o.type = 'sine'
    const g = ctx.createGain(); g.gain.value = 0.0001
    o.connect(g).connect(out(pan, 'weather'))
    const f = 900 + Math.random() * 900
    o.frequency.setValueAtTime(f, t)
    o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.08)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.05, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
    o.start(t); o.stop(t + 0.14)
  }

  // ---- surprises (rare, soft, distant) ----
  function bell(t) {
    const strikes = 1 + Math.floor(Math.random() * 2)
    const root = 330
    const pan = rpan(0.3)
    for (let k = 0; k < strikes; k++) {
      const tt = t + k * 1.6
      const dest = out(pan, 'events')
      ;[1, 2.0, 2.76, 5.4].forEach((mult, idx) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = root * mult
        const g = ctx.createGain(); g.gain.value = 0.0001
        o.connect(g).connect(dest)
        const peak = 0.06 / (idx + 1)
        g.gain.setValueAtTime(0.0001, tt)
        g.gain.linearRampToValueAtTime(peak, tt + 0.01)
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 3.2 / (1 + idx * 0.4))
        o.start(tt); o.stop(tt + 3.4)
      })
    }
  }

  function cuckoo(t) {
    const pan = rpan(0.5)
    const dest = out(pan, 'events')
    ;[[0, 1.0], [0.45, 0.8]].forEach(([dt, fr]) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 720 * fr
      const g = ctx.createGain(); g.gain.value = 0.0001
      o.connect(g).connect(dest)
      const tt = t + dt
      g.gain.setValueAtTime(0.0001, tt)
      g.gain.linearRampToValueAtTime(0.06, tt + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.22)
      o.start(tt); o.stop(tt + 0.26)
    })
  }

  function woodpecker(t) {
    const pan = rpan(0.6)
    const dest = out(pan, 'events')
    const reps = 6 + Math.floor(Math.random() * 6)
    for (let k = 0; k < reps; k++) {
      const tt = t + k * 0.04
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 180
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 2
      const g = ctx.createGain(); g.gain.value = 0.0001
      o.connect(bp).connect(g).connect(dest)
      g.gain.setValueAtTime(0.0001, tt)
      g.gain.linearRampToValueAtTime(0.05, tt + 0.003)
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.03)
      o.start(tt); o.stop(tt + 0.04)
    }
  }

  function wolf(t) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200
    const g = ctx.createGain(); g.gain.value = 0.0001
    o.connect(lp).connect(g).connect(out(rpan(0.5), 'events'))
    const base = 300 + Math.random() * 60
    o.frequency.setValueAtTime(base * 0.8, t)
    o.frequency.linearRampToValueAtTime(base * 1.3, t + 0.6)
    o.frequency.linearRampToValueAtTime(base * 1.15, t + 1.6)
    o.frequency.linearRampToValueAtTime(base * 0.7, t + 2.4)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.06, t + 0.3)
    g.gain.setValueAtTime(0.06, t + 1.6)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5)
    o.start(t); o.stop(t + 2.6)
  }

  function foghorn(t) {
    const dest = out(rpan(0.2), 'events')
    ;[78, 116].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f
      const g = ctx.createGain(); g.gain.value = 0.0001
      o.connect(g).connect(dest)
      const peak = i === 0 ? 0.12 : 0.06
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(peak, t + 0.4)
      g.gain.setValueAtTime(peak, t + 1.4)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6)
      o.start(t); o.stop(t + 2.8)
    })
  }

  // a soft rising glassy shimmer — paired with a shooting star
  function meteorShimmer(t) {
    const pan = rpan(0.6)
    const dest = out(pan, 'events')
    ;[1, 1.5, 2.01].forEach((mult, idx) => {
      const o = ctx.createOscillator(); o.type = 'sine'
      const g = ctx.createGain(); g.gain.value = 0.0001
      o.connect(g).connect(dest)
      const f = 1400 * mult
      o.frequency.setValueAtTime(f * 0.9, t)
      o.frequency.linearRampToValueAtTime(f * 1.15, t + 1.2)
      const peak = 0.03 / (idx + 1)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(peak, t + 0.4)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
      o.start(t); o.stop(t + 1.7)
    })
  }

  // ============================ schedulers ============================
  function startSchedulers() {
    // birds — denser at dawn (the chorus), normal by day, silent otherwise
    every(800, 3200, () => {
      const tg = SCENES[scene]
      if (!ready() || tg.birds <= 0) return
      if (!lively(phase === 'dawn' ? 1 : 0.85)) return
      const extra = phase === 'dawn' ? 2 : 0
      const burst = 1 + Math.floor(Math.random() * (2 + extra))
      for (let i = 0; i < burst; i++) chirp(ctx.currentTime + i * 0.16 + Math.random() * 0.08, tg.birds, rpan(0.6))
    })
    // crickets — night (fade in across dusk as the scene turns)
    every(700, 2600, () => {
      const tg = SCENES[scene]
      if (!(enabled && ctx.state === 'running' && !solo) || tg.crickets <= 0) return
      if (!lively(0.9)) return
      cricketTrill(ctx.currentTime, tg.crickets, rpan(0.7))
      if (Math.random() < 0.4) cricketTrill(ctx.currentTime + 0.2 + Math.random() * 0.4, tg.crickets * 0.7, rpan(0.7))
    })
    every(10000, 15000, () => {
      const tg = SCENES[scene]
      if (enabled && !solo && tg.chime > 0 && ctx.state === 'running') chime(ctx.currentTime, tg.chime, rpan(0.5))
    })
    every(28000, 58000, () => { if (ready() && SCENES[scene].critters && lively(0.85)) meow(ctx.currentTime, 0.7, rpan(0.7)) })
    every(32000, 70000, () => { if (ready() && SCENES[scene].critters && lively(0.85)) dog(ctx.currentTime, 0.7, rpan(0.7)) })
    every(120000, 240000, () => { if (ready() && scene !== 'winter') airplane(ctx.currentTime, 1) })
    every(8000, 13000, () => { if (ready() && weatherCond === 'thunder') thunderClap(ctx.currentTime + 0.1) })

    // wind gusts — only when it's genuinely breezy, and likelier/stronger the
    // windier it really is. A calm clear day stays gust-free and serene.
    every(30000, 72000, () => {
      if (!ready() || weatherWind < 12) return
      if (!lively(Math.min(0.7, weatherWind / 40))) return
      gust(ctx.currentTime, Math.min(0.9, weatherWind / 46))
    })

    // biome- and time-aware voices (null = also when there's no location)
    every(14000, 40000, () => {
      if (!voice('coast')) return
      const burst = 1 + Math.floor(Math.random() * 3)
      for (let i = 0; i < burst; i++) gull(ctx.currentTime + i * (0.3 + Math.random() * 0.25), 0.8, rpan(0.8))
    })
    every(24000, 52000, () => { if (voice(null, 'forest', 'plain', 'mountain') && scene === 'night' && lively(0.8)) owl(ctx.currentTime, 0.7, rpan(0.5)) })
    every(22000, 46000, () => { if (voice(null, 'forest', 'city', 'plain', 'mountain') && scene === 'day' && lively(0.8)) crow(ctx.currentTime, 0.7, rpan(0.6)) })
    every(16000, 36000, () => { if (voice('city') && scene === 'day' && lively(0.85)) pigeon(ctx.currentTime, 0.7, rpan(0.6)) })
    every(28000, 62000, () => { if (voice('mountain', 'coast') && scene === 'day' && lively(0.8)) raptor(ctx.currentTime, 0.6, rpan(0.7)) })
    every(20000, 44000, () => { if (voice(null, 'plain', 'forest') && scene === 'day' && lively(0.8)) bee(ctx.currentTime, 0.7, rpan(0.6)) })
    every(18000, 40000, () => { if (voice(null, 'plain', 'forest', 'coast') && scene === 'night' && lively(0.8)) frog(ctx.currentTime, 0.7, rpan(0.7)) })
    every(26000, 58000, () => { if (voice(null, 'plain') && scene === 'day' && lively(0.7)) skylark(ctx.currentTime, rpan(0.5)) })

    // one distinct, gentle accent per biome — sparse and wide on the stage, so
    // each place gains a little more character without crowding the bed
    every(22000, 50000, () => { if (voice('coast') && lively(0.7)) waveWash(ctx.currentTime, 0.9, rpan(0.85)) })
    every(30000, 64000, () => { if (voice('forest') && lively(0.6)) woodKnock(ctx.currentTime, 0.8, rpan(0.8)) })
    every(34000, 78000, () => { if (voice('city') && lively(0.7)) carPass(ctx.currentTime, 0.8) })
    every(38000, 84000, () => { if (voice('mountain') && lively(0.6)) cowbell(ctx.currentTime, 0.7, rpan(0.7)) })
    every(28000, 60000, () => { if (voice('plain') && lively(0.7)) grassRustle(ctx.currentTime, 0.9, rpan(0.8)) })

    // rare surprises — at most one at a time, on a cooldown, low probability
    every(20000, 34000, scheduleSurprise)
  }

  function scheduleSurprise() {
    if (!ready() || ctx.currentTime - lastSurprise < 28) return
    const opts = []
    const now = new Date()
    if (now.getMinutes() < 2 && now.getHours() !== lastBellHour) opts.push('bell')
    if (season === 'spring' && scene === 'day' && (biome === 'forest' || biome === 'plain' || biome == null)) opts.push('cuckoo')
    if (scene === 'day' && (biome === 'forest' || biome == null)) opts.push('woodpecker')
    if (phase === 'night' && (season === 'winter' || biome === 'mountain') && weatherCond !== 'rain' && weatherCond !== 'thunder') opts.push('wolf')
    if (weatherCond === 'fog' && (biome === 'coast' || biome == null)) opts.push('foghorn')
    if (meteor && (phase === 'night' || phase === 'dusk') && weatherCond !== 'rain' && weatherCond !== 'thunder') opts.push('meteor')
    if (!opts.length) return
    if (Math.random() > 0.45 * liveliness + 0.1) return
    const pick = opts[Math.floor(Math.random() * opts.length)]
    const t = ctx.currentTime + 0.05
    if (pick === 'bell') { bell(t); lastBellHour = now.getHours() }
    else if (pick === 'cuckoo') cuckoo(t)
    else if (pick === 'woodpecker') woodpecker(t)
    else if (pick === 'wolf') wolf(t)
    else if (pick === 'foghorn') foghorn(t)
    else if (pick === 'meteor') meteorShimmer(t)
    lastSurprise = ctx.currentTime
  }

  // a slow random walk of overall activity, so the field swells and calms
  function startLiveliness() {
    const tick = () => {
      if (disposed) return
      const target = 0.3 + Math.random() * 0.7
      liveliness = clamp(liveliness + (target - liveliness) * 0.4, 0.25, 1)
      h.id = setTimeout(tick, 6000 + Math.random() * 7000)
    }
    const h = { id: setTimeout(tick, 4000) }
    timers.push(h)
  }

  // when rain stops: a scatter of drips, then a few birds returning
  function rainClearing() {
    if (!ctx) return
    const drops = 6 + Math.floor(Math.random() * 6)
    for (let k = 0; k < drops; k++) {
      const h = { id: setTimeout(() => { if (!disposed && enabled) drip(ctx.currentTime, rpan(0.7)) }, (1 + Math.random() * 16) * 1000) }
      timers.push(h)
    }
    const hb = { id: setTimeout(() => {
      if (disposed || !enabled) return
      if (SCENES[scene].birds > 0) for (let i = 0; i < 3; i++) chirp(ctx.currentTime + i * 0.18, SCENES[scene].birds, rpan(0.6))
    }, 5000) }
    timers.push(hb)
  }

  // ============================ interaction sounds ============================
  function buzz(pattern) {
    if (enabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(pattern) } catch (_) {}
    }
  }

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

  function depart() {
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    buzz(14)
    const t0 = ctx.currentTime + 0.02
    const notes = [659.25, 523.25, 392.00]
    notes.forEach((f, i) => {
      const t = t0 + i * 0.12
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f
      const g = ctx.createGain(); g.gain.value = 0.0001
      o.connect(g).connect(outUI(0))
      const peak = 0.14 - i * 0.022
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(peak, t + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
      o.start(t); o.stop(t + 1.0)
    })
  }

  function reveal() {
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    buzz([20, 40, 20])
    const t0 = ctx.currentTime + 0.02
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => {
      const t = t0 + i * 0.10
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 1.004
      const g = ctx.createGain(); g.gain.value = 0.0001
      const dest = outUI(0)
      o.connect(g); o2.connect(g); g.connect(dest)
      const peak = 0.16 - i * 0.018
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(peak, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2)
      o.start(t); o2.start(t); o.stop(t + 1.3); o2.stop(t + 1.3)
    })
  }

  // ============================ public API ============================
  return {
    tap,
    reveal,
    depart,
    setScene(s) {
      if (s === scene) return
      scene = s
      applyScene(false)
    },
    setPhase(p) { phase = p },
    setSeason(s) { season = s },
    setWeather(w) {
      const nextCond = w ? w.condition : null
      weatherWind = w ? (w.wind || 0) : 0
      weatherIntensity = w ? (w.intensity || 0) : 0
      const wasRain = prevCond === 'rain' || prevCond === 'thunder'
      const isRain = nextCond === 'rain' || nextCond === 'thunder'
      weatherCond = nextCond
      applyWeather()
      if (wasRain && !isRain && enabled) rainClearing()
      prevCond = nextCond
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
    setMeteor(on) { meteor = !!on },
    // The Chorus: mix = { place, weather, wildlife, city, events, volume } each
    // 0..10 (10 = unity/unchanged), plus activity (0..10, 5 = neutral) and
    // warmth (0..10, 10 = today's fully-open tone). Safe to call before sound
    // has ever been enabled — see applyMix()/build()'s own call to it.
    setMix(mix) {
      const pct = (v, d = 10) => clamp01((v ?? d) / 10)
      mixPlace = pct(mix.place)
      mixWeather = pct(mix.weather)
      mixWildlife = pct(mix.wildlife)
      mixCity = pct(mix.city)
      mixEvents = pct(mix.events)
      mixVolume = pct(mix.volume)
      activityMul = ACTIVITY_MIN + pct(mix.activity, 5) * (ACTIVITY_MAX - ACTIVITY_MIN)
      warmthHz = WARMTH_MIN_HZ * Math.pow(WARMTH_MAX_HZ / WARMTH_MIN_HZ, pct(mix.warmth))
      applyMix()
    },
    setEnabled(on) {
      enabled = on
      if (on) {
        if (!ctx) build()
        this.resume()
        set(master.gain, MASTER * mixVolume, 0.6)
      } else if (ctx) {
        set(master.gain, 0, 0.4)
      }
    },
    resume() {
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
    },
    dispose() {
      disposed = true
      timers.forEach(h => clearTimeout(h.id))
      timers = []
      walkers.forEach(stop => stop())
      walkers = []
      if (ctx) ctx.close().catch(() => {})
      ctx = null
    },
  }
}
