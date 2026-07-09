// A short tactile pulse for the list rail's tap targets (Photo/Link/Paid/Going/Attended) —
// mobile-only in effect, since the Vibration API only exists on devices that support it
// (Android; iOS Safari has never implemented it). Safe to call unconditionally everywhere
// else — no-ops rather than throwing.
export function haptic(ms = 12) {
  try { navigator.vibrate?.(ms) } catch { /* unsupported or blocked (e.g. iframe policy) */ }
}
