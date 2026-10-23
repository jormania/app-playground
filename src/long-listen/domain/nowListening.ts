import type { Comparison, Programme, Recording } from './types'

/** A work's listening view: where the masthead's "listen along" leads. */
export interface ListenTarget {
  programmeId: string
  itemId: string
  work: string
  composer: string
  /** The recording's tracks, for the place left in it (app/place.ts). */
  trackIds?: string[]
}

/**
 * The programme item a Spotify track belongs to — the curator's recording, or
 * the stand-in that played in its place — so "listen along" can find the work
 * that is sounding, whichever device it plays on and however it was started.
 * This week's programmes first, then the latest; a track no programme holds
 * (something else entirely) leads nowhere.
 */
export function listenTargetFor(
  trackIds: (string | undefined)[],
  input: { recordings: Recording[]; programmes: Programme[]; comparisons: Comparison[] },
  weekKey: string,
): ListenTarget | null {
  const wanted = trackIds.filter((x): x is string => Boolean(x))
  if (!wanted.length) return null
  const recs = input.recordings.filter((r) => r.spotify?.trackIds?.some((t) => wanted.includes(t)))
  if (!recs.length) return null
  const recIds = new Set(recs.map((r) => r.id))
  const ordered = [...input.programmes].sort((a, b) => Number(b.weekKey === weekKey) - Number(a.weekKey === weekKey) || b.createdAt.localeCompare(a.createdAt))
  for (const p of ordered) {
    for (const item of p.sections.flatMap((x) => x.items)) {
      const standIn = input.comparisons.find((c) => c.standIn && c.id === `cmp:${p.id}:${item.id}`)
      const played = recIds.has(item.recordingId) ? item.recordingId : standIn?.perspectives.find((x) => recIds.has(x.recordingId))?.recordingId
      if (!played) continue
      return { programmeId: p.id, itemId: item.id, work: item.proposed.work, composer: item.proposed.composer, trackIds: recs.find((r) => r.id === played)?.spotify?.trackIds }
    }
  }
  return null
}
