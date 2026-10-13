import type { ListeningEvent, Programme, Recording, Work } from './types'
import { listeningState } from './listening'
import { groupByComposer } from './composerGroups'
import { heardAs } from './standIns'

/**
 * What a thread holds, in one plain sentence: "9 works by 6 composers,
 * written between 1911 and 1977 · about 6 hours of music · 2 heard so far".
 * Counted across every programme the thread has had. Years come from the
 * curator's dates, so a work without one simply doesn't widen the span.
 */
export function threadContents(
  programmes: Programme[],
  works: Map<string, Work>,
  recordings: Map<string, Recording>,
  events: ListeningEvent[],
  hideSkipped = false,
  /**
   * `standInsOf(comparisons)` (domain/standIns.ts): where Spotify lacked the
   * curator's recording, the stand-in is what was heard, skipped and timed.
   * Without it, only the curator's recording is read.
   */
  standIns: Map<string, string> = new Map(),
): string {
  // Each item with the recordings it was heard through — the curator's and its stand-in, read as one.
  const all = programmes.flatMap((p) => p.sections.flatMap((s) => s.items).map((i) => ({ i, ids: heardAs(i, p.id, standIns) })))
  // With "hide what I skip", a skipped work isn't counted either.
  const items = all.filter(({ ids }) => !hideSkipped || listeningState(events, ids) !== 'skipped')
  if (!items.length) return ''
  const workIds = [...new Set(items.map(({ i }) => i.workId))]
  // One composer however written — accents, spacing, a bare surname — grouped as
  // the Notion mirror groups them (domain/composerGroups.ts), not by a bare lower-case.
  const composers = groupByComposer(items, ({ i }) => i.proposed.composer)
  const years = workIds
    .map((id) => Number(/\b(1[0-9]{3}|20[0-9]{2})\b/.exec(works.get(id)?.composed ?? '')?.[1]))
    .filter((y) => y > 0)
  // The length of what plays: the curator's recording, or — where Spotify
  // lacked it (not confirmed) and a stand-in plays instead — the stand-in's.
  const played = items.map(({ i, ids }) => {
    const own = recordings.get(i.recordingId)
    const confirmed = own?.verification === 'verified' && own.spotify
    return ids.length > 1 && !confirmed ? ids[1] : i.recordingId
  })
  const ms = [...new Set(played)]
    .reduce((n, id) => n + (recordings.get(id)?.spotify?.durationMs ?? 0), 0)
  const heard = new Set(items.filter(({ ids }) => listeningState(events, ids) === 'heard').map(({ i }) => i.workId)).size

  const what = `${workIds.length} work${workIds.length === 1 ? '' : 's'} by ${composers.size} composer${composers.size === 1 ? '' : 's'}`
  const lo = Math.min(...years)
  const hi = Math.max(...years)
  const when = years.length ? (lo === hi ? `, written in ${lo}` : `, written between ${lo} and ${hi}`) : ''
  const hours = ms / 3_600_000
  const length = ms ? (hours >= 1 ? `about ${Math.round(hours * 2) / 2} hours of music` : `about ${Math.round(ms / 60000)} minutes of music`) : ''
  const progress = heard ? `${heard} heard so far` : 'none heard yet'
  return [what + when, length, progress].filter(Boolean).join(' · ')
}
