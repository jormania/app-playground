// Procedural outdoor soundscape for Touch Grass — fully synthesised, no audio
// files. A LAYER-BLEND engine ported from Yoru (src/yoru/lib/soundscape.js):
// seven nature beds you blend freely, plus global shapers. On top of that bed
// sit a handful of Touch Grass VOICES — birds and rare omens — scheduled as
// one-shots and dialled by their own Wildlife / Omens levels and an Activity
// shaper.
//
//   layers (0 = off):
//     rain    soft high wash + sparse droplets, with distant thunder when up
//     waves   slow ocean surf, each swell a little different
//     stream  a steady brook, softly babbling
//     wind    band-passed air, slowly drifting and gusting
//     leaves  a hush through foliage + soft rustles
//     chime   a sparse wind-chime accent, now and then
//     warmth  a pink-noise floor under everything
//   shapers:
//     volume     master loudness (true silence at 0)
//     brightness one global low-pass, dark -> airy
//     motion     how MUCH it swells and gusts (depth)
//     pace       how FAST it drifts and swells (speed)
//   voices (Touch Grass, one-shots over the bed):
//     wildlife   songbirds, crickets, owl, crow, cat, dog
//     omens      a church bell, cuckoo, woodpecker, wolf, meteor-shimmer
//     activity   how often any voice speaks up
//
// LIVE architecture: the whole graph is built ONCE per "sound on" — one
// AudioContext, one pair of noise buffers, all seven beds present (silent ones
// just sit at gain 0). Every mix change then only RAMPS live parameters toward
// the new values (see applyLive + the per-bed updaters); nothing is torn down or
// rebuilt, so dragging a slider is instant and glitch-free. Only turning sound
// off/on builds or disposes the graph. The voices keep a light day/night touch
// from the world context (birds by day, owl/crickets by night, meteor-shimmer on
// shower nights). The tonal voices share a short reverb for a sense of distance.

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const lerp = (a, b, t) => a + (b - a) * t

// Loudness/tone perception is roughly logarithmic; a linear slider->gain feels
// wrong the same way every time. `taper` keeps 0 at true silence and 1 unchanged
// while spacing the middle more evenly. (Ported from Yoru.)
export const taper = (t, exp) => Math.pow(clamp01(t), exp)
const VOLUME_TAPER = 1.9
const LAYER_TAPER = 1.4

const FADE_IN_TC = 0.6 // master fade-in / volume-change time constant (~1.8s glide)
const LIVE_TC = 0.4 // default ramp for a live mix change (~1.2s glide, never sudden)
const VOICE_TRIM = 3.0 // lifts the sparse one-shot voices to sit over the bed
const REVERB_SEND = 0.2 // how much of the voices go to the shared room (subtle)

function makeWhiteBuffer(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return buf
}

// Pink noise (Paul Kellet) — warmer, more balanced bed texture than brown.
function makePinkBuffer(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.969 * b2 + w * 0.153852
    b3 = 0.8665 * b3 + w * 0.3104856
    b4 = 0.55 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.016898
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
    b6 = w * 0.115926
  }
  return buf
}

function loopSource(ctx, buffer) {
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.loop = true
  return src
}

function panner(ctx, pan) {
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner()
    p.pan.value = pan
    return p
  }
  return ctx.createGain()
}

// mix (each 0..10) -> concrete synth values. Ported from Yoru, extended with the
// Touch Grass voice categories and the Activity shaper. Exported for unit tests
// (it's pure — no audio nodes touched here).
export function resolveMix(mix) {
  const nv = (k) => clamp01((mix && typeof mix[k] === 'number' ? mix[k] : 0) / 10)
  const gv = (k) => taper(nv(k), LAYER_TAPER)
  return {
    master: taper(nv('volume'), VOLUME_TAPER) * 0.24,
    toneHz: 520 * Math.pow(8200 / 520, nv('brightness')),
    motion: lerp(0.35, 1.6, nv('motion')),
    pace: lerp(0.5, 1.9, nv('pace')),
    rain: gv('rain'),
    waves: gv('waves'),
    stream: gv('stream'),
    wind: gv('wind'),
    leaves: gv('leaves'),
    chime: gv('chime'),
    warmth: gv('warmth'),
    // voices: category loudness (0 = that voice group is silent / unscheduled)
    wildlife: gv('wildlife'),
    omens: gv('omens'),
    // activity: how often voices fire (a frequency multiplier; higher = busier)
    activity: lerp(0.4, 1.8, nv('activity')),
  }
}

