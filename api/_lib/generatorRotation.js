// Deterministic day-index -> law-id mapping for the content generator. This
// is deliberately independent of src/law-of-the-day/lib/rotation.js (the
// per-device, Math.random()-shuffled client rotation) — the generator just
// slowly cycles through all 48 laws on its own schedule, refreshing one
// law's canonical prose per cycle tick, regardless of what any given
// device's local season happens to be showing that day.
const EPOCH = Date.UTC(2026, 0, 1)
const DAY_MS = 86400000

export function getGeneratorLawId(now = new Date(), lawCount = 48) {
  const days = Math.floor((now.getTime() - EPOCH) / DAY_MS)
  return (((days % lawCount) + lawCount) % lawCount) + 1
}
