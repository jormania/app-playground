// Procedural outdoor soundscape for Touch Grass — fully synthesised, no audio
// files. A LAYER-BLEND engine ported from Yoru (src/yoru/lib/soundscape.js):
// eight nature beds you blend freely, plus four global shapers. On top of that
// bed sit a handful of Touch Grass VOICES — birds, city sounds, and rare omens —
// scheduled as one-shots and dialled by their own Wildlife / City / Omens levels
// and a global Activity shaper.
//
//   layers (0 = off):
//     rain    soft high wash + sparse droplets, with distant thunder when up
//     waves   slow ocean surf, each swell a little different
//     stream  a steady brook, softly babbling
//     wind    band-passed air, slowly drifting and gusting
//     leaves  a hush through foliage + soft rustles
//     chime   a sparse wind-chime accent, now and then
//     warmth  a pink-noise floor under everything
//     drone   a deep, soft tonal hum
//   shapers:
//     volume     master loudness (true silence at 0)
//     brightness one global low-pass, dark -> airy
//     motion     how MUCH it swells and gusts (depth)
//     pace       how FAST it drifts and swells (speed)
//   voices (Touch Grass, one-shots over the bed):
//     wildlife   songbirds, crickets, owl, crow, cat, dog
//     city       a passing car, a bicycle bell, an airplane overhead
//     omens      a church bell, cuckoo, woodpecker, wolf, meteor-shimmer
//     activity   how often any voice speaks up
//
// The bed is not world-driven — it's the user's own mix (the Chorus). The voices
// keep a light touch of day/night appropriateness (birds by day, owl/crickets by
// night, a meteor-shimmer only on shower nights) from the world context.

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const lerp = (a, b, t) => a + (b - a) * t

// Loudness/tone perception is roughly logarithmic; a linear slider->gain feels
// wrong the same way every time. `taper` keeps 0 at true silence and 1 unchanged
// while spacing the middle more evenly. Master gets the steeper curve (a real
// volume knob); each layer's own level a gentler one so blended presets keep
// their balance. (Both ported straight from Yoru.)
const taper = (t, exp) => Math.pow(clamp01(t), exp)
const VOLUME_TAPER = 1.9
const LAYER_TAPER = 1.4

const FADE_IN_SEC = 1.4 // Touch Grass isn't a timed session — a gentle fade on (re)build, then hold; long enough that switching scenes crossfades rather than cuts
// the voices ride a category bus into the same brightness filter as the beds;
// this trim lifts them to sit just over the bed at a mid category level (they're
// quieter than the beds per-sample, being sparse one-shots)
const VOICE_TRIM = 3.0

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
// three Touch Grass voice categories and the Activity shaper.
function resolveMix(mix) {
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
    drone: gv('drone'),
    // voices: category loudness (0 = that voice group is silent / unscheduled)
    wildlife: gv('wildlife'),
    city: gv('city'),
    omens: gv('omens'),
    // activity: how often voices fire (a frequency multiplier; higher = busier)
    activity: lerp(0.4, 1.8, nv('activity')),
  }
}

