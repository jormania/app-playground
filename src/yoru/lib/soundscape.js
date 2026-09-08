// Yoru's night soundscape — fully synthesised (no audio files), tuned for one
// job: helping someone fall asleep.
//
// A LAYER-BLEND design, following the ambient-mixer references that work (A Soft
// Murmur, Noisli, myNoise): eight independent nature layers you blend freely,
// plus four global shapers. Everything the ear hears is exposed through the MIX
// (levels 0..10); this file maps each to a real synth parameter.
//
//   layers (0 = off):
//     rain    soft high wash + sparse, stereo-panned droplets (+ distant thunder)
//     waves   slow ocean surf, each swell a little different
//     stream  a steady brook, softly babbling
//     wind    band-passed air, slowly drifting and gusting
//     leaves  a hush through foliage + soft rustles (no birds, no insects)
//     chime   a sparse furin, only now and then
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
//
// ── The four structural rules that keep it from sounding synthetic ──────────
// Filters and levels decide what a layer IS; these four decide whether the ear
// files it under "outside" or under "a machine". They are cheap, they apply to
// every layer, and each one is fixing something the brain notices in the dark
// long before it notices a filter setting.
//
//   1. NOTHING SHARES A WAVEFORM. Every noise source reads the shared buffer
//      from its own random offset — including one-shots (§ noiseOffset). Two
//      layers reading the same samples fuse into one source no matter how
//      differently they're filtered.
//   2. NOTHING REPEATS. Every "organic drift" is an aperiodic random walk, not
//      an LFO (§ createDrift). A 0.05 Hz sine repeats 180 times an hour and the
//      brain will find it.
//   3. EVERYTHING HAS A ROOM. Transients go through a dark synthetic reverb
//      (§ reverbImpulse). Dry point sources sit inside your skull; a diffuse
//      tail puts them out in the world — and smears the attack, which matters
//      when the listener is trying to fall asleep.
//   4. ONE BREEZE MOVES THE WHOLE SCENE. Wind, leaves and rain share a single
//      "weather" drift (§ weather), so a gust brightens the air, stirs the
//      trees and pushes the rain together — but each keeps an independent drift
//      of its own too, so the mix breathes as a place, not as one tremolo.

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x)
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
export const taper = (t, exp) => Math.pow(clamp01(t), exp)
const VOLUME_TAPER = 1.9
const LAYER_TAPER = 1.4

const EBB_START = 0.65
const FADE_IN_SEC = 5

// ── Rule 2: aperiodic drift ────────────────────────────────────────────────
// One step of a mean-reverting random walk in [-1, 1]. The target is shaped
// (|u|^1.7, sign preserved) rather than uniform, which is what gives it the
// character weather actually has: mostly quiet, with a real gust now and then,
// instead of the relentless even swell of a sine. `pull` is how much of the way
// to the new target one step travels — lower wanders more slowly.
export function driftStep(prev, pull = 0.6) {
  const u = Math.random() * 2 - 1
  const target = Math.sign(u) * Math.pow(Math.abs(u), 1.7)
  return clamp(prev + (target - prev) * pull, -1, 1)
}

// The walk's typical excursion is well under ±1 (that's the point — calm most
// of the time); this scales the peaks back up so replacing a sine LFO doesn't
// read as "the soundscape got less alive", only as "it stopped repeating".
const DRIFT_GAIN = 1.45
const DRIFT_AHEAD = 14 // seconds of drift automation kept scheduled ahead
// (>= the furthest any event scheduler looks, so driftValue is never asked
// about a time the drift has not been scheduled through yet — Waves looks 12s)

// ── Rule 3: a room ─────────────────────────────────────────────────────────
// A synthetic impulse response: decaying noise, one-pole low-passed to a dark,
// diffuse tail, after a short pre-delay so the direct sound still arrives first.
// Deliberately not a "nice" reverb — outdoors has no bright early reflections,
// and anything resonant would be the one thing in here that grabs attention.
// Each channel is independently generated (an IR whose channels correlate would
// collapse the very width it's meant to create), and each is normalised to unit
// energy so the wet level means the same thing at any sample rate or length.
export function reverbImpulse(sampleRate, seconds = 2.0, preDelaySec = 0.018) {
  const len = Math.max(1, Math.floor(sampleRate * seconds))
  const pre = Math.min(len - 1, Math.floor(sampleRate * preDelaySec))
  const out = [new Float32Array(len), new Float32Array(len)]
  for (const ch of out) {
    let lp = 0
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / (len - pre)
      const env = Math.pow(1 - t, 2.6)
      lp += ((Math.random() * 2 - 1) * env - lp) * 0.16 // ≈1.3kHz at 48k — dark
      ch[i] = lp
    }
    let energy = 0
    for (let i = 0; i < len; i++) energy += ch[i] * ch[i]
    const g = 1 / Math.sqrt(Math.max(energy, 1e-12))
    for (let i = 0; i < len; i++) ch[i] *= g
  }
  return out
}

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

