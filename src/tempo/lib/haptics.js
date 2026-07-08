// Gentle haptic feedback on capable devices (primarily Android). Silently no-ops
// where the Vibration API is missing (iOS Safari, desktop). Kept soft — a brief
// tap on a transition, a light triple on completion — never a jarring buzz.

function canVibrate() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

export function vibrateTransition() {
  if (canVibrate()) navigator.vibrate(30)
}

export function vibrateComplete() {
  if (canVibrate()) navigator.vibrate([50, 40, 50])
}

// A very light pulse for the anticipatory "heads up" window (last few seconds
// of a segment) — the felt counterpart to the tick sound and ring glow, for
// when you can't hear it over wind/traffic or aren't looking at the screen.
export function vibrateTick() {
  if (canVibrate()) navigator.vibrate(15)
}
