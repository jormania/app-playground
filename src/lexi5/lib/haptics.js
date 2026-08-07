// Minimal haptics utility for mobile devices
export function hapticTap() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(10) // Light tap for keyboard
  }
}

export function hapticError() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([30, 50, 30]) // Double pulse for errors
  }
}

export function hapticWin() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([50, 50, 50, 50, 100]) // Celebration pulse
  }
}