export function createAmbience() {
  let mix = null
  let enabled = false
  let disposed = false
  let stereo = true // bed stereo width (a settings toggle); mono when off
  let graph = null // the single live soundscape graph (built once per "sound on")
  let world = { timeOfDay: 'day', season: 'summer', meteor: false }
  let uiCtx = null // a small persistent context for tap / depart / reveal

  // ======================================================================
  // The soundscape graph — built once, then live-tuned. `P` (resolved mix) is a
  // mutable closure variable the schedulers read directly, so a mix change never
  // requires a rebuild: applyLive() reassigns P and ramps every live node.
  // ======================================================================
  function buildGraph() {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    const ctx = new Ctx()
    ctx.resume?.().catch(() => {})
    let stopped = false
    let P = resolveMix(mix)
    let liveliness = 0.6
    const nodes = [] // oscillators/sources to stop on teardown
    const intervals = []
    const timeouts = [] // holders { id } for self-rescheduling voice timers
    const updaters = [] // (P, tc) => void — each ramps its bed's live params

    const set = (param, v, tc) => param.setTargetAtTime(v, ctx.currentTime, Math.max(0.005, tc))
    const rpan = (w) => (Math.random() * 2 - 1) * w
    const biquad = (type, freq) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; return f }

    const white = makeWhiteBuffer(ctx, 20)
    const pink = makePinkBuffer(ctx, 26)

    // a stereo exponential-decay impulse — a small room for the voices
    function makeIR(seconds, decay) {
      const len = Math.floor(ctx.sampleRate * seconds)
      const buf = ctx.createBuffer(2, len, ctx.sampleRate)
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch)
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
      }
      return buf
    }

    // ---- fixed output chain -------------------------------------------------
    const master = ctx.createGain()
    master.gain.value = 0.0001
    // a transparent brick-wall safety limiter: no extreme mix can sum past
    // 0dBFS and clip. Below threshold (inaudible) for any sane setting.
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -2
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.003
    limiter.release.value = 0.25
    master.connect(limiter)
    limiter.connect(ctx.destination)

    // one global brightness low-pass everything passes through
    const tone = biquad('lowpass', P.toneHz)
    tone.connect(master)

    // a short shared room, fed only by the voices, for a sense of distance on the
    // tonal one-shots (a bell, a wolf, a cuckoo) — the beds stay dry (reverb on
    // diffuse noise just muddies it). The wet return runs back through `tone`, so
    // the tail keeps the same brightness as everything else.
    const convolver = ctx.createConvolver()
    convolver.buffer = makeIR(1.6, 3.2)
    const reverbReturn = ctx.createGain(); reverbReturn.gain.value = 0.9
    convolver.connect(reverbReturn).connect(tone)
    const reverbSend = ctx.createGain(); reverbSend.gain.value = REVERB_SEND
    reverbSend.connect(convolver)

    // ---- voice buses (dry to tone + wet to the room) ------------------------
    const wildBus = ctx.createGain(); wildBus.gain.value = P.wildlife * VOICE_TRIM
    const omenBus = ctx.createGain(); omenBus.gain.value = P.omens * VOICE_TRIM
    ;[wildBus, omenBus].forEach((b) => { b.connect(tone); b.connect(reverbSend) })
    const buses = { wildlife: wildBus, omens: omenBus }
    function out(pan, bus) {
      const pn = panner(ctx, clamp(pan, -1, 1))
      pn.connect(bus)
      return pn
    }

    // a slow low-depth sine wobble summed onto a param — the shared "organic
    // drift" behind the beds. rate randomised so no two lock step.
    function driftParam(param, depth, rateHz) {
      const osc = ctx.createOscillator()
      osc.frequency.value = rateHz * (0.85 + Math.random() * 0.3)
      const g = ctx.createGain(); g.gain.value = depth
      osc.connect(g); g.connect(param); osc.start(); nodes.push(osc)
    }
    const driftFilter = (filter, depthHz, rateHz) => driftParam(filter.frequency, depthHz, rateHz)

    // a bed's noise source. With stereo on: a decorrelated pair — two loops of the
    // same buffer at slightly different playback rates, panned L/R — so the bed
    // reads as wide and enveloping rather than a mono point in the middle of your
    // head (the 0.7 trim compensates for the ~+3dB two incoherent sources sum to,
    // keeping the tuned level). With stereo off: a single centred mono source at
    // the same level. Toggling stereo rebuilds the graph (see setStereo).
    function stereoNoise(buffer, rate = 1, spread = 0.6) {
      if (!stereo) {
        const s = loopSource(ctx, buffer); s.playbackRate.value = rate
        s.start(0, Math.random() * buffer.duration)
        nodes.push(s)
        return s
      }
      const merge = ctx.createGain(); merge.gain.value = 0.7
      ;[[-spread, rate * 0.985], [spread, rate * 1.015]].forEach(([pan, r]) => {
        const s = loopSource(ctx, buffer); s.playbackRate.value = r
        const pn = panner(ctx, pan)
        s.connect(pn); pn.connect(merge)
        s.start(0, Math.random() * buffer.duration)
        nodes.push(s)
      })
      return merge
    }

    // ---- beds (all built once; silent ones sit at gain 0 and are live-ramped) --
    function buildWarmth() {
      const src = stereoNoise(pink, 1.0)
      const lp = biquad('lowpass', 900), hp = biquad('highpass', 95)
      const g = ctx.createGain(); g.gain.value = P.warmth * 0.85
      src.connect(lp); lp.connect(hp); hp.connect(g); g.connect(tone)
      driftFilter(lp, 60, 0.018)
      updaters.push((p, tc) => set(g.gain, p.warmth * 0.85, tc))
    }

    // a band-passed wind bed; `levelFn(P)` lets the standalone Wind and the
    // Leaves' inner hush share this builder with different level sources.
    function buildWindBed(levelFn, lpHz) {
      const wind = stereoNoise(white, 1.0, 0.7)
      const bp = biquad('bandpass', 480); bp.Q.value = 0.55
      const lp = biquad('lowpass', lpHz)
      const g = ctx.createGain(); g.gain.value = levelFn(P)
      const drift = ctx.createOscillator(); drift.frequency.value = 0.05 * P.pace
      const driftDepth = ctx.createGain(); driftDepth.gain.value = 170 * P.motion
      drift.connect(driftDepth); driftDepth.connect(bp.frequency)
      const gust = ctx.createOscillator(); gust.frequency.value = 0.07 * P.pace
      const gustDepth = ctx.createGain(); gustDepth.gain.value = levelFn(P) * 0.45 * P.motion
      gust.connect(gustDepth); gustDepth.connect(g.gain)
      wind.connect(bp); bp.connect(lp); lp.connect(g); g.connect(tone)
      drift.start(); gust.start(); nodes.push(drift, gust)
      updaters.push((p, tc) => {
        const lv = levelFn(p)
        set(g.gain, lv, tc)
        set(drift.frequency, 0.05 * p.pace, tc)
        set(driftDepth.gain, 170 * p.motion, tc)
        set(gust.frequency, 0.07 * p.pace, tc)
        set(gustDepth.gain, lv * 0.45 * p.motion, tc)
      })
    }

    function buildRain() {
      const rain = stereoNoise(white, 1.0)
      const hp = biquad('highpass', 1300), lp = biquad('lowpass', 6500)
      const g = ctx.createGain(); g.gain.value = 0.09 * P.rain
      rain.connect(hp); hp.connect(lp); lp.connect(g); g.connect(tone)
      driftFilter(lp, 900, 0.025)
      updaters.push((p, tc) => set(g.gain, 0.09 * p.rain, tc))
      let nextAt = ctx.currentTime + 0.6
      const t = setInterval(() => {
        if (stopped || P.rain <= 0) return
        const ahead = ctx.currentTime + 1.5
        while (nextAt < ahead) {
          const when = nextAt
          const src = ctx.createBufferSource(); src.buffer = white
          const bp = biquad('bandpass', 2000 + Math.random() * 2600); bp.Q.value = 1.1
          const dg = ctx.createGain(); const v = (0.02 + Math.random() * 0.03) * P.rain
          dg.gain.setValueAtTime(0.0001, when)
          dg.gain.exponentialRampToValueAtTime(v, when + 0.004)
          dg.gain.exponentialRampToValueAtTime(0.0001, when + 0.08 + Math.random() * 0.07)
          const pn = panner(ctx, Math.random() * 1.4 - 0.7)
          src.connect(bp); bp.connect(dg); dg.connect(pn); pn.connect(tone)
          src.start(when); src.stop(when + 0.3)
          nextAt += (0.22 + Math.random() * 0.7) * (1.6 - P.rain) / P.pace
        }
      }, 400)
      intervals.push(t)
    }

    // distant thunder while it rains — scaled to how heavy the rain is. Fires
    // only when Rain is up (this is where the kept "thunder" voice lives).
    function buildThunder() {
      let nextAt = ctx.currentTime + 25 + Math.random() * 50
      const t = setInterval(() => {
        if (stopped || P.rain <= 0 || ctx.currentTime < nextAt) return
        const when = nextAt
        const dur = 3.2 + Math.random() * 2.4
        const src = ctx.createBufferSource(); src.buffer = white
        const hp = biquad('highpass', 28)
        const lp = biquad('lowpass', 130 + Math.random() * 90)
        const g = ctx.createGain(); const peak = (0.05 + Math.random() * 0.04) * P.rain
        g.gain.setValueAtTime(0.0001, when)
        g.gain.exponentialRampToValueAtTime(peak, when + 0.8 + Math.random() * 0.6)
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
        const pn = panner(ctx, Math.random() * 1.6 - 0.8)
        src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(pn); pn.connect(tone)
        src.start(when); src.stop(when + dur + 0.2)
        driftFilter(lp, 40, 0.7 + Math.random() * 0.5)
        nextAt = when + (260 + Math.random() * 340) / (0.55 + 0.45 * P.rain)
      }, 4000)
      intervals.push(t)
    }

    // waves: the swell SHAPE (envG, driven by motion/pace) is separated from the
    // loudness (levelG = Waves level), so the Waves slider ramps live instead of
    // waiting out the pre-scheduled swells.
    function buildWaves() {
      const src = stereoNoise(white, 1.0)
      const hp = biquad('highpass', 160), lp = biquad('lowpass', 500)
      const envG = ctx.createGain(); envG.gain.value = 0.03
      const levelG = ctx.createGain(); levelG.gain.value = P.waves
      src.connect(hp); hp.connect(lp); lp.connect(envG); envG.connect(levelG); levelG.connect(tone)
      updaters.push((p, tc) => set(levelG.gain, p.waves, tc))
      const trough = 0.03
      let nextAt = ctx.currentTime + 0.8
      envG.gain.setValueAtTime(trough, nextAt)
      lp.frequency.setValueAtTime(340, nextAt)
      const t = setInterval(() => {
        if (stopped) return
        const ahead = ctx.currentTime + 5 // short look-ahead so the slider stays live
        while (nextAt < ahead) {
          const period = (9 + Math.random() * 5) / P.pace
          const crest = nextAt + period * 0.42
          const end = nextAt + period
          const peak = (0.5 + Math.random() * 0.28) * P.motion
          envG.gain.setValueAtTime(trough, nextAt)
          envG.gain.linearRampToValueAtTime(peak, crest)
          envG.gain.exponentialRampToValueAtTime(Math.max(0.0002, trough), end)
          lp.frequency.setValueAtTime(340, nextAt)
          lp.frequency.linearRampToValueAtTime(900 + Math.random() * 500, crest)
          lp.frequency.exponentialRampToValueAtTime(320, end)
          nextAt = end
        }
      }, 1000)
      intervals.push(t)
    }

    function buildStream() {
      const src = stereoNoise(white, 1.0)
      const bp = biquad('bandpass', 1600); bp.Q.value = 0.6
      const g = ctx.createGain(); g.gain.value = 0.05 * P.stream
      src.connect(bp); bp.connect(g); g.connect(tone)
      const drift = ctx.createOscillator(); drift.frequency.value = 0.04 * P.pace
      const driftDepth = ctx.createGain(); driftDepth.gain.value = 220 * P.motion
      drift.connect(driftDepth); driftDepth.connect(bp.frequency); drift.start(); nodes.push(drift)
      updaters.push((p, tc) => {
        set(g.gain, 0.05 * p.stream, tc)
        set(drift.frequency, 0.04 * p.pace, tc)
        set(driftDepth.gain, 220 * p.motion, tc)
      })
      let nextAt = ctx.currentTime + 0.3
      const t = setInterval(() => {
        if (stopped || P.stream <= 0) return
        const ahead = ctx.currentTime + 1.2
        const busier = 1.5 - 0.6 * P.stream
        while (nextAt < ahead) {
          const when = nextAt
          const bubble = ctx.createBufferSource(); bubble.buffer = white
          const bbp = biquad('bandpass', 1800 + Math.random() * 2200); bbp.Q.value = 2.2
          const dg = ctx.createGain(); const v = (0.015 + Math.random() * 0.02) * P.stream
          dg.gain.setValueAtTime(0.0001, when)
          dg.gain.exponentialRampToValueAtTime(v, when + 0.006)
          dg.gain.exponentialRampToValueAtTime(0.0001, when + 0.05 + Math.random() * 0.05)
          const pn = panner(ctx, Math.random() * 1.6 - 0.8)
          bubble.connect(bbp); bbp.connect(dg); dg.connect(pn); pn.connect(tone)
          bubble.start(when); bubble.stop(when + 0.2)
          nextAt += (0.03 + Math.random() * 0.09) * busier / P.pace
        }
      }, 250)
      intervals.push(t)
    }

    function buildLeaves() {
      buildWindBed((p) => 0.5 * p.leaves, 1100)
      let nextAt = ctx.currentTime + 2
      const t = setInterval(() => {
        if (stopped || P.leaves <= 0) return
        const ahead = ctx.currentTime + 4
        while (nextAt < ahead) {
          const when = nextAt
          const src = ctx.createBufferSource(); src.buffer = white
          const bp = biquad('bandpass', 1400 + Math.random() * 1400); bp.Q.value = 0.8
          const g = ctx.createGain(); const v = (0.02 + Math.random() * 0.025) * P.leaves * P.motion
          const dur = 0.7 + Math.random() * 1.1
          g.gain.setValueAtTime(0.0001, when)
          g.gain.linearRampToValueAtTime(v, when + dur * 0.4)
          g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
          const pn = panner(ctx, Math.random() * 1.4 - 0.7)
          src.connect(bp); bp.connect(g); g.connect(pn); pn.connect(tone)
          src.start(when); src.stop(when + dur + 0.1)
          nextAt += (2.5 + Math.random() * 4) / P.pace
        }
      }, 700)
      intervals.push(t)
    }

    const CHIME_NOTES = [587.33, 659.25, 698.46, 783.99, 880.0, 987.77]
    function buildChime() {
      let nextAt = ctx.currentTime + 6 + Math.random() * 8
      const t = setInterval(() => {
        if (stopped || P.chime <= 0) return
        const ahead = ctx.currentTime + 6
        const busier = 1.6 - 0.7 * P.chime
        while (nextAt < ahead) {
          const when = nextAt
          const f = CHIME_NOTES[(Math.random() * CHIME_NOTES.length) | 0]
          const g = ctx.createGain(); const v = (0.05 + Math.random() * 0.03) * P.chime
          g.gain.setValueAtTime(0.0001, when)
          g.gain.exponentialRampToValueAtTime(v, when + 0.015)
          g.gain.exponentialRampToValueAtTime(0.0001, when + 2.2 + Math.random() * 1.2)
          const pn = panner(ctx, Math.random() * 1.4 - 0.7)
          g.connect(pn); pn.connect(tone)
          const osc1 = ctx.createOscillator(); osc1.type = 'sine'; osc1.frequency.value = f
          osc1.connect(g); osc1.start(when); osc1.stop(when + 3.6)
          const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = f * 2.76
          const g2 = ctx.createGain(); g2.gain.value = 0.3
          osc2.connect(g2); g2.connect(g); osc2.start(when); osc2.stop(when + 3.6)
          nextAt += (8 + Math.random() * 17) * busier / P.pace
        }
      }, 3000)
      intervals.push(t)
    }

    // ---- voices (one-shots; route to the buses, which are live-gained) -------
    function chirp(t, pan) {
      const o = ctx.createOscillator(); o.type = 'sine'
      const g = ctx.createGain(); g.gain.value = 0.0001
      o.connect(g).connect(out(pan, buses.wildlife))
      const base = 1900 + Math.random() * 1900
      o.frequency.setValueAtTime(base, t)
      o.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.06)
      o.frequency.exponentialRampToValueAtTime(base * 0.85, t + 0.16)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.12, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
      o.start(t); o.stop(t + 0.26)
    }
    function cricketTrill(t, pan) {
      const o = ctx.createOscillator(); o.type = 'triangle'
      o.frequency.value = 4200 + Math.random() * 700
      const g = ctx.createGain(); g.gain.value = 0.0001
      o.connect(g).connect(out(pan, buses.wildlife))
      const pulses = 3 + Math.floor(Math.random() * 4)
      let tt = t
      for (let k = 0; k < pulses; k++) {
        g.gain.setValueAtTime(0.0001, tt)
        g.gain.linearRampToValueAtTime(0.06, tt + 0.008)
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.05)
        tt += 0.058 + Math.random() * 0.02
      }
      o.start(t); o.stop(tt + 0.1)
    }
    function owl(t, pan) {
      const base = 320 + Math.random() * 60
      const dest = out(pan, buses.wildlife)
      ;[0, 0.5].forEach((dt, idx) => {
        const tt = t + dt
        const o = ctx.createOscillator(); o.type = 'sine'
        const g = ctx.createGain(); g.gain.value = 0.0001
        o.connect(g).connect(dest)
        o.frequency.setValueAtTime(base * (idx ? 1.05 : 1), tt)
        o.frequency.linearRampToValueAtTime(base * 0.92, tt + 0.3)
        g.gain.setValueAtTime(0.0001, tt)
        g.gain.linearRampToValueAtTime(0.06, tt + 0.05)
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.42)
        o.start(tt); o.stop(tt + 0.5)
      })
    }
    function crow(t, pan) {
      const dest = out(pan, buses.wildlife)
      const reps = 1 + Math.floor(Math.random() * 3)
      for (let k = 0; k < reps; k++) {
        const tt = t + k * (0.28 + Math.random() * 0.12)
        const o = ctx.createOscillator(); o.type = 'sawtooth'
        const bp = biquad('bandpass', 1200); bp.Q.value = 3
        const g = ctx.createGain(); g.gain.value = 0.0001
        o.connect(bp).connect(g).connect(dest)
        const f = 700 + Math.random() * 180
        o.frequency.setValueAtTime(f, tt)
        o.frequency.linearRampToValueAtTime(f * 0.7, tt + 0.18)
        g.gain.setValueAtTime(0.0001, tt)
        g.gain.linearRampToValueAtTime(0.05, tt + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.2)
        o.start(tt); o.stop(tt + 0.24)
      }
    }
    function meow(t, pan) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'
      const bp = biquad('bandpass', 1000); bp.Q.value = 4
      const g = ctx.createGain(); g.gain.value = 0.0001
      o.connect(bp).connect(g).connect(out(pan, buses.wildlife))
      o.frequency.setValueAtTime(520, t)
      o.frequency.linearRampToValueAtTime(840, t + 0.18)
      o.frequency.linearRampToValueAtTime(660, t + 0.4)
      o.frequency.linearRampToValueAtTime(430, t + 0.6)
      bp.frequency.setValueAtTime(900, t)
      bp.frequency.linearRampToValueAtTime(1500, t + 0.2)
      bp.frequency.linearRampToValueAtTime(700, t + 0.6)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.09, t + 0.06)
      g.gain.setValueAtTime(0.09, t + 0.4)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.66)
      o.start(t); o.stop(t + 0.7)
    }
    function woof(t, level, dest) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'
      o.frequency.setValueAtTime(260, t)
      o.frequency.exponentialRampToValueAtTime(150, t + 0.12)
      const lp = biquad('lowpass', 850)
      const g = ctx.createGain(); g.gain.value = 0.0001
      o.connect(lp).connect(g).connect(dest)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.1 * level, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
      o.start(t); o.stop(t + 0.2)
    }
    function dog(t, pan) {
      const dest = out(pan, buses.wildlife)
      woof(t, 1, dest)
      if (Math.random() < 0.6) woof(t + 0.24 + Math.random() * 0.12, 0.9, dest)
    }
    function bell(t) {
      const strikes = 1 + Math.floor(Math.random() * 2)
      const root = 330
      const pan = rpan(0.3)
      for (let k = 0; k < strikes; k++) {
        const tt = t + k * 1.6
        const dest = out(pan, buses.omens)
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
      const dest = out(rpan(0.5), buses.omens)
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
      const dest = out(rpan(0.6), buses.omens)
      const reps = 6 + Math.floor(Math.random() * 6)
      for (let k = 0; k < reps; k++) {
        const tt = t + k * 0.04
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 180
        const bp = biquad('bandpass', 1800); bp.Q.value = 2
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
      const lp = biquad('lowpass', 1200)
      const g = ctx.createGain(); g.gain.value = 0.0001
      o.connect(lp).connect(g).connect(out(rpan(0.5), buses.omens))
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
    function meteorShimmer(t) {
      const dest = out(rpan(0.6), buses.omens)
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

    // ---- voice scheduling (self-gating on the live level + world) -----------
    const running = () => !stopped && ctx.state === 'running'
    const isDay = () => world.timeOfDay === 'day' || world.timeOfDay === 'dawn'
    const isNight = () => world.timeOfDay === 'night' || world.timeOfDay === 'dusk'
    const chance = (prob) => Math.random() < prob * liveliness
    // how much the weather masks the voices — birds and omens hush under rain and
    // strong wind (rain masks more than wind). A gentle duck, never a full gate.
    const coverAmt = () => clamp01(0.85 * P.rain + 0.5 * P.wind)
    const wildChance = (prob) => chance(prob * (1 - 0.6 * coverAmt()))
    function every(minMs, maxMs, fn) {
      const h = { id: 0 }
      const tick = () => {
        if (stopped) return
        fn()
        h.id = setTimeout(tick, (minMs + Math.random() * (maxMs - minMs)) / P.activity)
      }
      h.id = setTimeout(tick, (minMs + Math.random() * (maxMs - minMs)) / P.activity)
      timeouts.push(h)
    }
    function startLiveliness() {
      const h = { id: 0 }
      const tick = () => {
        if (stopped) return
        const target = 0.35 + Math.random() * 0.65
        liveliness = clamp(liveliness + (target - liveliness) * 0.4, 0.3, 1)
        h.id = setTimeout(tick, 6000 + Math.random() * 7000)
      }
      h.id = setTimeout(tick, 4000)
      timeouts.push(h)
    }

    // wildlife
    every(3200, 8000, () => {
      if (!running() || P.wildlife <= 0 || !isDay() || !wildChance(0.9)) return
      const burst = 1 + Math.floor(Math.random() * (world.timeOfDay === 'dawn' ? 3 : 2))
      for (let i = 0; i < burst; i++) chirp(ctx.currentTime + i * 0.16 + Math.random() * 0.08, rpan(0.6))
    })
    every(11000, 24000, () => { if (running() && P.wildlife > 0 && isDay() && wildChance(0.7)) crow(ctx.currentTime, rpan(0.6)) })
    every(3200, 8000, () => {
      if (!running() || P.wildlife <= 0 || !isNight() || !wildChance(0.9)) return
      cricketTrill(ctx.currentTime, rpan(0.7))
      if (Math.random() < 0.4) cricketTrill(ctx.currentTime + 0.2 + Math.random() * 0.4, rpan(0.7))
    })
    every(26000, 56000, () => { if (running() && P.wildlife > 0 && isNight() && wildChance(0.7)) owl(ctx.currentTime, rpan(0.5)) })
    // cat and dog are near-people sounds, kept rare and widely spaced so they read
    // as a distant "somewhere out there", never a metronome
    every(55000, 130000, () => { if (running() && P.wildlife > 0 && wildChance(0.6)) meow(ctx.currentTime, rpan(0.7)) })
    every(64000, 150000, () => { if (running() && P.wildlife > 0 && wildChance(0.6)) dog(ctx.currentTime, rpan(0.7)) })

    // omens — rare surprises, on a cooldown, low probability
    let lastOmen = -1e9
    let lastBellHour = -1
    every(45000, 95000, () => {
      if (!running() || P.omens <= 0 || ctx.currentTime - lastOmen < 25) return
      const opts = []
      const now = new Date()
      if (now.getMinutes() < 2 && now.getHours() !== lastBellHour) opts.push('bell')
      if (isDay()) opts.push('woodpecker')
      if (isDay() && world.season === 'spring') opts.push('cuckoo')
      if (isNight()) opts.push('wolf')
      if (world.meteor && isNight()) opts.push('meteor')
      if (!opts.length) return
      if (Math.random() > 0.5 * liveliness + 0.15) return
      const pick = opts[Math.floor(Math.random() * opts.length)]
      const t = ctx.currentTime + 0.05
      if (pick === 'bell') { bell(t); lastBellHour = now.getHours() }
      else if (pick === 'woodpecker') woodpecker(t)
      else if (pick === 'cuckoo') cuckoo(t)
      else if (pick === 'wolf') wolf(t)
      else if (pick === 'meteor') meteorShimmer(t)
      lastOmen = ctx.currentTime
    })

    // ---- assemble + fade in -------------------------------------------------
    buildWarmth()
    buildWindBed((p) => 0.34 * p.wind, 900)
    buildRain(); buildThunder()
    buildWaves(); buildStream(); buildLeaves(); buildChime()
    startLiveliness()

    // the master fades up to P.master via applyLive's own ramp (from 0.0001)
    function applyLive(np, tc = LIVE_TC) {
      P = np
      // voices also recede in volume as the weather rises (fewer of them fire via
      // wildChance; here they sit quieter too) — omens carry a little more than birds
      const cv = coverAmt()
      set(master.gain, enabled ? P.master : 0, FADE_IN_TC)
      set(tone.frequency, P.toneHz, tc)
      set(wildBus.gain, P.wildlife * VOICE_TRIM * (1 - 0.55 * cv), tc)
      set(omenBus.gain, P.omens * VOICE_TRIM * (1 - 0.3 * cv), tc)
      for (const u of updaters) u(P, tc)
    }
    applyLive(P) // establishes every param + fades the master in from silence

    function stop(release = 0.6) {
      if (stopped) return
      stopped = true
      intervals.forEach(clearInterval)
      timeouts.forEach((h) => clearTimeout(h.id))
      const now = ctx.currentTime
      try {
        master.gain.cancelScheduledValues(now)
        master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now)
        master.gain.setTargetAtTime(0.0001, now, release / 3)
        master.gain.exponentialRampToValueAtTime(0.0001, now + release)
      } catch (_) {}
      setTimeout(() => {
        nodes.forEach((n) => { try { n.stop?.() } catch (_) {} })
        ctx.close?.().catch(() => {})
      }, release * 1000 + 250)
    }

    return {
      applyLive,
      stop,
      resume() { if (ctx.state === 'suspended') ctx.resume().catch(() => {}) },
    }
  }

  // ======================================================================
  // interaction sounds (tap / depart / reveal) — their own tiny persistent
  // context, so they never depend on the soundscape graph's state
  // ======================================================================
  function buzz(pattern) {
    if (enabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(pattern) } catch (_) {}
    }
  }
  function ensureUi() {
    if (uiCtx) return uiCtx
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    uiCtx = new Ctx()
    return uiCtx
  }
  function uiTone(freqs, dur, peakStart, glide) {
    const c = ensureUi()
    if (!c) return
    if (c.state === 'suspended') c.resume().catch(() => {})
    const t0 = c.currentTime + 0.02
    freqs.forEach((f, i) => {
      const t = t0 + i * glide
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f
      const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 1.004
      const g = c.createGain(); g.gain.value = 0.0001
      o.connect(g); o2.connect(g); g.connect(c.destination)
      const peak = Math.max(0.02, peakStart - i * 0.02)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(peak, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1)
    })
  }

  return {
    // The Chorus: mix is the full model from mix.js (each key 0..10). A live
    // change just ramps the graph's params — no teardown, no rebuild. Safe to
    // call before sound is enabled — the value is held and applied on enable.
    setMix(m) {
      if (disposed) return
      mix = m
      if (graph) graph.applyLive(resolveMix(m))
    },
    // world context for the light day/night gating of the voices — the running
    // schedulers read it live, so it never touches the graph.
    setWorld(w) {
      if (disposed) return
      world = { ...world, ...w }
    },
    setEnabled(on) {
      if (disposed || on === enabled) return
      enabled = on
      if (on) { if (!graph) graph = buildGraph() }
      else if (graph) { graph.stop(0.6); graph = null }
    },
    // bed stereo width on/off. A structural change (mono source vs L/R pair), so
    // unlike a mix slider it rebuilds the graph — but it's a rare, deliberate
    // toggle, and the new graph crossfades in under the old, so it never cuts.
    setStereo(on) {
      if (disposed || on === stereo) return
      stereo = on
      if (enabled && graph) {
        const old = graph
        graph = buildGraph()
        old.stop(0.6)
      }
    },
    tap() {
      buzz(10)
      const c = ensureUi()
      if (!c || !enabled) return
      if (c.state === 'suspended') c.resume().catch(() => {})
      const t = c.currentTime + 0.01
      const o = c.createOscillator(); o.type = 'sine'
      const g = c.createGain(); g.gain.value = 0.0001
      o.connect(g).connect(c.destination)
      o.frequency.setValueAtTime(660, t)
      o.frequency.exponentialRampToValueAtTime(330, t + 0.06)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.16, t + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
      o.start(t); o.stop(t + 0.12)
    },
    depart() {
      buzz(14)
      uiTone([659.25, 523.25, 392.0], 0.9, 0.14, 0.12)
    },
    reveal() {
      buzz([20, 40, 20])
      uiTone([523.25, 659.25, 783.99, 1046.5], 1.2, 0.16, 0.1)
    },
    resume() {
      graph?.resume()
      if (uiCtx && uiCtx.state === 'suspended') uiCtx.resume().catch(() => {})
    },
    dispose() {
      disposed = true
      if (graph) { graph.stop(0.5); graph = null }
      if (uiCtx) { uiCtx.close?.().catch(() => {}); uiCtx = null }
    },
  }
}