// Rule 1, for one-shots. Every droplet, bubble and rustle used to start at
// sample 0 of the same shared buffer — so every one of them was literally the
// same few milliseconds of noise wearing a different filter, thousands of times
// a night. Reading each from its own offset costs one argument and makes each
// one genuinely different. `needSec` keeps the slice from running off the end.
const noiseOffset = (buffer, needSec) =>
  Math.random() * Math.max(0, buffer.duration - needSec - 0.05)

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

export function resolveMix(mix) {
  const nv = (k) => clamp01((mix && typeof mix[k] === 'number' ? mix[k] : 0) / 10)
  const gv = (k) => taper(nv(k), LAYER_TAPER) // a layer's own level, perceptually tapered
  return {
    // Volume: 0 is now true silence (taper(0,_)=0), and the steep taper gives it
    // a real "audio knob" feel instead of a linear one. 0.24 ceiling (was 0.18)
    // after the first taper pass came back reporting the whole mix too quiet.
    master: taper(nv('volume'), VOLUME_TAPER) * 0.24,
    // Brightness is a FREQUENCY, not a gain — ears perceive pitch/tone
    // logarithmically (an octave feels like an equal step wherever you are), so
    // this interpolates in log-frequency space rather than linear Hz.
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
  }
}

export function createNightSoundscape() {
  let ctx = null
  let master = null
  let bedGain = null
  let bedBase = 0
  let nodes = []
  let timers = []
  let drifts = []
  let retiring = []
  let reverbIn = null // the send bus, or null when no layer wants a room
  let stopped = true
  let stereo = true // bed stereo width, set from start()'s option

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

  // ── drift: an aperiodic control signal (rule 2) ───────────────────────────
  // A ConstantSourceNode whose offset is walked to a fresh random target every
  // segment, with the segment's own length randomised too. Connected to an
  // AudioParam it SUMS onto that param's intrinsic value — the same contract
  // the sine LFOs it replaces had, so every call site's tuning still means what
  // it meant. Segments are also mirrored in JS (`segs`) so the event schedulers
  // can read the same drift the filters are hearing and, say, rustle the leaves
  // harder on the gust that is brightening the wind.
  function createDrift(rateHz, until = 0) {
    // Degrade to "no drift" rather than "no sound": every caller is null-safe,
    // so on a browser without ConstantSourceNode the soundscape comes up a
    // little more static instead of throwing out of start() into silence.
    if (!ctx.createConstantSource) return null
    const src = ctx.createConstantSource()
    src.offset.value = 0
    const d = { src, rateHz: Math.max(0.001, rateHz), until, walk: 0, segs: [], nextAt: ctx.currentTime }
    src.start()
    nodes.push(src)
    drifts.push(d)
    advanceDrift(d, ctx.currentTime + DRIFT_AHEAD)
    return d
  }

  function advanceDrift(d, until) {
    // A backgrounded tab's timers get throttled while the AudioContext keeps
    // running, so a tick can arrive a long way behind. Skip the backlog rather
    // than dumping a minute of past-dated automation on the param at once —
    // `from` already equals where the param actually sits, so this can't click.
    if (d.nextAt < ctx.currentTime - 1) d.nextAt = ctx.currentTime
    let from = d.segs.length ? d.segs[d.segs.length - 1].to : 0
    while (d.nextAt < until) {
      const dur = (0.5 / d.rateHz) * (0.55 + Math.random() * 0.9)
      d.walk = driftStep(d.walk)
      const to = clamp(d.walk * DRIFT_GAIN, -1, 1)
      d.src.offset.setValueAtTime(from, d.nextAt)
      d.src.offset.linearRampToValueAtTime(to, d.nextAt + dur)
      d.segs.push({ t0: d.nextAt, t1: d.nextAt + dur, from, to })
      d.nextAt += dur
      from = to
    }
    const cutoff = ctx.currentTime - 1
    while (d.segs.length > 1 && d.segs[0].t1 < cutoff) d.segs.shift()
  }

  // What a drift will be at time `t` — the value the audio graph is scheduled
  // to hold then, read from the same segments, so JS-scheduled events and
  // audio-rate modulation never disagree about where the gust is.
  function driftValue(d, t) {
    if (!d || !d.segs.length) return 0
    for (const s of d.segs) {
      if (t <= s.t0) return s.from
      if (t < s.t1) return s.from + ((s.to - s.from) * (t - s.t0)) / (s.t1 - s.t0)
    }
    return d.segs[d.segs.length - 1].to
  }

  // Fan a drift onto an AudioParam at a given depth. One drift can feed several
  // params at different depths — which is how a gust gets to be louder AND
  // brighter at the same instant instead of on two unrelated clocks.
  function link(d, param, depth) {
    if (!d) return null
    const g = ctx.createGain()
    g.gain.value = depth
    d.src.connect(g)
    g.connect(param)
    return g
  }

  const driftParam = (param, depth, rateHz, until = 0) => link(createDrift(rateHz, until), param, depth)
  const driftFilter = (filter, depthHz, rateHz, until = 0) => driftParam(filter.frequency, depthHz, rateHz, until)
  const driftGain = (gainNode, depth, rateHz) => driftParam(gainNode.gain, depth, rateHz)

  // Nodes fed by a source that never stops (a wave's own foam gain) can never
  // become collectable on their own — they would pile up silently for the whole
  // session. Hand them over once their envelope is finished.
  function retire(at, fn) {
    retiring.push({ at, fn })
  }

  function tick() {
    tickDrifts()
    if (stopped || !ctx) return
    const now = ctx.currentTime
    retiring = retiring.filter((r) => {
      if (r.at > now) return true
      try {
        r.fn()
      } catch {
        /* already gone */
      }
      return false
    })
  }

  // Keep every drift's automation topped up, and retire the short-lived ones
  // (a thunder roll's filter wobble) so a 90-minute session doesn't accumulate
  // control nodes it stopped needing an hour ago.
  function tickDrifts() {
    if (stopped || !ctx) return
    const now = ctx.currentTime
    const until = now + DRIFT_AHEAD
    drifts = drifts.filter((d) => {
      if (d.until && now > d.until) {
        try {
          d.src.stop()
        } catch {
          /* already stopped */
        }
        return false
      }
      advanceDrift(d, until)
      return true
    })
  }

  // ── the room (rule 3) ─────────────────────────────────────────────────────
  // One send bus for everything transient. Continuous washes stay dry: running
  // steady noise through a reverb only makes it louder and muddier, and buys no
  // realism. The wet path is filtered darker than the dry (`toneHz * 0.6`) and
  // high-passed, because a diffuse field is always duller than the direct sound
  // — and because a bright tail would undo the whole point of the brightness
  // control at its dark end.
  function buildRoom(toneHz) {
    try {
      buildRoomUnsafe(toneHz)
    } catch {
      reverbIn = null // same bargain as the drift: lose the room, keep the night
    }
  }

  function buildRoomUnsafe(toneHz) {
    const conv = ctx.createConvolver()
    conv.normalize = false
    const [l, r] = reverbImpulse(ctx.sampleRate, 2.0)
    const ir = ctx.createBuffer(2, l.length, ctx.sampleRate)
    ir.copyToChannel(l, 0)
    ir.copyToChannel(r, 1)
    conv.buffer = ir
    // 70Hz, not the 180 a room reverb would take: thunder lives at 30-220Hz and
    // is the one thing here that NEEDS its tail, so the high-pass can only go
    // low enough to keep genuine sub-mud out.
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 70
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = Math.min(toneHz * 0.6, 2600)
    const wet = ctx.createGain()
    // Raised from the first pass's 0.45, which came back too dry by ear. Still
    // the number to reach for first: an unexpectedly loud tail at 2am is the
    // worst failure this file can have. The IR is normalised to unit energy, so
    // its LENGTH costs nothing in loudness — 2.0s buys space, not level.
    wet.gain.value = 0.75
    reverbIn = ctx.createGain()
    reverbIn.gain.value = 1
    reverbIn.connect(conv)
    conv.connect(hp)
    hp.connect(lp)
    lp.connect(wet)
    wet.connect(master)
  }

  // Send a node into the room at `amount` of its dry level. A no-op when no
  // room was built (nothing in the blend asked for one).
  function sendToRoom(node, amount) {
    if (!reverbIn) return
    const g = ctx.createGain()
    g.gain.value = amount
    node.connect(g)
    g.connect(reverbIn)
  }

  // ── warmth: pink-noise floor, band-shaped, breathing with you ──
  function buildWarmth(pink, level, dest) {
    const src = stereoNoise(pink, 1.0)
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
    driftFilter(lp, 60, 0.018) // barely-there wobble — the floor should read as alive, not static
  }

  // ── drone: a soft fifth, high-passed + lightly detuned (no reverb ring) ──
  // Its two oscillators are already two different pitches (a fifth apart) —
  // spreading them to L/R when stereo is on widens the drone for free, no
  // extra nodes beyond a panner each. (Backported from Touch Grass.)
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
      if (stereo) {
        const p = panner(ctx, i === 0 ? -0.6 : 0.6)
        osc.connect(p)
        p.connect(hp)
      } else {
        osc.connect(hp)
      }
      osc.start()
      nodes.push(osc)
    })
    // A very slow amplitude breathing — small enough to read as alive over a
    // long session, not as a tremolo.
    driftGain(g, level * 0.006, 0.011)
  }

  // A bed's noise source. With stereo on: a decorrelated pair — two loops of
  // the same buffer read from FAR-APART offsets, panned L/R — so the bed reads
  // as wide and enveloping rather than a mono point in the middle of your head
  // (the 0.7 trim compensates for the ~+3dB two incoherent sources sum to,
  // keeping the tuned level). With stereo off: a single centred mono source at
  // the same level. (Backported from Touch Grass.)
  //
  // Offsets, not the ±1.5% playback-rate detune this replaces: two copies of one
  // buffer at slightly different rates start ALIGNED and slide apart, which
  // means they also slide back together — on a 20s buffer at ±1.5% the image
  // collapsed to near-mono and re-widened every ~11 minutes, a perfectly
  // periodic breathing of the stereo width. Fixed offsets never re-converge,
  // cost no resampling, and are decorrelated from the first sample.
  function stereoNoise(buffer, rate = 1, spread = 0.6) {
    if (!stereo) {
      const s = loopSource(ctx, buffer)
      s.playbackRate.value = rate
      s.start(0, noiseOffset(buffer, 0))
      nodes.push(s)
      return s
    }
    const merge = ctx.createGain()
    merge.gain.value = 0.7
    const a = Math.random() * buffer.duration
    const b = (a + buffer.duration * (0.35 + Math.random() * 0.3)) % buffer.duration
    ;[[-spread, a], [spread, b]].forEach(([pan, off]) => {
      const s = loopSource(ctx, buffer)
      s.playbackRate.value = rate
      const p = panner(ctx, pan)
      s.connect(p)
      p.connect(merge)
      s.start(0, off)
      nodes.push(s)
    })
    return merge
  }

  // ── wind: band-passed noise, drifting + gusting ──
  // Rule 4, at its most audible: a real gust is louder AND brighter in the same
  // instant — turbulence carries more high-frequency energy the harder it
  // blows. This used to run gain off one 0.07Hz sine and the filter off another
  // at 0.05Hz, so the wind got brighter and louder out of phase, which is a very
  // strong tell that nothing is actually moving. Now both params are driven by
  // the SAME two drifts: the shared `weather` (so the whole scene gusts
  // together) plus one of the layer's own (so it doesn't gust in lockstep).
  function buildWind(white, level, lpHz, motion, pace, dest, weather) {
    // Levels here are deliberately restrained. Moving air is the layer with the
    // most continuous broadband energy in the whole file, and continuous
    // broadband energy is what reads as pressure rather than as calm.
    const wind = stereoNoise(white, 1.0, 0.7)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 480
    bp.Q.value = 0.55
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = lpHz
    const g = ctx.createGain()
    g.gain.value = level
    wind.connect(bp)
    bp.connect(lp)
    lp.connect(g)
    g.connect(dest)
    const own = createDrift(0.05 * pace)
    for (const [d, w] of [[weather, 0.55], [own, 0.5]]) {
      if (!d) continue
      link(d, g.gain, level * 0.36 * motion * w)
      link(d, bp.frequency, 150 * motion * w)
    }
  }

  // ── rain: soft high wash + stereo droplets, busier with level, faster w/ pace ──
  // The wash rides two drifts: `weather` (a gust drives the rain harder for a
  // few seconds — and brighter with it) and `shower`, a much slower one that
  // gives the minute-scale ebb and swell every real rainfall has and no
  // synthesised one ever does. Droplet density reads the same two, so the
  // patter thickens with the wash instead of ticking along at its own rate.
  function buildRain(white, level, pace, dest, weather, shower) {
    const rain = stereoNoise(white, 1.0)
    // Downpour vs. droplets is a RATIO, and the wash was winning it by 10.5dB —
    // which is why the drops read as texture inside the hiss instead of as
    // drops. The wash comes down ~6dB and loses its harsh top octave (6.5k ->
    // 4.5k, and a little more body at the bottom); the droplets below come up.
    // Together that puts them a couple of dB OVER the wash instead of under it.
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1150
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 4500
    const g = ctx.createGain()
    const base = 0.055 * level
    g.gain.value = base
    rain.connect(hp)
    hp.connect(lp)
    lp.connect(g)
    g.connect(dest)
    if (weather) {
      link(weather, g.gain, base * 0.2)
      link(weather, lp.frequency, 700)
    }
    if (shower) {
      link(shower, g.gain, base * 0.34)
      link(shower, lp.frequency, 900)
    }

    let nextAt = ctx.currentTime + 0.6
    const t = setInterval(() => {
      if (stopped) return
      const ahead = ctx.currentTime + 1.5
      while (nextAt < ahead) {
        const when = nextAt
        // how hard it is raining at that moment, 0.5 (a lull) .. 1.9 (a squall)
        const heavier = clamp(1 + 0.3 * driftValue(weather, when) + 0.5 * driftValue(shower, when), 0.5, 1.9)
        const src = ctx.createBufferSource()
        src.buffer = white
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        // lower and narrower than before: a drop with a bit of pitch to it
        // reads as one event, where a wide bright burst reads as a tick
        bp.frequency.value = 1700 + Math.random() * 2200
        bp.Q.value = 1.4
        const dg = ctx.createGain()
        const v = (0.045 + Math.random() * 0.05) * level
        dg.gain.setValueAtTime(0.0001, when)
        // 8-14ms, not 4: a softened attack is a plop rather than a tick, and
        // nothing in a sleep soundscape should have a click's onset
        dg.gain.exponentialRampToValueAtTime(v, when + 0.008 + Math.random() * 0.006)
        dg.gain.exponentialRampToValueAtTime(0.0001, when + 0.13 + Math.random() * 0.12)
        const p = panner(ctx, Math.random() * 1.4 - 0.7)
        src.connect(bp)
        bp.connect(dg)
        dg.connect(p)
        p.connect(dest)
        sendToRoom(p, 0.6)
        src.start(when, noiseOffset(white, 0.4))
        src.stop(when + 0.4)
        // busier when louder, faster with pace, and busier still in a squall
        // a touch sparser than before as well — louder drops that overlap just
        // become the wash again
        nextAt += ((0.26 + Math.random() * 0.8) * (1.6 - level)) / (pace * heavier)
      }
    }, 400)
    timers.push(t)
  }

  // ── thunder: a distant rumble accenting Rain — rare, low, and scaled to how
  // heavy the rain is (heavier rain, a touch more frequent and a touch louder,
  // but always distant, never a startling crack). Checked once per tick rather
  // than the "schedule several ahead" pattern the frequent transients use
  // above: events are minutes apart, so there's never more than one pending.
  // It gets the deepest send into the room of anything here — distant thunder
  // IS its reverberation; dry, it's just a filtered noise swell. ──
  function buildThunder(white, level, dest) {
    let nextAt = ctx.currentTime + 25 + Math.random() * 50
    const t = setInterval(() => {
      if (stopped || ctx.currentTime < nextAt) return
      const when = nextAt
      const dur = 3.2 + Math.random() * 2.4
      const src = ctx.createBufferSource()
      src.buffer = white
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 28
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 130 + Math.random() * 90
      const g = ctx.createGain()
      const peak = (0.042 + Math.random() * 0.032) * level
      g.gain.setValueAtTime(0.0001, when)
      g.gain.exponentialRampToValueAtTime(peak, when + 0.8 + Math.random() * 0.6) // a slow, distant roll-in
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
      const p = panner(ctx, Math.random() * 1.6 - 0.8)
      src.connect(hp)
      hp.connect(lp)
      lp.connect(g)
      g.connect(p)
      p.connect(dest)
      sendToRoom(p, 1.25)
      src.start(when, noiseOffset(white, dur + 0.3))
      src.stop(when + dur + 0.2)
      // a wobble on the cutoff so the rumble isn't static, retired with the roll
      driftFilter(lp, 40, 0.7 + Math.random() * 0.5, when + dur + 0.5)
      // rare, and only slightly more frequent the heavier the rain
      nextAt = when + (260 + Math.random() * 340) / (0.55 + 0.45 * level)
    }, 4000)
    timers.push(t)
  }

  // ── waves: slow surf; level=loudness, motion=swell size, pace=speed ──
  //
  // A wave is not one sound with one envelope. It is three events in sequence:
  // the swell approaching (low, broad, rising), the break (a burst of bright
  // splash), and — the part that makes an ear say "beach" — the retreat, a
  // high hiss draining back over sand for seconds after the water has gone.
  //
  // This layer used to run all of it through ONE gain and ONE filter sweep on
  // one timeline, so the highs peaked exactly when the loudness peaked and died
  // exactly when it died. That is a "woomp": swelling noise with a tonal wobble,
  // no break in it and no hiss behind it. It also ran strictly one wave at a
  // time (`nextAt = end`), which no coast has ever done, and dropped to near
  // silence in between, which made the whole layer pump.
  //
  // Now: a dark BODY on one shared envelope (swells are one continuous motion of
  // water — they genuinely don't stack), a bright FOAM chain with its OWN gain
  // node per wave, delayed past the crest and decaying for seconds, so the last
  // wave is still draining while the next one rises, and a quiet DISTANT bed
  // underneath so the troughs are a shoreline rather than a gap.
  function buildWaves(white, level, motion, pace, dest, swell) {
    // Body and foam share one noise source: their bands don't overlap (below
    // 420Hz against above 850Hz), so nothing correlates audibly and it saves two
    // buffer sources. The distant bed gets its own — it sits in the body's band,
    // and two enveloped-and-static copies of the same noise would comb.
    const src = stereoNoise(white, 1.0)

    const bhp = ctx.createBiquadFilter()
    bhp.type = 'highpass'
    bhp.frequency.value = 90
    const blp = ctx.createBiquadFilter()
    blp.type = 'lowpass'
    blp.frequency.value = 420
    const bg = ctx.createGain()
    // lower than it was: the distant bed below now carries the between-waves
    // sound, so the body no longer has to hold the floor up on its own
    const trough = 0.018 * level
    bg.gain.value = trough
    src.connect(bhp)
    bhp.connect(blp)
    blp.connect(bg)
    bg.connect(dest)
    sendToRoom(bg, 0.25)

    // The foam chain runs continuously; each wave opens its own gain on it.
    const fhp = ctx.createBiquadFilter()
    fhp.type = 'highpass'
    fhp.frequency.value = 850
    const flp = ctx.createBiquadFilter()
    flp.type = 'lowpass'
    flp.frequency.value = 4200
    src.connect(fhp)
    fhp.connect(flp)

    // Distant surf: always there, barely there. Fills the troughs so the layer
    // reads as a coast rather than as a tremolo, and gives the ear a horizon to
    // place the near waves against.
    const far = stereoNoise(white, 1.0, 0.9)
    const fahp = ctx.createBiquadFilter()
    fahp.type = 'highpass'
    fahp.frequency.value = 130
    const falp = ctx.createBiquadFilter()
    falp.type = 'lowpass'
    falp.frequency.value = 900
    const fag = ctx.createGain()
    fag.gain.value = 0.055 * level
    far.connect(fahp)
    fahp.connect(falp)
    falp.connect(fag)
    fag.connect(dest)
    sendToRoom(fag, 0.3)
    driftFilter(falp, 150, 0.02 * pace)

    let nextAt = ctx.currentTime + 0.8
    bg.gain.setValueAtTime(trough, nextAt)
    blp.frequency.setValueAtTime(300, nextAt)
    const t = setInterval(() => {
      if (stopped) return
      const ahead = ctx.currentTime + 12
      while (nextAt < ahead) {
        const t0 = nextAt
        // Sets: real swell arrives in groups, a few larger waves every few
        // minutes. One slow drift scales both size and period together.
        const set = clamp(1 + 0.35 * driftValue(swell, t0), 0.6, 1.45)
        // Bigger swell also travels slower — leaving Motion and Pace fully
        // orthogonal lets you dial waves that are huge AND fast, which is a
        // washing machine, not a sea.
        const period = (((9 + Math.random() * 5) / pace) * (0.88 + 0.12 * motion) * (0.9 + 0.15 * set))
        const crest = t0 + period * 0.42
        const peak = (0.4 + Math.random() * 0.22) * level * motion * set

        // Body: a slow rise that steepens into the crest (water standing up),
        // then a decay that is over well before the next swell begins.
        bg.gain.setValueAtTime(trough, t0)
        bg.gain.linearRampToValueAtTime(peak * 0.4, t0 + period * 0.26)
        bg.gain.linearRampToValueAtTime(peak, crest)
        bg.gain.exponentialRampToValueAtTime(Math.max(0.0002, trough), t0 + period * 0.78)
        blp.frequency.setValueAtTime(300, t0)
        blp.frequency.linearRampToValueAtTime(500 + Math.random() * 160, crest)
        blp.frequency.exponentialRampToValueAtTime(290, t0 + period * 0.78)

        // Foam: its own node, so it can still be hissing when the next wave
        // starts. Opens just before the body peaks — the break begins as the
        // wave stands up — snaps up fast, then drains for seconds.
        const fg = ctx.createGain()
        fg.gain.value = 0.0001
        const fp = panner(ctx, Math.random() * 1.1 - 0.55) // waves break along a front, not at one point
        flp.connect(fg)
        fg.connect(fp)
        fp.connect(dest)
        sendToRoom(fp, 0.5)
        const breakAt = crest - period * 0.06
        const drain = clamp(period * (0.45 + Math.random() * 0.2), 2.5, 7)
        const fv = (0.032 + Math.random() * 0.022) * level * motion * set
        fg.gain.setValueAtTime(0.0001, breakAt)
        fg.gain.exponentialRampToValueAtTime(fv, breakAt + 0.3 + Math.random() * 0.25)
        fg.gain.exponentialRampToValueAtTime(0.0001, breakAt + drain)
        // Nothing upstream of these ever stops, so they can never be collected
        // on their own — hand them to the sweeper once the drain is done. The
        // upstream edge has to go too: disconnect() clears a node's OUTPUTS, so
        // flp would otherwise keep feeding every wave's gain for the whole night.
        retire(breakAt + drain + 0.5, () => {
          flp.disconnect(fg)
          fg.disconnect()
          fp.disconnect()
        })

        // Overlap comes from the foam tails, not from stacking bodies: the next
        // swell begins while the last one is still draining.
        nextAt = t0 + period * (0.82 + Math.random() * 0.14)
      }
    }, 1000)
    timers.push(t)
  }

  // ── leaves: a soft hush of wind through foliage + occasional rustles ──
  // Foliage doesn't rustle on a timetable — it rustles when the wind moves it.
  // The rustles now read the same `weather` drift that is gusting the air, so
  // they arrive in clusters on a gust and go quiet in the lulls, and the layer's
  // own wind chain gusts with the rest of the scene rather than against it.
  //
  // Why Forest used to feel heavy: this layer is mostly WIND. Its internal wind
  // chain ran at level*0.5 through an 1100Hz low-pass — louder AND brighter than
  // the Wind layer's own (0.34*level, 860Hz) — so a forest blend carried two
  // wind beds, the larger of them hidden inside Leaves, with the rustles you
  // actually want to hear buried underneath. The hush now sits below Wind where
  // it belongs, and the rustles come through because less is on top of them.
  function buildLeaves(white, level, motion, pace, dest, weather) {
    buildWind(white, level * 0.34, 940, motion, pace, dest, weather)
    let nextAt = ctx.currentTime + 2
    const t = setInterval(() => {
      if (stopped) return
      const ahead = ctx.currentTime + 4
      while (nextAt < ahead) {
        const when = nextAt
        // The gust used to scale rustle loudness AND density by up to 1.9x at
        // once — a ~3.6x energy surge, which is a squall, not a stir. Halved.
        const gust = clamp(1 + 0.5 * driftValue(weather, when), 0.5, 1.55)
        const src = ctx.createBufferSource()
        src.buffer = white
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 1400 + Math.random() * 1400
        bp.Q.value = 0.8
        const g = ctx.createGain()
        const v = (0.028 + Math.random() * 0.032) * level * motion * gust
        const dur = 0.7 + Math.random() * 1.1
        g.gain.setValueAtTime(0.0001, when)
        g.gain.linearRampToValueAtTime(v, when + dur * 0.4)
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
        const p = panner(ctx, Math.random() * 1.4 - 0.7)
        src.connect(bp)
        bp.connect(g)
        g.connect(p)
        p.connect(dest)
        sendToRoom(p, 0.6)
        src.start(when, noiseOffset(white, dur + 0.2))
        src.stop(when + dur + 0.1)
        nextAt += (3 + Math.random() * 4.5) / (pace * gust)
      }
    }, 700)
    timers.push(t)
  }

  // ── stream: a continuous brook — steadier and higher than Waves (no big swell
  // envelope), with soft, frequent "bubble" transients rather than sparse drops.
  // Level makes it both louder AND busier, matching rain's own convention.
  // Deliberately left OUT of the shared weather: a brook is the steadiest thing
  // in a landscape, and coupling it to the wind is what would make the whole mix
  // breathe as one organism — the failure mode rule 4 is trying to avoid. ──
  function buildStream(white, level, motion, pace, dest) {
    const src = stereoNoise(white, 1.0)
    // Same trade as rain: the wash was 9dB over its own bubbles. Down in level
    // and down in centre frequency — 1600Hz at Q0.6 is a wide bright band that
    // reads as hiss; water heard from a few metres away is darker than that.
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1250
    bp.Q.value = 0.7
    const g = ctx.createGain()
    g.gain.value = 0.036 * level
    src.connect(bp)
    bp.connect(g)
    g.connect(dest)

    // a slow drift on the wash's centre so it's never perfectly static, while
    // staying steadier than Waves (no swelling gain envelope). Motion scales
    // its depth, same as every other layer's own drift/gust.
    driftFilter(bp, 220 * motion, 0.04 * pace)

    const busier = 1.5 - 0.6 * level // louder → more frequent bubbles
    let nextAt = ctx.currentTime + 0.3
    const t = setInterval(() => {
      if (stopped) return
      const ahead = ctx.currentTime + 1.2
      while (nextAt < ahead) {
        const when = nextAt
        const bubble = ctx.createBufferSource()
        bubble.buffer = white
        const bbp = ctx.createBiquadFilter()
        bbp.type = 'bandpass'
        bbp.frequency.value = 1450 + Math.random() * 1750
        bbp.Q.value = 2.2
        const dg = ctx.createGain()
        const v = (0.022 + Math.random() * 0.028) * level
        dg.gain.setValueAtTime(0.0001, when)
        dg.gain.exponentialRampToValueAtTime(v, when + 0.01)
        dg.gain.exponentialRampToValueAtTime(0.0001, when + 0.07 + Math.random() * 0.07)
        const p = panner(ctx, Math.random() * 1.6 - 0.8)
        bubble.connect(bbp)
        bbp.connect(dg)
        dg.connect(p)
        p.connect(dest)
        // a light send only: at ~13 bubbles a second the tails overlap heavily,
        // and a stream's wash should come from the water, not from the room
        sendToRoom(p, 0.2)
        bubble.start(when, noiseOffset(white, 0.3))
        bubble.stop(when + 0.3)
        // continuous babble — much more frequent than rain's droplets
        nextAt += ((0.04 + Math.random() * 0.12) * busier) / pace
      }
    }, 250)
    timers.push(t)
  }

  // ── chime: a sparse furin (wind chime) / distant temple-bell accent — a
  // single soft resonant tone now and then, never a melody or a repeating
  // pattern. Meant to sit over another layer, not be a scene on its own. ──
  const CHIME_NOTES = [587.33, 659.25, 698.46, 783.99, 880.0, 987.77]
  function buildChime(level, pace, dest) {
    const busier = 1.6 - 0.7 * level // louder → a little more frequent
    let nextAt = ctx.currentTime + 6 + Math.random() * 8
    const t = setInterval(() => {
      if (stopped) return
      const ahead = ctx.currentTime + 6
      while (nextAt < ahead) {
        const when = nextAt
        const f = CHIME_NOTES[(Math.random() * CHIME_NOTES.length) | 0]
        const g = ctx.createGain()
        const v = (0.038 + Math.random() * 0.024) * level
        g.gain.setValueAtTime(0.0001, when)
        g.gain.exponentialRampToValueAtTime(v, when + 0.015)
        g.gain.exponentialRampToValueAtTime(0.0001, when + 2.2 + Math.random() * 1.2)
        const p = panner(ctx, Math.random() * 1.4 - 0.7)
        g.connect(p)
        p.connect(dest)
        sendToRoom(p, 0.85)
        // fundamental + a slightly inharmonic partial for a metallic, glassy
        // quality rather than a clean musical tone
        const osc1 = ctx.createOscillator()
        osc1.type = 'sine'
        osc1.frequency.value = f
        osc1.connect(g)
        osc1.start(when)
        osc1.stop(when + 3.6)
        const osc2 = ctx.createOscillator()
        osc2.type = 'sine'
        osc2.frequency.value = f * 2.76
        const g2 = ctx.createGain()
        g2.gain.value = 0.3
        osc2.connect(g2)
        g2.connect(g)
        osc2.start(when)
        osc2.stop(when + 3.6)
        nextAt += ((8 + Math.random() * 17) * busier) / pace
      }
    }, 3000)
    timers.push(t)
  }

  async function start({ totalSec, elapsedSec = 0, mix, fadeIn = FADE_IN_SEC, stereo: stereoOpt = true }) {
    const p = resolveMix(mix)
    if (p.master <= 0) return
    stereo = stereoOpt

    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    // 'playback' asks the browser for a larger output buffer than the default
    // 'interactive' — far more resistant to audio-thread underruns (the "dusty
    // vinyl" crackle heard on weaker mobile CPUs over Bluetooth), and latency is
    // irrelevant for a sleep soundscape.
    ctx = new Ctx({ latencyHint: 'playback' })
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {})
    stopped = false

    // Belt-and-suspenders alongside resume() (called on visibilitychange):
    // some background/screen-lock paths suspend the context without ever
    // firing a visibility event we'd catch in time (or on a schedule loose
    // enough — see the Media Session note in Session.jsx — that a stray
    // suspension goes unnoticed for a while). Poll and self-heal directly
    // rather than depending solely on that one signal.
    timers.push(
      setInterval(() => {
        if (!stopped && ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
      }, 3000),
    )

    master = ctx.createGain()
    master.gain.value = 0.0001
    // A transparent brick-wall safety limiter on the final output, so no extreme
    // blend of layers + volume can sum past 0dBFS and clip. Below threshold (so
    // inaudible) for any sane mix; only catches peaks. (Backported from Touch Grass.)
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -2
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.003
    limiter.release.value = 0.25
    master.connect(limiter)
    limiter.connect(ctx.destination)

    // One global brightness low-pass everything passes through.
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = p.toneHz
    tone.connect(master)

    // Long enough that the underlying loop period is never consciously
    // audible over a real session (15-90min): a short clip repeating
    // thousands of times can start to reveal itself even as white/pink
    // noise. 30/26s, with every source reading from its own random offset,
    // puts the repeat count low enough that per-layer drift and the
    // constantly-randomised transient layers are what a listener actually
    // notices, not the loop.
    const white = makeWhiteBuffer(ctx, 30)
    const pink = makePinkBuffer(ctx, 26)

    // Only pay for the convolver when something transient is actually in the
    // blend — a wind-and-drone night has nothing to put in a room.
    if (p.rain > 0 || p.waves > 0 || p.leaves > 0 || p.stream > 0 || p.chime > 0) buildRoom(p.toneHz)

    // The scene's shared weather (rule 4) and, under it, the much slower swell
    // and lull of the rain itself. Both are made only when something reads them.
    const needsWeather = p.wind > 0 || p.leaves > 0 || p.rain > 0
    const weather = needsWeather ? createDrift(0.045 * p.pace) : null
    const shower = p.rain > 0 ? createDrift(0.006 * p.pace) : null
    // the slow grouping of swell into sets
    const swellSets = p.waves > 0 ? createDrift(0.005 * p.pace) : null
    timers.push(setInterval(tick, 1000))

    if (p.warmth > 0) buildWarmth(pink, p.warmth, tone)
    if (p.drone > 0) buildDrone(p.drone, tone)
    if (p.wind > 0) buildWind(white, 0.27 * p.wind, 860, p.motion, p.pace, tone, weather)
    if (p.rain > 0) buildRain(white, p.rain, p.pace, tone, weather, shower)
    if (p.rain > 0) buildThunder(white, p.rain, tone)
    if (p.waves > 0) buildWaves(white, p.waves, p.motion, p.pace, tone, swellSets)
    if (p.stream > 0) buildStream(white, p.stream, p.motion, p.pace, tone)
    if (p.leaves > 0) buildLeaves(white, p.leaves, p.motion, p.pace, tone, weather)
    if (p.chime > 0) buildChime(p.chime, p.pace, tone)

    scheduleEnvelope(p.master, totalSec, elapsedSec, fadeIn)
  }

  function setBreath(scale) {
    if (stopped || !bedGain || !ctx) return
    const s = clamp01(scale)
    bedGain.gain.setTargetAtTime(bedBase * (0.78 + 0.22 * s), ctx.currentTime, 0.35)
  }

  // Revive a context the browser suspended while backgrounded — on iOS Safari the
  // AudioContext is suspended whenever the tab is hidden / the screen locks (the
  // exact "Turn off and listen till I sleep" flow), and it doesn't come back on
  // its own. Call this when the page becomes visible again. No-op otherwise.
  function resume() {
    if (stopped || !ctx || ctx.state !== 'suspended') return
    ctx.resume().catch(() => {})
  }

  // Always release with a gentle fade — the sound must flow out, never cut,
  // whatever the mixer is set to. `release` (s) is the fade length.
  function stop(release = 1.8) {
    if (stopped) return
    stopped = true
    timers.forEach(clearInterval)
    timers = []
    drifts = []
    retiring = []
    reverbIn = null
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

  return { start, setBreath, stop, resume }
}