export function createAmbience() {
  // ---- facade state (persists across soundscape rebuilds) ----
  let mix = null
  let enabled = false
  let disposed = false
  let scape = null // the live soundscape graph (rebuilt on mix change)
  let rebuildTimer = null
  let world = { timeOfDay: 'day', season: 'summer', meteor: false }
  let uiCtx = null // a small persistent context for tap / depart / reveal

  // ======================================================================
  // The soundscape graph. Built fresh from the current `mix`; disposed with a
  // gentle fade. Voices read `world` live (via closure) so a change of day/night
  // never needs a rebuild — only a mix change does.
  // ======================================================================
  function buildScape() {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    const p = resolveMix(mix)
    if (p.master <= 0) return null

    const ctx = new Ctx()
    ctx.resume?.().catch(() => {})
    let stopped = false
    const nodes = []
    const intervals = []
    const timeouts = [] // holders { id } for self-rescheduling voice timers
    let liveliness = 0.6

    const master = ctx.createGain()
    master.gain.value = 0.0001
    master.connect(ctx.destination)

    // one global brightness low-pass everything passes through
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = p.toneHz
    tone.connect(master)

    const white = makeWhiteBuffer(ctx, 20)
    const pink = makePinkBuffer(ctx, 26)

    // a slow low-depth sine wobble summed onto a param's own value — the shared
    // "organic drift" behind every bed. rate randomised so layers never lock step.
    function driftParam(param, depth, rateHz) {
      const osc = ctx.createOscillator()
      osc.frequency.value = rateHz * (0.85 + Math.random() * 0.3)
      const g = ctx.createGain()
      g.gain.value = depth
      osc.connect(g)
      g.connect(param)
      osc.start()
      nodes.push(osc)
    }
    const driftFilter = (filter, depthHz, rateHz) => driftParam(filter.frequency, depthHz, rateHz)
    const driftGain = (gainNode, depth, rateHz) => driftParam(gainNode.gain, depth, rateHz)

    // ---- beds (ported from Yoru) --------------------------------------------
    function buildWarmth(level, dest) {
      const src = loopSource(ctx, pink)
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 95
      const g = ctx.createGain(); g.gain.value = level * 0.85
      src.connect(lp); lp.connect(hp); hp.connect(g); g.connect(dest)
      src.start(); nodes.push(src)
      driftFilter(lp, 60, 0.018)
    }

    function buildDrone(level, dest) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 110
      const g = ctx.createGain(); g.gain.value = level * 0.032
      hp.connect(lp); lp.connect(g); g.connect(dest)
      ;[110, 164.81].forEach((f, i) => {
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = f
        osc.detune.value = i === 0 ? -1.5 : 1.5
        osc.connect(hp); osc.start(); nodes.push(osc)
      })
      driftGain(g, level * 0.006, 0.011)
    }

    function buildWind(level, lpHz, motion, pace, dest) {
      const wind = loopSource(ctx, white)
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 0.55
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = lpHz
      const g = ctx.createGain(); g.gain.value = level
      const drift = ctx.createOscillator(); drift.frequency.value = 0.05 * pace
      const driftDepth = ctx.createGain(); driftDepth.gain.value = 170 * motion
      drift.connect(driftDepth); driftDepth.connect(bp.frequency)
      const gust = ctx.createOscillator(); gust.frequency.value = 0.07 * pace
      const gustDepth = ctx.createGain(); gustDepth.gain.value = level * 0.45 * motion
      gust.connect(gustDepth); gustDepth.connect(g.gain)
      wind.connect(bp); bp.connect(lp); lp.connect(g); g.connect(dest)
      wind.start(); drift.start(); gust.start(); nodes.push(wind, drift, gust)
    }

    function buildRain(level, pace, dest) {
      const rain = loopSource(ctx, white)
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1300
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500
      const g = ctx.createGain(); g.gain.value = 0.09 * level
      rain.connect(hp); hp.connect(lp); lp.connect(g); g.connect(dest)
      rain.start(); nodes.push(rain)
      driftFilter(lp, 900, 0.025)
      let nextAt = ctx.currentTime + 0.6
      const t = setInterval(() => {
        if (stopped) return
        const ahead = ctx.currentTime + 1.5
        while (nextAt < ahead) {
          const when = nextAt
          const src = ctx.createBufferSource(); src.buffer = white
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2000 + Math.random() * 2600; bp.Q.value = 1.1
          const dg = ctx.createGain(); const v = (0.02 + Math.random() * 0.03) * level
          dg.gain.setValueAtTime(0.0001, when)
          dg.gain.exponentialRampToValueAtTime(v, when + 0.004)
          dg.gain.exponentialRampToValueAtTime(0.0001, when + 0.08 + Math.random() * 0.07)
          const pn = panner(ctx, Math.random() * 1.4 - 0.7)
          src.connect(bp); bp.connect(dg); dg.connect(pn); pn.connect(dest)
          src.start(when); src.stop(when + 0.3)
          nextAt += (0.22 + Math.random() * 0.7) * (1.6 - level) / pace
        }
      }, 400)
      intervals.push(t)
    }

    // distant thunder, rare, only while it rains — scaled to how heavy the rain
    // is (this is where the kept "thunder" voice lives: turning up Rain brings it)
    function buildThunder(level, dest) {
      let nextAt = ctx.currentTime + 25 + Math.random() * 50
      const t = setInterval(() => {
        if (stopped || ctx.currentTime < nextAt) return
        const when = nextAt
        const dur = 3.2 + Math.random() * 2.4
        const src = ctx.createBufferSource(); src.buffer = white
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 28
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 130 + Math.random() * 90
        const g = ctx.createGain(); const peak = (0.05 + Math.random() * 0.04) * level
        g.gain.setValueAtTime(0.0001, when)
        g.gain.exponentialRampToValueAtTime(peak, when + 0.8 + Math.random() * 0.6)
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
        const pn = panner(ctx, Math.random() * 1.6 - 0.8)
        src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(pn); pn.connect(dest)
        src.start(when); src.stop(when + dur + 0.2)
        driftFilter(lp, 40, 0.7 + Math.random() * 0.5)
        nextAt = when + (260 + Math.random() * 340) / (0.55 + 0.45 * level)
      }, 4000)
      intervals.push(t)
    }

    function buildWaves(level, motion, pace, dest) {
      const src = loopSource(ctx, white)
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 160
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500
      const g = ctx.createGain(); const trough = 0.03 * level; g.gain.value = trough
      src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(dest)
      src.start(); nodes.push(src)
      let nextAt = ctx.currentTime + 0.8
      g.gain.setValueAtTime(trough, nextAt)
      lp.frequency.setValueAtTime(340, nextAt)
      const t = setInterval(() => {
        if (stopped) return
        const ahead = ctx.currentTime + 12
        while (nextAt < ahead) {
          const period = (9 + Math.random() * 5) / pace
          const crest = nextAt + period * 0.42
          const end = nextAt + period
          const peak = (0.5 + Math.random() * 0.28) * level * motion
          g.gain.setValueAtTime(trough, nextAt)
          g.gain.linearRampToValueAtTime(peak, crest)
          g.gain.exponentialRampToValueAtTime(Math.max(0.0002, trough), end)
          lp.frequency.setValueAtTime(340, nextAt)
          lp.frequency.linearRampToValueAtTime(900 + Math.random() * 500, crest)
          lp.frequency.exponentialRampToValueAtTime(320, end)
          nextAt = end
        }
      }, 1000)
      intervals.push(t)
    }

    function buildLeaves(level, motion, pace, dest) {
      buildWind(level * 0.5, 1100, motion, pace, dest)
      let nextAt = ctx.currentTime + 2
      const t = setInterval(() => {
        if (stopped) return
        const ahead = ctx.currentTime + 4
        while (nextAt < ahead) {
          const when = nextAt
          const src = ctx.createBufferSource(); src.buffer = white
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400 + Math.random() * 1400; bp.Q.value = 0.8
          const g = ctx.createGain(); const v = (0.02 + Math.random() * 0.025) * level * motion
          const dur = 0.7 + Math.random() * 1.1
          g.gain.setValueAtTime(0.0001, when)
          g.gain.linearRampToValueAtTime(v, when + dur * 0.4)
          g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
          const pn = panner(ctx, Math.random() * 1.4 - 0.7)
          src.connect(bp); bp.connect(g); g.connect(pn); pn.connect(dest)
          src.start(when); src.stop(when + dur + 0.1)
          nextAt += (2.5 + Math.random() * 4) / pace
        }
      }, 700)
      intervals.push(t)
    }

    function buildStream(level, motion, pace, dest) {
      const src = loopSource(ctx, white)
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 0.6
      const g = ctx.createGain(); g.gain.value = 0.05 * level
      src.connect(bp); bp.connect(g); g.connect(dest)
      src.start(); nodes.push(src)
      const drift = ctx.createOscillator(); drift.frequency.value = 0.04 * pace
      const driftDepth = ctx.createGain(); driftDepth.gain.value = 220 * motion
      drift.connect(driftDepth); driftDepth.connect(bp.frequency); drift.start(); nodes.push(drift)
      const busier = 1.5 - 0.6 * level
      let nextAt = ctx.currentTime + 0.3
      const t = setInterval(() => {
        if (stopped) return
        const ahead = ctx.currentTime + 1.2
        while (nextAt < ahead) {
          const when = nextAt
          const bubble = ctx.createBufferSource(); bubble.buffer = white
          const bbp = ctx.createBiquadFilter(); bbp.type = 'bandpass'; bbp.frequency.value = 1800 + Math.random() * 2200; bbp.Q.value = 2.2
          const dg = ctx.createGain(); const v = (0.015 + Math.random() * 0.02) * level
          dg.gain.setValueAtTime(0.0001, when)
          dg.gain.exponentialRampToValueAtTime(v, when + 0.006)
          dg.gain.exponentialRampToValueAtTime(0.0001, when + 0.05 + Math.random() * 0.05)
          const pn = panner(ctx, Math.random() * 1.6 - 0.8)
          bubble.connect(bbp); bbp.connect(dg); dg.connect(pn); pn.connect(dest)
          bubble.start(when); bubble.stop(when + 0.2)
          nextAt += (0.03 + Math.random() * 0.09) * busier / pace
        }
      }, 250)
      intervals.push(t)
    }

    const CHIME_NOTES = [587.33, 659.25, 698.46, 783.99, 880.0, 987.77]
    function buildChime(level, pace, dest) {
      const busier = 1.6 - 0.7 * level
      let nextAt = ctx.currentTime + 6 + Math.random() * 8
      const t = setInterval(() => {
        if (stopped) return
        const ahead = ctx.currentTime + 6
        while (nextAt < ahead) {
          const when = nextAt
          const f = CHIME_NOTES[(Math.random() * CHIME_NOTES.length) | 0]
          const g = ctx.createGain(); const v = (0.05 + Math.random() * 0.03) * level
          g.gain.setValueAtTime(0.0001, when)
          g.gain.exponentialRampToValueAtTime(v, when + 0.015)
          g.gain.exponentialRampToValueAtTime(0.0001, when + 2.2 + Math.random() * 1.2)
          const pn = panner(ctx, Math.random() * 1.4 - 0.7)
          g.connect(pn); pn.connect(dest)
          const osc1 = ctx.createOscillator(); osc1.type = 'sine'; osc1.frequency.value = f
          osc1.connect(g); osc1.start(when); osc1.stop(when + 3.6)
          const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = f * 2.76
          const g2 = ctx.createGain(); g2.gain.value = 0.3
          osc2.connect(g2); g2.connect(g); osc2.start(when); osc2.stop(when + 3.6)
          nextAt += (8 + Math.random() * 17) * busier / pace
        }
      }, 3000)
      intervals.push(t)
    }

    // ---- voice buses (Touch Grass one-shots ride these into the brightness LP) --
    const rpan = (w) => (Math.random() * 2 - 1) * w
    const mkBus = (level) => {
      if (level <= 0) return null
      const g = ctx.createGain(); g.gain.value = level * VOICE_TRIM; g.connect(tone); return g
    }
    const buses = { wildlife: mkBus(p.wildlife), city: mkBus(p.city), omens: mkBus(p.omens) }
    function out(pan, bus) {
      const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain()
      if (pn.pan) pn.pan.value = clamp(pan, -1, 1)
      pn.connect(bus)
      return pn
    }

    // ---- voices (ported from the old engine, biome coupling removed) ---------
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
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 3
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
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1000; bp.Q.value = 4
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
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 850
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
    function carPass(t) {
      const dur = 5 + Math.random() * 2.5
      const dest = out(-0.85, buses.city)
      if (dest.pan) { dest.pan.setValueAtTime(-0.85, t); dest.pan.linearRampToValueAtTime(0.85, t + dur) }
      const s = ctx.createBufferSource(); s.buffer = white; s.loop = true; s.playbackRate.value = 0.9
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380
      const g = ctx.createGain(); g.gain.value = 0.0001
      s.connect(lp).connect(g).connect(dest)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.03, t + dur * 0.5)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      s.start(t, Math.random() * white.duration); s.stop(t + dur + 0.2)
    }
    function bikeBell(t, pan) {
      const dest = out(pan, buses.city)
      ;[0, 0.16].forEach((dt) => {
        const tt = t + dt
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 2500 + Math.random() * 260
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2650; bp.Q.value = 9
        const g = ctx.createGain(); g.gain.value = 0.0001
        o.connect(bp).connect(g).connect(dest)
        g.gain.setValueAtTime(0.0001, tt)
        g.gain.linearRampToValueAtTime(0.032, tt + 0.004)
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.16)
        o.start(tt); o.stop(tt + 0.2)
      })
    }
    function airplane(t) {
      const dur = 18 + Math.random() * 8
      const dest = out(-0.85, buses.city)
      if (dest.pan) { dest.pan.setValueAtTime(-0.85, t); dest.pan.linearRampToValueAtTime(0.85, t + dur) }
      const s = ctx.createBufferSource(); s.buffer = white; s.loop = true; s.playbackRate.value = 0.5
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260
      const g = ctx.createGain(); g.gain.value = 0.0001
      s.connect(lp).connect(g).connect(dest)
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 95
      const og = ctx.createGain(); og.gain.value = 0.0001
      o.connect(og).connect(dest)
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(0.022, t + dur * 0.45); og.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      s.start(t, Math.random() * white.duration); s.stop(t + dur + 0.2)
      o.start(t); o.stop(t + dur + 0.2)
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

    // ---- voice scheduling ---------------------------------------------------
    const running = () => !stopped && ctx.state === 'running'
    const isDay = () => world.timeOfDay === 'day' || world.timeOfDay === 'dawn'
    const isNight = () => world.timeOfDay === 'night' || world.timeOfDay === 'dusk'
    const chance = (prob) => Math.random() < prob * liveliness
    // self-rescheduling timer, randomised period scaled by Activity (busier = shorter)
    function every(minMs, maxMs, fn) {
      const h = { id: 0 }
      const tick = () => {
        if (stopped) return
        fn()
        h.id = setTimeout(tick, (minMs + Math.random() * (maxMs - minMs)) / p.activity)
      }
      h.id = setTimeout(tick, (minMs + Math.random() * (maxMs - minMs)) / p.activity)
      timeouts.push(h)
    }

    // a slow random walk of overall liveliness, so voice density breathes
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

    if (buses.wildlife) {
      every(3200, 8000, () => {
        if (!running() || !isDay() || !chance(0.9)) return
        const burst = 1 + Math.floor(Math.random() * (world.timeOfDay === 'dawn' ? 3 : 2))
        for (let i = 0; i < burst; i++) chirp(ctx.currentTime + i * 0.16 + Math.random() * 0.08, rpan(0.6))
      })
      every(11000, 24000, () => { if (running() && isDay() && chance(0.7)) crow(ctx.currentTime, rpan(0.6)) })
      every(3200, 8000, () => {
        if (!running() || !isNight() || !chance(0.9)) return
        cricketTrill(ctx.currentTime, rpan(0.7))
        if (Math.random() < 0.4) cricketTrill(ctx.currentTime + 0.2 + Math.random() * 0.4, rpan(0.7))
      })
      every(26000, 56000, () => { if (running() && isNight() && chance(0.7)) owl(ctx.currentTime, rpan(0.5)) })
      // cat and dog are near-people sounds, not a constant bed — kept rare and
      // widely spaced so they read as a distant "somewhere out there", never a metronome
      every(55000, 130000, () => { if (running() && chance(0.6)) meow(ctx.currentTime, rpan(0.7)) })
      every(64000, 150000, () => { if (running() && chance(0.6)) dog(ctx.currentTime, rpan(0.7)) })
    }

    if (buses.city) {
      every(30000, 68000, () => { if (running() && chance(0.75)) carPass(ctx.currentTime) })
      every(60000, 130000, () => { if (running() && chance(0.5)) bikeBell(ctx.currentTime, rpan(0.6)) })
      every(130000, 260000, () => { if (running() && chance(0.6)) airplane(ctx.currentTime) })
    }

    if (buses.omens) {
      let lastOmen = -1e9
      let lastBellHour = -1
      every(45000, 95000, () => {
        if (!running() || ctx.currentTime - lastOmen < 25) return
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
    }

    // ---- build the beds, then fade the master in --------------------------
    if (p.warmth > 0) buildWarmth(p.warmth, tone)
    if (p.drone > 0) buildDrone(p.drone, tone)
    if (p.wind > 0) buildWind(0.34 * p.wind, 900, p.motion, p.pace, tone)
    if (p.rain > 0) { buildRain(p.rain, p.pace, tone); buildThunder(p.rain, tone) }
    if (p.waves > 0) buildWaves(p.waves, p.motion, p.pace, tone)
    if (p.stream > 0) buildStream(p.stream, p.motion, p.pace, tone)
    if (p.leaves > 0) buildLeaves(p.leaves, p.motion, p.pace, tone)
    if (p.chime > 0) buildChime(p.chime, p.pace, tone)
    startLiveliness()

    master.gain.setValueAtTime(0.0001, ctx.currentTime)
    master.gain.exponentialRampToValueAtTime(p.master, ctx.currentTime + FADE_IN_SEC)

    function stop(release = 0.5) {
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
      stop,
      resume() { if (ctx.state === 'suspended') ctx.resume().catch(() => {}) },
    }
  }

  // ---- rebuild orchestration ----------------------------------------------
  function rebuild(delay) {
    clearTimeout(rebuildTimer)
    rebuildTimer = setTimeout(() => {
      if (disposed || !enabled) return
      const old = scape
      scape = buildScape()
      // fade the old graph out under the new one — a real ~1s crossfade so a
      // scene change flows from one to the next, never cuts or gaps
      old?.stop(1.0)
    }, delay)
  }
  function teardown() {
    clearTimeout(rebuildTimer)
    if (scape) { scape.stop(0.6); scape = null }
  }

  // ======================================================================
  // interaction sounds (tap / depart / reveal) — their own tiny persistent
  // context, so slider-drag rebuilds of the bed never interrupt them
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
    // The Chorus: mix is the full model from mix.js (each key 0..10). Safe to
    // call before sound is enabled — the value is held and applied on enable.
    setMix(m) {
      mix = m
      if (enabled) rebuild(160)
    },
    // world context for the light day/night gating of the voices — never forces
    // a rebuild; the running voice scheduler reads it live.
    setWorld(w) {
      world = { ...world, ...w }
    },
    setEnabled(on) {
      if (on === enabled) return
      enabled = on
      if (on) rebuild(0)
      else teardown()
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
      scape?.resume()
      if (uiCtx && uiCtx.state === 'suspended') uiCtx.resume().catch(() => {})
    },
    dispose() {
      disposed = true
      teardown()
      if (uiCtx) { uiCtx.close?.().catch(() => {}); uiCtx = null }
    },
  }
}
