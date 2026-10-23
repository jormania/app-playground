import type { Feedback, ListeningEvent, Programme, Theme, ThemeExploration, Work } from './types'
import { listeningState } from './listening'
import { displaySurname } from './identity'
import { groupByComposer } from './composerGroups'
import { heardAs } from './standIns'

/** A programme a thread has had, and whether its visit was set aside (a direction changed away from). */
export interface HeldProgramme {
  programme: Programme
  setAside?: boolean
}

/** A thread as Threads shows it: its visits, oldest first, and the one its title opens. */
export interface ShownThread {
  theme: Theme
  visits: ThemeExploration[]
  latest?: ThemeExploration
}

/** Every programme a visit had, extras included, each carrying the visit's set-aside flag. */
export function heldBy(visits: ThemeExploration[], programmes: Map<string, Programme>): HeldProgramme[] {
  return visits.flatMap((v) => [v.programmeId, ...(v.extraProgrammeIds ?? [])]
    .map((id) => programmes.get(id))
    .filter((p): p is Programme => Boolean(p))
    .map((programme) => ({ programme, setAside: v.setAside })))
}

/** Whether anything of a programme was begun or spoken of: a listening event, or a word (reaction, want-more, note) on one of its items. */
function touched(p: Programme, events: ListeningEvent[], feedback: Feedback[], standIns: Map<string, string>): boolean {
  return p.sections.flatMap((s) => s.items).some((i) => {
    const ids = heardAs(i, p.id, standIns)
    return listeningState(events, ids) !== 'not-started'
      || feedback.some((f) => (f.reaction || f.more || f.note) && (ids.includes(f.target.id) || (f.target.id === i.workId && f.programmeId === p.id)))
  })
}

/**
 * The threads worth showing, newest first. A theme whose every visit was set
 * aside — a direction changed away from: `changeDirection` keeps the theme with
 * its one visit flagged, never closed — is shown only if something of it was
 * heard or spoken of; otherwise it was never followed. Ordered by the week of
 * the latest visit not set aside, then by when the theme was last written
 * (`updatedAt` alone moves when the curator answers late). The title opens
 * that same visit, or the last one when all were set aside.
 */
export function threadsToShow(
  themes: Theme[],
  explorations: ThemeExploration[],
  programmes: Map<string, Programme>,
  events: ListeningEvent[],
  feedback: Feedback[],
  standIns: Map<string, string> = new Map(),
): ShownThread[] {
  return themes
    .map((theme) => {
      const visits = explorations.filter((e) => e.themeId === theme.id).sort((a, b) => a.weekKey.localeCompare(b.weekKey))
      return { theme, visits, latest: visits.filter((v) => !v.setAside).pop() ?? visits[visits.length - 1] }
    })
    .filter(({ visits }) => !visits.length || visits.some((v) => !v.setAside)
      || heldBy(visits, programmes).some(({ programme }) => touched(programme, events, feedback, standIns)))
    .sort((a, b) => (b.latest?.weekKey ?? '').localeCompare(a.latest?.weekKey ?? '') || b.theme.updatedAt.localeCompare(a.theme.updatedAt))
}

/**
 * What a thread holds, in one plain sentence and no tally (LONG_LISTEN §1):
 * "Debussy, Ravel, Roussel and others, written between 1911 and 1977 · partly
 * heard". It used to count ("9 works by 6 composers · 2 heard so far"), which
 * named nobody and kept score. Counted across every
 * programme the thread has had — a set-aside one only for what was begun of
 * it, the rule the curator's digest follows (curation/continuity.ts). Years
 * come from the curator's dates, so a work without one simply doesn't widen
 * the span.
 */
export function threadContents(
  held: HeldProgramme[],
  works: Map<string, Work>,
  events: ListeningEvent[],
  hideSkipped = false,
  /**
   * `standInsOf(comparisons)` (domain/standIns.ts): where Spotify lacked the
   * curator's recording, the stand-in is what was heard and skipped.
   * Without it, only the curator's recording is read.
   */
  standIns: Map<string, string> = new Map(),
): string {
  // Each item with the recordings it was heard through — the curator's and its stand-in, read as one.
  const all = held.flatMap(({ programme: p, setAside }) => p.sections.flatMap((s) => s.items)
    .map((i) => ({ i, ids: heardAs(i, p.id, standIns) }))
    .filter(({ ids }) => !setAside || listeningState(events, ids) !== 'not-started'))
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
  const heard = new Set(items.filter(({ ids }) => listeningState(events, ids) === 'heard').map(({ i }) => i.workId)).size

  // Who it holds, by name — three at most, in the order the thread met them.
  const names = [...composers.keys()].map((c) => displaySurname(c))
  const who = names.length <= 3 ? andList(names) : `${names.slice(0, 3).join(', ')} and others`
  const lo = Math.min(...years)
  const hi = Math.max(...years)
  const when = years.length ? (lo === hi ? `, written in ${lo}` : `, written between ${lo} and ${hi}`) : ''
  const where = heard === 0 ? 'not yet heard' : heard === workIds.length ? 'heard through' : 'partly heard'
  return [who + when, where].join(' · ')
}

function andList(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}
