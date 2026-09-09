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

// A struck chime's partials, as [ratio, relative amplitude]. Inharmonic on
// purpose: a glassy, metallic quality rather than a clean musical one. Each
// decays at ring / ratio^CHIME_DAMPING, so the high partials leave first and
// the tone darkens as it rings out — which is what makes metal sound like
// metal, and what a single shared envelope can never do.
export const CHIME_PARTIALS = [
  [1, 1],
  [2.76, 0.35],
  [5.4, 0.12],
]
export const CHIME_DAMPING = 0.7

// ── Playback voicing ────────────────────────────────────────────────────────
// What the low end should do depends on what is reproducing it.
//
// `headphones` is the reference tuning and changes nothing. `speaker` is for a
// small SPEAKER WITH A WOOFER IN A PORTED BOX — the IKEA ENEBY 20 this was
// measured against is 1x 3.2" woofer + 1x 1" soft dome tweeter, rear reflex
// port, 15W + 5W, and IKEA's manual claims 48Hz-20kHz.
//
// That capability is why this profile is DELIBERATELY SLIGHT. An earlier cut
// assumed a tiny sealed portable and high-passed the master at 120Hz while
// shifting the swell, the drone and thunder up whole octaves. On a box like
// this that is destructive: it throws away real, audible bass — precisely the
// swell depth the layers are tuned to deliver. Guessing at a speaker's response
// and voicing around the guess is worse than leaving it alone.
//
// What a ported box genuinely wants is a SUBSONIC filter. Below the port's
// tuning the woofer unloads: excursion climbs steeply, acoustic output does
// not, and what you get is distortion and port noise rather than bass. Yoru
// puts sustained energy down there (thunder starts at 28Hz), so cutting it
// costs nothing audible and buys clean headroom for everything above.
//
// Note what this profile does NOT claim to fix. At bedtime volume the ear's own
// low-frequency sensitivity falls away — that is equal-loudness, not the
// speaker, and no high-pass addresses it. See LOW-END AT LOW VOLUME in YORU.md.
export const VOICINGS = {
  headphones: {
    masterHp: 0, // no global high-pass — let the bottom two octaves through
    warmthHp: 95,
    droneNotes: [110, 164.81], // a fifth
    droneHp: 110,
    droneLp: 300,
    thunderHp: 28,
    thunderLp: 130,
    thunderLpSpread: 90,
    wavesHp: 70,
    wavesLp: 300,
    wavesLpCrest: 1000,
    wavesLpSpread: 380,
    wavesLpEnd: 260,
  },
  speaker: {
    // The ONLY difference. Below the port's likely tuning the woofer unloads —
    // excursion climbs, output doesn't — so this buys clean headroom and costs
    // nothing audible. Everything else is left exactly as the reference tuning
    // has it, because this speaker can reproduce it and guessing otherwise is
    // how the first cut of this profile ended up throwing away real bass.
    masterHp: 55,
    warmthHp: 95,
    droneNotes: [110, 164.81],
    droneHp: 110,
    droneLp: 300,
    thunderHp: 28,
    thunderLp: 130,
    thunderLpSpread: 90,
    wavesHp: 70,
    wavesLp: 300,
    wavesLpCrest: 1000,
    wavesLpSpread: 380,
    wavesLpEnd: 260,
  },
}

// A noise bed's trim. Applied in BOTH the stereo and the mono path, so the
// stereo toggle changes width and nothing else. It used to sit only on the
// stereo path, on the reasoning that two incoherent sources sum to ~+3dB and
// need taking down — but StereoPannerNode is equal-power, so each channel
// already receives exactly unity from a decorrelated pair. The trim therefore
// made stereo 3dB QUIETER than mono rather than level-matched, and since only
// the beds go through here and the transients don't, flipping to mono also
// lifted every wash ~3dB against its own droplets and bubbles — undoing the
// wash/event ratio the layers are tuned around.
export const BED_TRIM = 0.7

