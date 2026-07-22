// Shared HLTB "Main + Sides" length bucketing, used by both the [A] LENGTH:
// filter row and the [S] PLAYTIME_ANALYSIS panel — a single source of truth
// so the two surfaces can't disagree about which bucket a game falls into.
export const LENGTH_BUCKETS = {
  Short: { label: 'Short (<4h)', max: 4 },
  Medium: { label: 'Medium (4-12h)', min: 4, max: 12 },
  Long: { label: 'Long (12-25h)', min: 12, max: 25 },
  Epic: { label: 'Epic (25h+)', min: 25 }
}

export function lengthBucketOf(hours) {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return null
  if (hours < 4) return 'Short'
  if (hours < 12) return 'Medium'
  if (hours < 25) return 'Long'
  return 'Epic'
}

export function isInLengthBucket(game, bucket) {
  if (!game || game.lengthHours === null || game.lengthHours === undefined) return false
  return lengthBucketOf(game.lengthHours) === bucket
}
