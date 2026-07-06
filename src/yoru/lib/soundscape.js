// Yoru's night soundscape — fully synthesised (no audio files), tuned for one
// job: helping someone fall asleep.
//
// Design principles, all in service of sleep:
//   • Low and warm. A brown-noise bed (heavy low end) is the anchor under every
//     scene — the texture with the best evidence for sleep.
//   • Nature only — never animals, never traffic or city. Just water, wind, and
//     air moving. Nothing with a will of its own to make the ear track it.
//   • Nothing to LISTEN to. No melody, no beat, no motif that resolves. Scenes
//     drift and scatter at random so the ear never locks on.
//   • It breathes with you. The bed swells a hair on the in-breath and softens
//     as you let go — felt at the edge of awareness, never a signal.
//   • It disappears as you drift. The master level holds while you settle, then
//     ebbs to true silence by the session's end, so the sound is never the thing
//     that keeps you tethered awake — and never stops with a jolt.
//
// Scenes (all animal-free, all natural):
//   rain   — soft high wash + sparse droplets + low wind
//   waves  — slow ocean surf that swells and recedes, each wave a little different
//   wind   — air moving through the dark, gusting slowly
//   forest — a hush of wind through leaves, with occasional soft rustles (no birds)

// Volume is PURELY loudness: it only scales the master gain, never any layer's
// character. The steps are distinct but the range is kept moderate on purpose —
// too quiet and the fine detail (droplets, rustles, crests) drops below hearing
// so the texture seems to thin; too loud and the summed peaks harden. Both of
// those read as a change in *character*, which belongs to Intensity, not here.
// This range keeps the same character across every step — just louder or softer.
const VOLUME_LEVEL = { off: 0, soft: 0.055, medium: 0.1, full: 0.16 }

const EBB_START = 0.65 // fraction at full level before the ebb toward silence
const FADE_IN_SEC = 5

// Intensity tiers → a 0..1 factor. 'lively' (1) is the baseline character;
// lower tiers make each scene milder, sparser and more serene (a sleep helper).
// The warm bed and low pad are NOT scaled — there's always a steady floor; only
// the scene's own character layers thin out.
const INTENSITY = { faint: 0.25, gentle: 0.5, steady: 0.75, lively: 1 }
const lerp = (a, b, t) => a + (b - a) * t

function makeWhiteBuffer(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return buf
}

