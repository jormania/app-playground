let audioCtx = null

function getContext() {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) audioCtx = new Ctx()
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
  return audioCtx
}

function tone({ frequency, duration, delay = 0, volume = 0.2, type = 'sine' }) {
  const ctx = getContext()
  if (!ctx) return
  const startAt = ctx.currentTime + delay
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(Math.max(0.0001, volume), startAt)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration)
}

// Cue volume level → base-volume multiplier.
const VOLUME_SCALE = { soft: 0.45, normal: 1, loud: 1.6 }
function scale(volume) {
  return VOLUME_SCALE[volume] ?? 1
}

// Completion always rides a bit louder than a plain transition, at any volume
// level, so "you're done" doesn't get lost at Soft or blend into the ordinary
// step-change cue at Normal.
const COMPLETE_BOOST = 1.4

// ── Neutral "ding" — for movement / focus / custom (crisp, brief). ──────────
function ding(v) {
  tone({ frequency: 880, duration: 0.15, volume: 0.2 * v })
}

function dingComplete(v) {
  const b = v * COMPLETE_BOOST
  tone({ frequency: 660, duration: 0.15, volume: 0.2 * b })
  tone({ frequency: 880, duration: 0.15, delay: 0.18, volume: 0.2 * b })
  tone({ frequency: 1046, duration: 0.25, delay: 0.36, volume: 0.2 * b })
}

// ── Calm "bell" — for the mindfulness practices (soft, resonant, long decay). ─
function bell(v) {
  tone({ frequency: 528, duration: 1.6, volume: 0.22 * v })
  tone({ frequency: 1056, duration: 1.1, volume: 0.06 * v })
}

function bellComplete(v) {
  const b = v * COMPLETE_BOOST
  tone({ frequency: 396, duration: 2.6, volume: 0.24 * b })
  tone({ frequency: 792, duration: 2.0, volume: 0.07 * b })
}

// A cue set keyed by the practice family; `volume` is 'soft' | 'normal' | 'loud'.
export function cueSet(kind, volume = 'normal') {
  const v = scale(volume)
  if (kind === 'bell') {
    return { transition: () => bell(v), complete: () => bellComplete(v) }
  }
  return { transition: () => ding(v), complete: () => dingComplete(v) }
}

// A quiet anticipatory tick for the last few seconds of a segment (movement/
// focus/custom only — the mindfulness bell practices stay uninterrupted).
// Short, dry, and clearly distinct from the ding/bell/chime so it reads as
// "heads up" rather than a transition itself.
export function playTick(volume = 'normal') {
  const v = scale(volume)
  tone({ frequency: 1400, duration: 0.06, volume: 0.09 * v, type: 'square' })
}

// A standalone "interval chime" for long sessions — deliberately distinct from
// both the ding and the bell (different waveform, different melodic shape: two
// notes in sequence rather than one beep or two simultaneous tones) so it's
// unmistakable as "time has passed", not a step transition or completion.
export function playChime(volume = 'normal') {
  const v = scale(volume) * 0.55
  tone({ frequency: 587, duration: 0.5, volume: v, type: 'triangle' })
  tone({ frequency: 880, duration: 0.9, delay: 0.3, volume: v * 0.85, type: 'triangle' })
}