// ── Loudness compensation ───────────────────────────────────────────────────
// The ear is not a flat instrument, and it gets less flat the quieter things
// get. Between a normal listening level and a bedtime one, the bottom two
// octaves fall roughly 10-15dB RELATIVE to the midrange — the equal-loudness
// contours (ISO 226 / Fletcher-Munson). That is a property of hearing, not of
// the speaker or the mix, and it is the best explanation for a complaint this
// app kept producing: the wave foam sits at 600-1900Hz, near where the ear is
// most sensitive, while the swell it competes with is weighted low and fading
// fastest as you turn down. No filter on the source side fixes that.
//
// A low shelf that rises as Volume falls does — the hi-fi "loudness" button.
// Note the reference point: Yoru's own ceiling is 0.24, about -12dBFS, so even
// its Volume 10 is not a loud listening level. That is why the curve still
// lifts a little at the top of the range rather than reaching zero there.
export const LOUDNESS_HZ = 250
export const LOUDNESS_MAX_DB = 8
export const loudnessLiftDb = (v) => LOUDNESS_MAX_DB * (1 - 0.75 * clamp01(v))

// ── Brightness as distance ──────────────────────────────────────────────────
// Brightness on its own models exactly one distance cue, high-frequency air
// absorption, and models it as a cliff. The ear doesn't read a cliff as
// distance; it reads it as the same source with something over it. The cue that
// actually carries distance is the DIRECT-TO-REVERBERANT RATIO: further away,
// proportionally more room and less source.
//
// So a dark setting now also opens the sends. Only the wet side moves — the dry
// is left alone deliberately, because pulling it down to complete the picture
// would make exactly the blends that want to sound far also sound quiet, and
// they are already the quiet ones.
export const distanceSend = (b) => Math.min(2.2, 1 + 1.3 * Math.pow(1 - clamp01(b), 1.2))

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