function makeBrownBuffer(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    last = (last + 0.02 * w) / 1.02
    d[i] = Math.max(-1, Math.min(1, last * 3.4))
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

export function createNightSoundscape() {
  let ctx = null
  let master = null
  let bedGain = null
  let bedBase = 0
  let nodes = [] // sources/oscillators to stop() on teardown
  let timers = [] // scene schedulers (droplets, waves, rustles)
  let stopped = true

  function scheduleEnvelope(target, totalSec, elapsedSec, fadeIn) {
    const now = ctx.currentTime
    const g = master.gain
    g.cancelScheduledValues(now)

    const ebbStartSec = totalSec * EBB_START
    const remainingToEbb = ebbStartSec - elapsedSec
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

  // ── Shared bed: brown noise, low-passed, breathing with you. ──
  function buildBed(brown) {
    const bed = loopSource(ctx, brown)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 520
    // High-pass just below the low-mids: cuts the deep boom (sub-bass) but keeps
    // the body/warmth around 140–250 Hz so the bed doesn't sound hollow.
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 135
    bedGain = ctx.createGain()
    bedBase = 0.6
    bedGain.gain.value = bedBase
    bed.connect(lp)
    lp.connect(hp)
    hp.connect(bedGain)
    bedGain.connect(master)
    bed.start()
    nodes.push(bed)
  }

  // ── Shared warm low pad — a barely-there fifth, slowly beating. Pitched up an
  // octave and high-passed + quieted so it adds warmth without deep rumble. ──
  function buildPad() {
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 300
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 130
    const g = ctx.createGain()
    g.gain.value = 0.011
    hp.connect(lp)
    lp.connect(g)
    g.connect(master)
    ;[110, 164.81].forEach((f, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f
      osc.detune.value = i === 0 ? -4 : 5
      osc.connect(hp)
      osc.start()
      nodes.push(osc)
    })
  }

  // ── Wind — band-passed noise with a slowly drifting centre and gusts. ──
  function buildWind(white, level, lpHz = 900) {
    const wind = loopSource(ctx, white)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 480
    bp.Q.value = 0.7
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = lpHz
    const g = ctx.createGain()
    g.gain.value = level
    const centreLfo = ctx.createOscillator()
    centreLfo.frequency.value = 0.05
    const centreDepth = ctx.createGain()
    centreDepth.gain.value = 170
    centreLfo.connect(centreDepth)
    centreDepth.connect(bp.frequency)
    const gustLfo = ctx.createOscillator()
    gustLfo.frequency.value = 0.07
    const gustDepth = ctx.createGain()
    gustDepth.gain.value = level * 0.45
    gustLfo.connect(gustDepth)
    gustDepth.connect(g.gain)
    wind.connect(bp)
    bp.connect(lp)
    lp.connect(g)
    g.connect(master)
    wind.start()
    centreLfo.start()
    gustLfo.start()
    nodes.push(wind, centreLfo, gustLfo)
  }

  // ── Rain — a soft high wash plus droplets. Intensity thins the wash and makes
  // the droplets sparser and quieter, from a faint drizzle to steady rain. ──
  function buildRain(white, i) {
    const rain = loopSource(ctx, white)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1300
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 6500
    const g = ctx.createGain()
    g.gain.value = 0.06 * lerp(0.45, 1, i)
    rain.connect(hp)
    hp.connect(lp)
    lp.connect(g)
    g.connect(master)
    rain.start()
    nodes.push(rain)

    const gap = lerp(2.4, 1, i) // sparser drops when milder
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
        const v = (0.02 + Math.random() * 0.03) * lerp(0.5, 1, i)
        dg.gain.setValueAtTime(0.0001, when)
        dg.gain.exponentialRampToValueAtTime(v, when + 0.004)
        dg.gain.exponentialRampToValueAtTime(0.0001, when + 0.08 + Math.random() * 0.07)
        const p = panner(ctx, Math.random() * 1.4 - 0.7)
        src.connect(bp)
        bp.connect(dg)
        dg.connect(p)
        p.connect(master)
        src.start(when)
        src.stop(when + 0.3)
        nextAt += (0.22 + Math.random() * 0.7) * gap
      }
    }, 400)
    timers.push(t)
  }

  // ── Waves — slow ocean surf. A wash of noise whose level and brightness
  // swell and recede, each wave a slightly different length and height, so it
  // never becomes a metronome. This is the layer built for falling asleep to
  // waves. ──
  function buildWaves(white, i) {
    const src = loopSource(ctx, white)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 160
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 500
    const g = ctx.createGain()
    g.gain.value = 0.04 * lerp(0.6, 1, i)
    src.connect(hp)
    hp.connect(lp)
    lp.connect(g)
    g.connect(master)
    src.start()
    nodes.push(src)

    // Schedule successive waves a little ahead on the audio clock. Each wave
    // chains from the previous trough so the automation stays continuous.
    // Milder intensity → longer, gentler, darker swells (more serene).
    const stretch = lerp(1.6, 1, i)
    let nextAt = ctx.currentTime + 0.8
    const trough = 0.03
    g.gain.setValueAtTime(trough, nextAt)
    lp.frequency.setValueAtTime(340, nextAt)
    const t = setInterval(() => {
      if (stopped) return
      const ahead = ctx.currentTime + 9 * stretch
      while (nextAt < ahead) {
        const period = (9 + Math.random() * 5) * stretch // longer when milder
        const crest = nextAt + period * 0.42
        const end = nextAt + period
        const peak = (0.5 + Math.random() * 0.28) * lerp(0.55, 1, i)
        // level: swell to the crest, recede to the trough
        g.gain.setValueAtTime(trough, nextAt)
        g.gain.linearRampToValueAtTime(peak, crest)
        g.gain.exponentialRampToValueAtTime(trough, end)
        // brightness: opens as it breaks, darkens as it draws back
        lp.frequency.setValueAtTime(340, nextAt)
        lp.frequency.linearRampToValueAtTime(700 + (600 + Math.random() * 400) * i, crest)
        lp.frequency.exponentialRampToValueAtTime(320, end)
        nextAt = end
      }
    }, 1000)
    timers.push(t)
  }

  // ── Forest — a hush of wind through leaves, with occasional soft rustles.
  // No birds, no insects: just air and foliage. ──
  function buildForest(white, i) {
    buildWind(white, 0.16 * lerp(0.55, 1, i), 1100)
    // leaf-rustle swells: brief, soft, mid-high band-passed noise. Milder →
    // rarer and quieter rustles.
    const gap = lerp(1.9, 1, i)
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
        const v = (0.02 + Math.random() * 0.025) * lerp(0.5, 1, i)
        const dur = 0.7 + Math.random() * 1.1
        g.gain.setValueAtTime(0.0001, when)
        g.gain.linearRampToValueAtTime(v, when + dur * 0.4)
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
        const p = panner(ctx, Math.random() * 1.4 - 0.7)
        src.connect(bp)
        bp.connect(g)
        g.connect(p)
        p.connect(master)
        src.start(when)
        src.stop(when + dur + 0.1)
        nextAt += (2.5 + Math.random() * 4) * gap
      }
    }, 700)
    timers.push(t)
  }

  async function start({ totalSec, elapsedSec = 0, volume = 'medium', scene = 'rain', intensity = 'gentle', fadeIn = FADE_IN_SEC }) {
    const target = VOLUME_LEVEL[volume] ?? VOLUME_LEVEL.medium
    if (target <= 0) return // 'off' — build nothing
    const i = INTENSITY[intensity] ?? INTENSITY.gentle

    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    ctx = new Ctx()
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {})
    stopped = false

    master = ctx.createGain()
    master.gain.value = 0.0001
    master.connect(ctx.destination)

    const white = makeWhiteBuffer(ctx, 4)
    const brown = makeBrownBuffer(ctx, 8)

    buildBed(brown)
    buildPad()

    if (scene === 'waves') {
      buildWaves(white, i)
    } else if (scene === 'wind') {
      buildWind(white, 0.32 * lerp(0.5, 1, i), 900)
    } else if (scene === 'forest') {
      buildForest(white, i)
    } else {
      // 'rain' (default)
      buildWind(white, 0.2 * lerp(0.5, 1, i), 900)
      buildRain(white, i)
    }

    scheduleEnvelope(target, totalSec, elapsedSec, fadeIn)
  }

  // Drive the bed's tidal swell from the breath (scale 0..1) — subtle.
  function setBreath(scale) {
    if (stopped || !bedGain || !ctx) return
    const s = Math.max(0, Math.min(1, scale))
    bedGain.gain.setTargetAtTime(bedBase * (0.78 + 0.22 * s), ctx.currentTime, 0.35)
  }

  function stop() {
    if (stopped) return
    stopped = true
    timers.forEach(clearInterval)
    timers = []
    if (ctx && master) {
      const now = ctx.currentTime
      try {
        master.gain.cancelScheduledValues(now)
        master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now)
        master.gain.exponentialRampToValueAtTime(0.0001, now + 1.4)
      } catch {
        /* ignore */
      }
    }
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
    }, 1600)
    ctx = null
    master = null
    bedGain = null
  }

  return { start, setBreath, stop }
}
