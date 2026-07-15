// Nominal duration of a segment list — the sum of what's actually configured,
// not real wall-clock time (which would count pauses). The one thing excluded
// is the Player's own "Get ready" count-in (id 'countin'): it's added at play
// time, not something the user configured, so it shouldn't move the number
// they're looking at on the setup screen or see again on the done screen.
export function sumSeconds(segments) {
  return segments.filter((s) => s.id !== 'countin').reduce((sum, s) => sum + s.seconds, 0)
}

export function formatDuration(totalSeconds) {
  const totalMinutes = Math.round(totalSeconds / 60)
  if (totalMinutes < 60) return `${totalMinutes} min`
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}
