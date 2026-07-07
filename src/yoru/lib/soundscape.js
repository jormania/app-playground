// Yoru's night soundscape — fully synthesised (no audio files), tuned for one
// job: helping someone fall asleep.
//
// A LAYER-BLEND design, following the ambient-mixer references that work (A Soft
// Murmur, Noisli, myNoise): six independent nature layers you blend freely, plus
// four global shapers. Everything the ear hears is exposed through the MIX
// (levels 0..10); this file maps each to a real synth parameter.
//
//   layers (0 = off):
//     rain    soft high wash + sparse, stereo-panned droplets
//     waves   slow ocean surf, each swell a little different
//     wind    band-passed air, slowly drifting and gusting
//     leaves  a hush through foliage + soft rustles (no birds, no insects)
//     warmth  a PINK-noise floor — warmer and less boomy than brown
//     drone   a deep, soft tonal hum under everything
//   shapers:
//     volume     master loudness
//     brightness one global low-pass, dark → airy
//     motion     how MUCH everything swells and gusts (depth)
//     pace       how FAST it drifts and swells (speed)
//
// Design north star (from the references): sounds engineered to be easily
// ignored by the brain — masking, never attention-grabbing — and always ebbing
// to true silence by the session's end.

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
const lerp = (a, b, t) => a + (b - a) * t

// Human loudness perception is roughly logarithmic: a LINEAR slider->gain
// mapping always feels wrong in the same way — each step near the bottom of the
// range is a much bigger perceived jump than the same step near the top, and a
// linear floor above zero means "0" never actually reaches silence. `taper`
// fixes both — t=0 stays exactly 0, t=1 is unchanged, and the curve in between
// spaces perceived loudness far more evenly. Master gets the steeper of the two
// (it's the one control that should behave like a real volume knob); each
// layer's own level gets a gentler taper so relative balance between layers in
// a blended preset doesn't reshuffle too much.
const taper = (t, exp) => Math.pow(clamp01(t), exp)
const VOLUME_TAPER = 1.9
const LAYER_TAPER = 1.4

const EBB_START = 0.65
const FADE_IN_SEC = 5

function makeWhiteBuffer(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return buf
}

// Pink noise (Paul Kellet's filter) — warmer and more balanced than brown, the
// recommended bed/ambiance texture; carries body without the deep rumble.
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

function resolveMix(mix) {
  const nv = (k) => clamp01((mix && typeof mix[k] === 'number' ? mix[k] : 0) / 10)
  const gv = (k) => taper(nv(k), LAYER_TAPER) // a layer's own level, perceptually tapered
  return {
    // Volume: 0 is now true silence (taper(0,_)=0), and the steep taper gives it
    // a real "audio knob" feel instead of a linear one.
    master: taper(nv('volume'), VOLUME_TAPER) * 0.18,
    // Brightness is a FREQUENCY, not a gain — ears perceive pitch/tone
    // logarithmically (an octave feels like an equal step wherever you are), so
    // this interpolates in log-frequency space rather than linear Hz.
    toneHz: 520 * Math.pow(8200 / 520, nv('brightness')),
    motion: lerp(0.35, 1.6, nv('motion')),
    pace: lerp(0.5, 1.9, nv('pace')),
    rain: gv('rain'),
    waves: gv('waves'),
    wind: gv('wind'),
    leaves: gv('leaves'),
    warmth: gv('warmth'),
    drone: gv('drone'),
  }
}

