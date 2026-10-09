import type { ListeningEvent, Programme, Recording, Work } from './types'
import { listeningState } from './listening'

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
): string {
  // With "hide what I skip", a skipped work isn't counted either.
  const items = programmes.flatMap((p) => p.sections.flatMap((s) => s.items)).filter((i) => !hideSkipped || listeningState(events, i.recordingId) !== 'skipped')
  if (!items.length) return ''
  const workIds = [...new Set(items.map((i) => i.workId))]
  const composers = new Set(items.map((i) => i.proposed.composer.trim().toLowerCase()))
  const years = workIds
    .map((id) => Number(/\b(1[0-9]{3}|20[0-9]{2})\b/.exec(works.get(id)?.composed ?? '')?.[1]))
    .filter((y) => y > 0)
  const ms = [...new Set(items.map((i) => i.recordingId))]
    .reduce((n, id) => n + (recordings.get(id)?.spotify?.durationMs ?? 0), 0)
  const heard = new Set(items.filter((i) => listeningState(events, i.recordingId) === 'heard').map((i) => i.workId)).size

  const what = `${workIds.length} work${workIds.length === 1 ? '' : 's'} by ${composers.size} composer${composers.size === 1 ? '' : 's'}`
  const lo = Math.min(...years)
  const hi = Math.max(...years)
  const when = years.length ? (lo === hi ? `, written in ${lo}` : `, written between ${lo} and ${hi}`) : ''
  const hours = ms / 3_600_000
  const length = ms ? (hours >= 1 ? `about ${Math.round(hours * 2) / 2} hours of music` : `about ${Math.round(ms / 60000)} minutes of music`) : ''
  const progress = heard ? `${heard} heard so far` : 'none heard yet'
  return [what + when, length, progress].filter(Boolean).join(' · ')
}