// Generating the two noise beds is ~2.7M random draws and ~11MB of allocation.
// Settings rebuilds the WHOLE soundscape on every debounced mixer change, so
// paying that on each one made dragging a slider needlessly expensive on a
// phone — and it got worse when the white bed grew from 20s to 30s. An
// AudioBuffer is not bound to the context that created it (the spec has it
// usable by one or more contexts, it only has to match the sample rate), so
// generate each pair once per rate and keep it for the page's life: bounded
// memory instead of a fresh 11MB every 140ms. Falls back to generating fresh
// if anything about that goes wrong.
const noiseBeds = new Map()
function sharedNoise(ctx) {
  const fresh = () => ({ white: makeWhiteBuffer(ctx, 30), pink: makePinkBuffer(ctx, 26) })
  try {
    let beds = noiseBeds.get(ctx.sampleRate)
    if (!beds) {
      beds = fresh()
      noiseBeds.set(ctx.sampleRate, beds)
    }
    return beds
  } catch {
    return fresh()
  }
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

export function resolveMix(mix) {
  const nv = (k) => clamp01((mix && typeof mix[k] === 'number' ? mix[k] : 0) / 10)
  const gv = (k) => taper(nv(k), LAYER_TAPER) // a layer's own level, perceptually tapered
  return {
    // Volume: 0 is now true silence (taper(0,_)=0), and the steep taper gives it
    // a real "audio knob" feel instead of a linear one. 0.24 ceiling (was 0.18)
    // after the first taper pass came back reporting the whole mix too quiet.
    master: taper(nv('volume'), VOLUME_TAPER) * 0.24,
    // the untapered 0..1 readings, for the two curves that are about
    // PERCEPTION rather than gain: loudness compensation and distance
    vol: nv('volume'),
    bright: nv('brightness'),
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
  let voice = VOICINGS.headphones // playback voicing, set from start()'s option
  let roomSend = 1 // how far away the scene is, from Brightness (see distanceSend)

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
  function createDrift(rateHz) {
    // Degrade to "no drift" rather than "no sound": every caller is null-safe,
    // so on a browser without ConstantSourceNode the soundscape comes up a
    // little more static instead of throwing out of start() into silence.
    if (!ctx.createConstantSource) return null
    const src = ctx.createConstantSource()
    src.offset.value = 0
    const d = { src, rateHz: Math.max(0.001, rateHz), walk: 0, segs: [], nextAt: ctx.currentTime }
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

  const driftParam = (param, depth, rateHz) => link(createDrift(rateHz), param, depth)
  const driftFilter = (filter, depthHz, rateHz) => driftParam(filter.frequency, depthHz, rateHz)
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

  // Keep every drift's automation topped up. Every drift is created once, at
  // build time, and lives as long as the session — nothing here creates one
  // per event, so this list is small and fixed.
  function tickDrifts() {
    if (stopped || !ctx) return
    const until = ctx.currentTime + DRIFT_AHEAD
    for (const d of drifts) advanceDrift(d, until)
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
    g.gain.value = amount * roomSend
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
    hp.frequency.value = voice.warmthHp
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
    lp.frequency.value = voice.droneLp
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = voice.droneHp
    const g = ctx.createGain()
    g.gain.value = level * 0.032
    hp.connect(lp)
    lp.connect(g)
    g.connect(dest)
    voice.droneNotes.forEach((f, i) => {
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
  // as wide and enveloping rather than a mono point in the middle of your head.
  // With stereo off: a single centred source, through the same BED_TRIM, so the
  // toggle costs width and not 3-4dB of level. (Backported from Touch Grass.)
  //
  // Offsets, not the ±1.5% playback-rate detune this replaces: two copies of one
  // buffer at slightly different rates start ALIGNED and slide apart, which
  // means they also slide back together — on a 20s buffer at ±1.5% the image
  // collapsed to near-mono and re-widened every ~11 minutes, a perfectly
  // periodic breathing of the stereo width. Fixed offsets never re-converge,
  // cost no resampling, and are decorrelated from the first sample.
  function stereoNoise(buffer, rate = 1, spread = 0.6) {
    const merge = ctx.createGain()
    merge.gain.value = BED_TRIM
    if (!stereo) {
      const s = loopSource(ctx, buffer)
      s.playbackRate.value = rate
      s.start(0, noiseOffset(buffer, 0))
      s.connect(merge)
      nodes.push(s)
      return merge
    }
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
  // IS its reverberation; dry, it's just a filtered noise swell.
  //
  // Thunder ROLLS. A lightning channel is kilometres long, so its sound reaches
  // you as a train of arrivals from successively further parts of the channel,
  // re-scattered by terrain — several irregular crests over 6-12s, not one
  // swell with one attack and one decay, which is what this was and why it read
  // as a filtered noise blob rather than as weather.
  //
  // The trap when splitting one burst into several: at the old per-burst level
  // five of them is +7dB, and each would feed a send that is already the
  // deepest in the file. So they sum into ONE gain and ONE send, the first
  // (nearest) crest is the loudest at 0.9x the old single peak, and the rest
  // fall away — instantaneous loudness slightly DOWN, duration up, which is
  // what a real roll does. The per-event filter wobble is gone too: the
  // multi-crest structure is the irregularity that drift was standing in for. ──
  function buildThunder(white, level, dest, shower) {
    let nextAt = ctx.currentTime + 25 + Math.random() * 50
    const t = setInterval(() => {
      if (stopped || ctx.currentTime < nextAt) return
      const when = nextAt
      // heavier rain, a slightly bigger and more frequent storm — thunder rides
      // the same slow drift the rain's own intensity does, so a squall and its
      // thunder belong to one weather system rather than two clocks
      const heavy = clamp(1 + 0.3 * driftValue(shower, when), 0.7, 1.4)
      const roll = 6 + Math.random() * 6
      const peak = (0.042 + Math.random() * 0.032) * level * heavy

      const out = ctx.createGain()
      out.gain.value = 1
      const p = panner(ctx, Math.random() * 1.6 - 0.8)
      out.connect(p)
      p.connect(dest)
      sendToRoom(p, 1.25)

      const crests = 3 + ((Math.random() * 4) | 0)
      for (let i = 0; i < crests; i++) {
        // the first crest arrives at the strike; the rest scatter across the roll
        const at = i === 0 ? when : when + Math.random() * roll * 0.75
        const grow = 0.35 + Math.random() * 0.7
        const fall = 1.6 + Math.random() * 2.4
        const w = i === 0 ? 0.9 : 0.22 + Math.random() * 0.4
        const src = ctx.createBufferSource()
        src.buffer = white
        const hp = ctx.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.value = voice.thunderHp
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        // later arrivals came further and through more air: darker
        lp.frequency.value =
          (voice.thunderLp + Math.random() * voice.thunderLpSpread) * (i === 0 ? 1 : 0.6 + Math.random() * 0.3)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, at)
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * w), at + grow)
        g.gain.exponentialRampToValueAtTime(0.0001, at + grow + fall)
        src.connect(hp)
        hp.connect(lp)
        lp.connect(g)
        g.connect(out)
        src.start(at, noiseOffset(white, grow + fall + 0.3))
        src.stop(at + grow + fall + 0.2)
      }
      // rare, and only slightly more frequent the heavier the rain
      nextAt = when + (260 + Math.random() * 340) / (0.55 + 0.45 * level) / heavy
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
    // 70Hz, not 90: a swell's weight is in the bottom two octaves, and the
    // "rising and receding" you feel as depth is largely low-frequency motion.
    bhp.frequency.value = voice.wavesHp
    const blp = ctx.createBiquadFilter()
    blp.type = 'lowpass'
    blp.frequency.value = voice.wavesLp
    const bg = ctx.createGain()
    // lower than it was: the distant bed below now carries the between-waves
    // sound, so the body no longer has to hold the floor up on its own
    const trough = 0.011 * level
    bg.gain.value = trough
    src.connect(bhp)
    bhp.connect(blp)
    blp.connect(bg)
    bg.connect(dest)
    sendToRoom(bg, 0.25)

    // The foam chain runs continuously; each wave opens its own gain on it.
    // 700-2500Hz, not 850-4200. The upper half of that first range is the
    // presence/harshness band, and flat noise across it doesn't read as water
    // draining over sand — it reads as pebbles poured out of a sack.
    //
    // TWO bright chains, not one, because they do different jobs and conflating
    // them is what went wrong here three times running:
    //
    //   BREAK — short, wide, loud. The crash as the wave stands up and falls in.
    //           This is what "force" is, and it lasts about a second.
    //   DRAIN — long, narrow, quiet. Water retreating over sand for seconds
    //           after. SUSTAINED energy in this band is what reads as pebbles
    //           poured out of a sack.
    //
    // One envelope used to do both, so every instruction to take the pebbles
    // down took the break with it. Three cuts in a row left 0.1% of this
    // layer's energy above 1kHz — no break at all, and so no force.
    //
    // They read the same noise source on purpose: the break and the retreat are
    // the same water. They barely overlap in time in any case.
    const khp = ctx.createBiquadFilter()
    khp.type = 'highpass'
    khp.frequency.value = 500
    const klp = ctx.createBiquadFilter()
    klp.type = 'lowpass'
    klp.frequency.value = 3000
    src.connect(khp)
    khp.connect(klp)

    const fhp = ctx.createBiquadFilter()
    fhp.type = 'highpass'
    fhp.frequency.value = 600
    const flp = ctx.createBiquadFilter()
    flp.type = 'lowpass'
    flp.frequency.value = 1900
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
    // Half what it was. Filling the troughs was meant to stop the layer pumping
        // to near-silence; at 0.055 it instead lifted the between-waves floor 9dB
    // and took 10dB out of the swell's dynamic range — which is the whole reason
    // waves read as individual events. A horizon should be audible and no more.
    const fag = ctx.createGain()
    fag.gain.value = 0.019 * level
    far.connect(fahp)
    fahp.connect(falp)
    falp.connect(fag)
    fag.connect(dest)
    sendToRoom(fag, 0.3)
    driftFilter(falp, 150, 0.02 * pace)
    driftGain(fag, 0.006 * level, 0.015 * pace) // a static bed is a hiss floor; let it breathe

    let nextAt = ctx.currentTime + 0.8
    bg.gain.setValueAtTime(trough, nextAt)
    blp.frequency.setValueAtTime(voice.wavesLp, nextAt)
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
        const peak = (0.62 + Math.random() * 0.34) * level * motion * set

        // Body: a slow rise that steepens into the crest (water standing up),
        // then a decay that is over well before the next swell begins.
        bg.gain.setValueAtTime(trough, t0)
        // A longer, lower start and a longer recede: the swell should be
        // audibly ARRIVING and audibly LEAVING, which needs both ends of the
        // envelope to take real time rather than snapping between trough and peak.
        bg.gain.linearRampToValueAtTime(peak * 0.3, t0 + period * 0.24)
        bg.gain.linearRampToValueAtTime(peak, crest)
        bg.gain.exponentialRampToValueAtTime(Math.max(0.0002, trough), t0 + period * 0.86)
        // A wider sweep than before (240 -> ~700 -> 230). More of what reads as a
        // wave approaching and passing is this, not the gain: the water gets
        // brighter as it nears and duller as it draws back.
        blp.frequency.setValueAtTime(voice.wavesLp, t0)
        blp.frequency.linearRampToValueAtTime(voice.wavesLpCrest + Math.random() * voice.wavesLpSpread, crest)
        blp.frequency.exponentialRampToValueAtTime(voice.wavesLpEnd, t0 + period * 0.86)

        // Foam: its own node, so it can still be hissing when the next wave
        // starts. Opens just before the body peaks — the break begins as the
        // wave stands up — snaps up fast, then drains for seconds.
        // one panner for the whole wave — a break and its own retreat happen in
        // the same place along the shore
        const fp = panner(ctx, Math.random() * 1.1 - 0.55) // waves break along a front, not at one point
        fp.connect(dest)
        sendToRoom(fp, 0.3)
        const fg = ctx.createGain()
        fg.gain.value = 0.0001
        flp.connect(fg)
        fg.connect(fp)
        const kg = ctx.createGain()
        kg.gain.value = 0.0001
        klp.connect(kg)
        kg.connect(fp)
        const breakAt = crest - period * 0.06
        // Shorter than it was: a drain lasting half the period left the last wave
        // still hissing as the next rose, and the layer stopped reading as a
        // sequence of waves at all. The overlap this exists for only needs to
        // reach the next swell's RISE, not its break.
        const drain = clamp(period * (0.24 + Math.random() * 0.1), 1.6, 4.5)
        const fv = (0.016 + Math.random() * 0.011) * level * motion * set
        fg.gain.setValueAtTime(0.0001, breakAt)
        fg.gain.exponentialRampToValueAtTime(Math.max(0.0002, fv), breakAt + 0.3 + Math.random() * 0.25)
        fg.gain.exponentialRampToValueAtTime(0.0001, breakAt + drain)

        // The break. Short is the whole point: about a second of it reads as
        // impact, where the same energy stretched over the drain's length reads
        // as grit. Wider than the drain too (500-3000Hz), because a crash is
        // broadband and a retreat is not.
        const kv = (0.045 + Math.random() * 0.03) * level * motion * set
        const hit = 0.12 + Math.random() * 0.13
        const fall = 0.7 + Math.random() * 0.6
        kg.gain.setValueAtTime(0.0001, breakAt)
        kg.gain.exponentialRampToValueAtTime(Math.max(0.0002, kv), breakAt + hit)
        kg.gain.exponentialRampToValueAtTime(0.0001, breakAt + hit + fall)
        // Nothing upstream of these ever stops, so they can never be collected
        // on their own — hand them to the sweeper once the drain is done. The
        // upstream edge has to go too: disconnect() clears a node's OUTPUTS, so
        // flp would otherwise keep feeding every wave's gain for the whole night.
        retire(breakAt + Math.max(drain, hit + fall) + 0.5, () => {
          flp.disconnect(fg)
          klp.disconnect(kg)
          fg.disconnect()
          kg.disconnect()
          fp.disconnect()
        })

        // Overlap comes from the foam tails, not from stacking bodies: the next
        // swell begins while the last one is still draining.
        nextAt = t0 + period * (0.9 + Math.random() * 0.14)
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
        // NOT a resonant bandpass. It used to be one, at Q1.0 somewhere in
        // 1600-3200Hz — and crucially it was built once per RUSTLE, so every
        // tick in a burst shared the same centre and therefore the same pitch.
        // A train of same-pitched chirps in the 2-4kHz band is, precisely,
        // chittering: that is where insects and small birds live. Leaf contact
        // has no pitch at all. A plain high-pass/low-pass pair leaves the ticks
        // broadband and dry, and each one then differs on its own, because each
        // gates a different slice of the noise running underneath.
        const lhp = ctx.createBiquadFilter()
        lhp.type = 'highpass'
        lhp.frequency.value = 500 + Math.random() * 300
        const llp = ctx.createBiquadFilter()
        llp.type = 'lowpass'
        llp.frequency.value = 4200 + Math.random() * 2200
        const g = ctx.createGain()
        g.gain.value = 0.0001
        // GRANULAR, not a swelled blob. A rustle is not one soft whoosh — it is
        // dozens of individual leaf-on-leaf contacts, each a very short tick.
        // Shape is why this layer stayed buried: the rustles share a band with
        // the hush they sit on, so a smooth burst can never separate from it at
        // any level, while a cluster of ticks separates at almost none.
        //
        // One noise source with many scheduled spikes, NOT one source per tick:
        // 30 sources per rustle would be ~8 new nodes a second on top of the
        // convolver, and this sounds the same for the node cost of the blob it
        // replaces. Ticks ride an overall arc so the burst swells and dies.
        const dur = 0.7 + Math.random() * 1.1
        // +2.4dB over the previous constant, which is exactly what the new
        // shape costs (measured, not guessed): denser but much shorter ticks in
        // a wider band, with most of them quiet. Shape change, level unchanged —
        // getting this wrong is silent, since the diff looks like character.
        const v = (0.16 + Math.random() * 0.18) * level * motion * gust
        // ~90-110 ticks a second, not ~27. Under about 50Hz a pulse train is
        // heard AS a train — flutter, buzz, an insect; past it the pulses fuse
        // into texture and you hear the material instead of the rhythm.
        const ticks = 90 + ((Math.random() * 90) | 0)
        let tick = when
        for (let i = 0; i < ticks && tick < when + dur; i++) {
          const span = 0.002 + Math.random() * 0.004
          const arc = Math.sin((Math.PI * (tick - when)) / dur) // 0 at the ends, 1 in the middle
          // a power law, not a uniform spread: a rustle is many small contacts,
          // most of them faint, a few of them not. Uniform amplitudes are what
          // make a tick train sound mechanical.
          const a = Math.max(0.0002, v * arc * Math.pow(Math.random(), 2.2))
          g.gain.setValueAtTime(0.0001, tick)
          g.gain.linearRampToValueAtTime(a, tick + span * 0.35)
          g.gain.exponentialRampToValueAtTime(0.0001, tick + span)
          // gaps cluster too — mostly tight, occasionally a pause. Leaves are
          // struck in bursts as the air moves through them, and an even spacing
          // is the other half of what reads as an animal.
          tick += span + Math.pow(Math.random(), 1.6) * (dur / ticks) * 2.2
        }
        const p = panner(ctx, Math.random() * 1.4 - 0.7)
        src.connect(lhp)
        lhp.connect(llp)
        llp.connect(g)
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
        const p = panner(ctx, Math.random() * 1.6 - 0.8)
        p.connect(dest)
        // a light send only: at ~10 bubbles a second the tails overlap heavily,
        // and a stream's wash should come from the water, not from the room
        sendToRoom(p, 0.2)
        if (Math.random() < 0.2) {
          // ── a RESONANT bubble, one in five ──
          // A bubble in water is a damped oscillator whose pitch RISES as it
          // shrinks and ascends (Minnaert: f ≈ 3.26/r, so 1-5mm gives roughly
          // 650-3300Hz). That upward chirp is the single most recognisable
          // thing about running water and no amount of filtered noise has it.
          //
          // Only one in five, though. A brook is mostly broadband splash with
          // resonance as a minority voice, and a stream of pure tones would be
          // both wrong and — the thing that matters here — attention-grabbing.
          const f0 = 800 + Math.random() * 1800
          const dur = 0.03 + Math.random() * 0.06
          const osc = ctx.createOscillator()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(f0, when)
          osc.frequency.exponentialRampToValueAtTime(f0 * (1.15 + Math.random() * 0.25), when + dur)
          const cg = ctx.createGain()
          // x0.22, not the noise burst's own level: a sine keeps 0.707 of its
          // gain as RMS where that bandpassed burst keeps 0.121, so reusing the
          // constant would put the brook's events 15dB up in one commit.
          const cv = (0.005 + Math.random() * 0.004) * level
          cg.gain.setValueAtTime(0.0001, when)
          cg.gain.exponentialRampToValueAtTime(cv, when + 0.004)
          cg.gain.exponentialRampToValueAtTime(0.0001, when + dur)
          osc.connect(cg)
          cg.connect(p)
          osc.start(when)
          osc.stop(when + dur + 0.05)
          // deliberately NOT pushed to `nodes` (as chime's oscillators aren't):
          // it stops itself, and at ~2 a second the array would carry ~11k dead
          // entries by morning for no reason
        } else {
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
          bubble.connect(bbp)
          bbp.connect(dg)
          dg.connect(p)
          bubble.start(when, noiseOffset(white, 0.3))
          bubble.stop(when + 0.3)
        }
        // continuous babble — much more frequent than rain's droplets
        nextAt += ((0.04 + Math.random() * 0.12) * busier) / pace
      }
    }, 250)
    timers.push(t)
  }

  // ── chime: a sparse furin (wind chime) / distant temple-bell accent — a
  // single soft resonant tone now and then, never a melody or a repeating
  // pattern. Meant to sit over another layer, not be a scene on its own.
  //
  // What makes struck metal sound like metal is that its partials decay at
  // DIFFERENT rates — the high ones die first, which is why a bell's timbre
  // darkens as it rings out. Both oscillators used to share one envelope, so
  // the spectrum never changed and it read as a synth tone with a bell-ish
  // ratio in it. Each partial now gets its own decay (roughly 1/f^0.7), plus a
  // brief noise transient for the strike and a second detuned oscillator on the
  // fundamental for the slow warble real chimes have. ──
  const CHIME_NOTES = [587.33, 659.25, 698.46, 783.99, 880.0, 987.77]
  function buildChime(white, level, pace, dest) {
    const busier = 1.6 - 0.7 * level // louder → a little more frequent
    let nextAt = ctx.currentTime + 6 + Math.random() * 8
    const t = setInterval(() => {
      if (stopped) return
      const ahead = ctx.currentTime + 6
      while (nextAt < ahead) {
        const when = nextAt
        const f = CHIME_NOTES[(Math.random() * CHIME_NOTES.length) | 0]
        // Level is held where it was: the partial amplitudes are normalised so
        // the sum's RMS at the strike matches the old pair's, and everything
        // after the strike is quieter because the top partials leave early.
        const v = (0.038 + Math.random() * 0.024) * level
        const ring = 2.2 + Math.random() * 1.2
        const p = panner(ctx, Math.random() * 1.4 - 0.7)
        p.connect(dest)
        sendToRoom(p, 0.85)

        for (const [ratio, amp] of CHIME_PARTIALS) {
          const decay = ring / Math.pow(ratio, CHIME_DAMPING) // high partials die first
          const g = ctx.createGain()
          g.gain.setValueAtTime(0.0001, when)
          g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v * amp), when + 0.015)
          g.gain.exponentialRampToValueAtTime(0.0001, when + decay)
          g.connect(p)
          // the fundamental gets a second, slightly detuned voice so it beats
          // slowly the way a hanging chime does
          const voices = ratio === 1 ? [-2.5, 2.5] : [0]
          for (const cents of voices) {
            const osc = ctx.createOscillator()
            osc.type = 'sine'
            osc.frequency.value = f * ratio
            osc.detune.value = cents
            const vg = ctx.createGain()
            vg.gain.value = voices.length > 1 ? 0.5 : 1
            osc.connect(vg)
            vg.connect(g)
            osc.start(when)
            osc.stop(when + decay + 0.2)
          }
        }

        // the strike itself: a very short filtered click, the clapper on metal.
        // Quiet — it only has to give the tone an onset, not an attack.
        const click = ctx.createBufferSource()
        click.buffer = white
        const cbp = ctx.createBiquadFilter()
        cbp.type = 'bandpass'
        cbp.frequency.value = f * 3.2
        cbp.Q.value = 1.2
        const cg = ctx.createGain()
        cg.gain.setValueAtTime(0.0001, when)
        cg.gain.exponentialRampToValueAtTime(v * 0.5, when + 0.002)
        cg.gain.exponentialRampToValueAtTime(0.0001, when + 0.03)
        click.connect(cbp)
        cbp.connect(cg)
        cg.connect(p)
        click.start(when, noiseOffset(white, 0.1))
        click.stop(when + 0.1)

        nextAt += ((8 + Math.random() * 17) * busier) / pace
      }
    }, 3000)
    timers.push(t)
  }

  async function start({
    totalSec,
    elapsedSec = 0,
    mix,
    fadeIn = FADE_IN_SEC,
    stereo: stereoOpt = true,
    voicing = 'headphones',
    loudness = false,
  }) {
    const p = resolveMix(mix)
    if (p.master <= 0) return
    stereo = stereoOpt
    voice = VOICINGS[voicing] ?? VOICINGS.headphones
    roomSend = distanceSend(p.bright)

    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    // 'playback' asks the browser for a larger output buffer than the default
    // 'interactive' — far more resistant to audio-thread underruns (the "dusty
    // vinyl" crackle heard on weaker mobile CPUs over Bluetooth), and latency is
    // irrelevant for a sleep soundscape.
    // A browser that refuses another context (Safari caps how many can exist,
    // and Settings churns through them while you drag a slider) must leave the
    // night silent, not throw an unhandled rejection out of start().
    try {
      ctx = new Ctx({ latencyHint: 'playback' })
    } catch {
      ctx = null
      return
    }
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
    // master -> [loudness shelf] -> [voicing high-pass] -> limiter -> out.
    // Order matters both ways: the shelf lifts before the high-pass, so the
    // high-pass still strips the subsonic content it just boosted; and both sit
    // before the limiter, so a lifted low end is caught rather than clipped.
    let chain = master
    if (loudness) {
      const shelf = ctx.createBiquadFilter()
      shelf.type = 'lowshelf'
      shelf.frequency.value = LOUDNESS_HZ
      // static, from the Volume SETTING — not from master.gain, which is being
      // automated through the fade-in and the ebb to silence all night
      shelf.gain.value = loudnessLiftDb(p.vol)
      chain.connect(shelf)
      chain = shelf
    }
    if (voice.masterHp > 0) {
      const mhp = ctx.createBiquadFilter()
      mhp.type = 'highpass'
      mhp.frequency.value = voice.masterHp
      chain.connect(mhp)
      chain = mhp
    }
    chain.connect(limiter)
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
    // notices, not the loop. Shared across contexts — see sharedNoise.
    const { white, pink } = sharedNoise(ctx)

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
    if (p.rain > 0) buildThunder(white, p.rain, tone, shower)
    if (p.waves > 0) buildWaves(white, p.waves, p.motion, p.pace, tone, swellSets)
    if (p.stream > 0) buildStream(white, p.stream, p.motion, p.pace, tone)
    if (p.leaves > 0) buildLeaves(white, p.leaves, p.motion, p.pace, tone, weather)
    if (p.chime > 0) buildChime(white, p.chime, p.pace, tone)

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
