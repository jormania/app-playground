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

// ── Neutral "ding" — for movement / focus / custom (crisp, brief). ──────────
function ding(v) {
  tone({ frequency: 880, duration: 0.15, volume: 0.2 * v })
}

function dingComplete(v) {
  tone({ frequency: 660, duration: 0.15, volume: 0.2 * v })
  tone({ frequency: 880, duration: 0.15, delay: 0.18, volume: 0.2 * v })
  tone({ frequency: 1046, duration: 0.25, delay: 0.36, volume: 0.2 * v })
}

// ── Calm "bell" — for the mindfulness practices (soft, resonant, long decay). ─
function bell(v) {
  tone({ frequency: 528, duration: 1.6, volume: 0.22 * v })
  tone({ frequency: 1056, duration: 1.1, volume: 0.06 * v })
}

function bellComplete(v) {
  tone({ frequency: 396, duration: 2.6, volume: 0.24 * v })
  tone({ frequency: 792, duration: 2.0, volume: 0.07 * v })
}

// A cue set keyed by the practice family; `volume` is 'soft' | 'normal' | 'loud'.
export function cueSet(kind, volume = 'normal') {
  const v = scale(volume)
  if (kind === 'bell') {
    return { transition: () => bell(v), complete: () => bellComplete(v) }
  }
  return { transition: () => ding(v), complete: () => dingComplete(v) }
}

// A standalone gentle bell for the periodic "interval chime" during long sessions —
// a touch softer than a transition bell at the same level.
export function playChime(volume = 'normal') {
  bell(scale(volume) * 0.7)
}
