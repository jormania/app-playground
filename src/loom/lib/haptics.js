// A whisper of haptic feedback on the tactile actions (weave / unravel / drop),
// where the device supports it. Silent no-op everywhere else.
export function tap(pattern = 8) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern)
  } catch { /* ignore */ }
}
