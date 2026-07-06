// The breath guide's shape, as pure math so it can be tested and so the orb and
// (later) any breath cue read from one source of truth.
//
// Two patterns, both chosen for FALLING ASLEEP rather than alertness:
//
//   'exhale' — a lengthening exhale, no hold. Starts gentle (~4s in / ~6s out)
//     and the exhale grows across the session toward ~4s in / ~11s out. A long,
//     unforced exhale is the parasympathetic ("rest") lever; no breath-hold, so
//     nothing about it demands effort as you drift.
//
//   '478'    — Dr. Weil's 4-7-8: inhale 4, hold 7, exhale 8. Fixed. More
//     structured (and the 7-count hold is a bit more active), offered for people
//     who already lean on it.

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
const lerp = (a, b, t) => a + (b - a) * t

// Smooth, symmetric ease — the orb should never move at a constant, mechanical
// rate; breath accelerates and settles.
export function easeInOutSine(t) {
  return 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t))
}

// The exhale in 'exhale' mode grows as the session progresses.
export const EXHALE_START = 6 // seconds, at the very start
export const EXHALE_END = 11 // seconds, by session's end
export const INHALE_SEC = 4

export function exhaleDuration(elapsedSec, totalSec) {
  const p = totalSec > 0 ? clamp01(elapsedSec / totalSec) : 0
  return lerp(EXHALE_START, EXHALE_END, p)
}

// The ordered phases of ONE breath cycle, given the current point in the
// session. Each phase carries a duration (seconds) and the orb scale it eases
// FROM → TO, where 1 = fully expanded (lungs full), 0 = fully settled (empty).
export function cyclePhases(mode, elapsedSec, totalSec) {
  if (mode === '478') {
    return [
      { phase: 'inhale', dur: 4, from: 0, to: 1 },
      { phase: 'hold', dur: 7, from: 1, to: 1 },
      { phase: 'exhale', dur: 8, from: 1, to: 0 },
    ]
  }
  // 'exhale' — lengthening exhale, no hold.
  return [
    { phase: 'inhale', dur: INHALE_SEC, from: 0, to: 1 },
    { phase: 'exhale', dur: exhaleDuration(elapsedSec, totalSec), from: 1, to: 0 },
  ]
}

// The orb scale (0..1) for a given phase and its internal progress t (0..1).
export function scaleFor(phase, t) {
  const eased = easeInOutSine(t)
  if (phase.from === phase.to) return phase.from // hold
  return lerp(phase.from, phase.to, eased)
}

// A short human label for the current phase, shown very faintly under the orb.
export function phaseLabel(phase) {
  if (phase === 'inhale') return 'breathe in'
  if (phase === 'hold') return 'hold'
  return 'let go'
}