export function createNightSoundscape() {
  let ctx = null
  let master = null
  let bedGain = null
  let bedBase = 0
  let nodes = []
  let timers = []
  let stopped = true

  function scheduleEnvelope(target, totalSec, elapsedSec, fadeIn) {
    const now = ctx.currentTime
    const g = master.gain
    g.cancelScheduledValues(now)
    const remainingToEbb = totalSec * EBB_START - elapsedSec
    const endIn = Math.max(0.1, totalSec - elapsedSec)
    if (elapsedSec < fadeIn) {
      g.setValueAtTime(0.0001, now)
      g.exponentialRampToValueAtTime(target, now + fadeIn)
    } else {
      g.setValueAtTime(target, now)
    }
    if (remainingToEbb > 0) g.setValueAtTime(target, now + remainingToEbb)
    g.exponentialRampToValueAtTime(0.0001, now + endIn)
  }

  // ── warmth: pink-noise floor, band-shaped, breathing with you ──
  function buildWarmth(pink, level, dest) {
    const src = loopSource(ctx, pink)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 95
    bedGain = ctx.createGain()
    bedBase = level * 0.85
    bedGain.gain.value = bedBase
    src.connect(lp)
    lp.connect(hp)
    hp.connect(bedGain)
    bedGain.connect(dest)
    src.start()
    nodes.push(src)
  }

  // ── drone: a soft fifth, high-passed + lightly detuned (no reverb ring) ──
  function buildDrone(level, dest) {
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 300
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 110
    const g = ctx.createGain()
    g.gain.value = level * 0.032
    hp.connect(lp)
    lp.connect(g)
    g.connect(dest)
    ;[110, 164.81].forEach((f, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f
      osc.detune.value = i === 0 ? -1.5 : 1.5
      osc.connect(hp)
      osc.start()
      nodes.push(osc)
    })
  }

  // ── wind: band-passed noise, drifting (pace) + gusting (motion) ──
  function buildWind(white, level, lpHz, motion, pace, dest) {
    const wind = loopSource(ctx, white)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 480
    bp.Q.value = 0.55
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = lpHz
    const g = ctx.createGain()
    g.gain.value = level
    const drift = ctx.createOscillator()
    drift.frequency.value = 0.05 * pace
    const driftDepth = ctx.createGain()
    driftDepth.gain.value = 170 * motion
    drift.connect(driftDepth)
    driftDepth.connect(bp.frequency)
    const gust = ctx.createOscillator()
    gust.frequency.value = 0.07 * pace
    const gustDepth = ctx.createGain()
    gustDepth.gain.value = level * 0.45 * motion
    gust.connect(gustDepth)
    gustDepth.connect(g.gain)
    wind.connect(bp)
    bp.connect(lp)
    lp.connect(g)
    g.connect(dest)
    wind.start()
    drift.start()
    gust.start()
    nodes.push(wind, drift, gust)
  }

  // ── rain: soft high wash + stereo droplets, busier with level, faster w/ pace ──
  function buildRain(white, level, pace, dest) {
    const rain = loopSource(ctx, white)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1300
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 6500
    const g = ctx.createGain()
    g.gain.value = 0.09 * level
    rain.connect(hp)
    hp.connect(lp)
    lp.connect(g)
    g.connect(dest)
    rain.start()
    nodes.push(rain)

    let nextAt = ctx.currentTime + 0.6
    const t = setInterval(() => {
      if (stopped) return
      const ahead = ctx.currentTime + 1.5
      while (nextAt < ahead) {
        const when = nextAt
        const src = ctx.createBufferSource()
        src.buffer = white
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 2000 + Math.random() * 2600
        bp.Q.value = 1.1
        const dg = ctx.createGain()
        const v = (0.02 + Math.random() * 0.03) * level
        dg.gain.setValueAtTime(0.0001, when)
        dg.gain.exponentialRampToValueAtTime(v, when + 0.004)
        dg.gain.exponentialRampToValueAtTime(0.0001, when + 0.08 + Math.random() * 0.07)
        const p = panner(ctx, Math.random() * 1.4 - 0.7)
        src.connect(bp)
        bp.connect(dg)
        dg.connect(p)
        p.connect(dest)
        src.start(when)
        src.stop(when + 0.3)
        // busier when louder, faster with pace
        nextAt += (0.22 + Math.random() * 0.7) * (1.6 - level) / pace
      }
    }, 400)
    timers.push(t)
  }

  // ── waves: slow surf; level=loudness, motion=swell size, pace=speed ──
  function buildWaves(white, level, motion, pace, dest) {
    const src = loopSource(ctx, white)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 160
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 500
    const g = ctx.createGain()
    const trough = 0.03 * level
    g.gain.value = trough
    src.connect(hp)
    hp.connect(lp)
    lp.connect(g)
    g.connect(dest)
    src.start()
    nodes.push(src)

    let nextAt = ctx.currentTime + 0.8
    g.gain.setValueAtTime(trough, nextAt)
    lp.frequency.setValueAtTime(340, nextAt)
    const t = setInterval(() => {
      if (stopped) return
      const ahead = ctx.currentTime + 12
      while (nextAt < ahead) {
        const period = ((9 + Math.random() * 5) / pace)
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
    timers.push(t)
  }

  // ── leaves: a soft hush of wind through foliage + occasional rustles ──
  function buildLeaves(white, level, motion, pace, dest) {
    buildWind(white, level * 0.5, 1100, motion, pace, dest)
    let nextAt = ctx.currentTime + 2
    const t = setInterval(() => {
      if (stopped) return
      const ahead = ctx.currentTime + 4
      while (nextAt < ahead) {
        const when = nextAt
        const src = ctx.createBufferSource()
        src.buffer = white
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 1400 + Math.random() * 1400
        bp.Q.value = 0.8
        const g = ctx.createGain()
        const v = (0.02 + Math.random() * 0.025) * level * motion
        const dur = 0.7 + Math.random() * 1.1
        g.gain.setValueAtTime(0.0001, when)
        g.gain.linearRampToValueAtTime(v, when + dur * 0.4)
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
        const p = panner(ctx, Math.random() * 1.4 - 0.7)
        src.connect(bp)
        bp.connect(g)
        g.connect(p)
        p.connect(dest)
        src.start(when)
        src.stop(when + dur + 0.1)
        nextAt += (2.5 + Math.random() * 4) / pace
      }
    }, 700)
    timers.push(t)
  }

  async function start({ totalSec, elapsedSec = 0, mix, fadeIn = FADE_IN_SEC }) {
    const p = resolveMix(mix)
    if (p.master <= 0) return

    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    ctx = new Ctx()
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {})
    stopped = false

    master = ctx.createGain()
    master.gain.value = 0.0001
    master.connect(ctx.destination)

    // One global brightness low-pass everything passes through.
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = p.toneHz
    tone.connect(master)

    const white = makeWhiteBuffer(ctx, 4)
    const pink = makePinkBuffer(ctx, 8)

    if (p.warmth > 0) buildWarmth(pink, p.warmth, tone)
    if (p.drone > 0) buildDrone(p.drone, tone)
    if (p.wind > 0) buildWind(white, 0.34 * p.wind, 900, p.motion, p.pace, tone)
    if (p.rain > 0) buildRain(white, p.rain, p.pace, tone)
    if (p.waves > 0) buildWaves(white, p.waves, p.motion, p.pace, tone)
    if (p.leaves > 0) buildLeaves(white, p.leaves, p.motion, p.pace, tone)

    scheduleEnvelope(p.master, totalSec, elapsedSec, fadeIn)
  }

  function setBreath(scale) {
    if (stopped || !bedGain || !ctx) return
    const s = clamp01(scale)
    bedGain.gain.setTargetAtTime(bedBase * (0.78 + 0.22 * s), ctx.currentTime, 0.35)
  }

  // Always release with a gentle fade — the sound must flow out, never cut,
  // whatever the mixer is set to. `release` (s) is the fade length.
  function stop(release = 1.8) {
    if (stopped) return
    stopped = true
    timers.forEach(clearInterval)
    timers = []
    if (ctx && master) {
      const now = ctx.currentTime
      try {
        master.gain.cancelScheduledValues(now)
        master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now)
        // setTargetAtTime gives a natural exponential ebb; the explicit ramp
        // guarantees it reaches silence by the end of the release.
        master.gain.setTargetAtTime(0.0001, now, release / 3)
        master.gain.exponentialRampToValueAtTime(0.0001, now + release)
      } catch {
        /* ignore */
      }
    }
    const releaseMs = release * 1000 + 250
    const dyingCtx = ctx
    const dyingNodes = nodes
    nodes = []
    setTimeout(() => {
      dyingNodes.forEach((n) => {
        try {
          n.stop?.()
        } catch {
          /* already stopped */
        }
      })
      dyingCtx?.close?.().catch(() => {})
    }, releaseMs)
    ctx = null
    master = null
    bedGain = null
  }

  return { start, setBreath, stop }
}
