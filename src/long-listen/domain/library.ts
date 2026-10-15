import type { Comparison, Concert, Feedback, ListeningEvent, ListeningState, Programme, ProposedRecording, Reaction, Recording, ThemeExploration, WeekRecord, Work } from './types'
import { displaySurname, fold } from './identity'
import { groupByComposer } from './composerGroups'
import { listeningState } from './listening'
import { feedbackOnAny, heardAs, itemFeedback, standInPlayersOf, standInsOf } from './standIns'
import type { LibraryEntry, LibraryWork } from './librarySearch'

/** One recording as the Library shows it: the one that played, where it came from, where you stand with it and what you said. */
export interface LibraryRecording {
  /** The recording that plays — a stand-in's where it stood in and was played. */
  recordingId: string
  rec?: Recording
  proposed: ProposedRecording
  /** Read as one with it: the curator's recording and its stand-in. */
  ids: string[]
  state: ListeningState
  said: { reaction?: Reaction; notes: string[] }
  programmeId?: string
  programmeTitle?: string
  /** "another perspective", or what a stand-in played instead of. */
  note?: string
  /** When it was first met, for the order within a work. */
  at: string
}

export interface LibraryWorkEntry extends LibraryWork { recordings: LibraryRecording[] }
/** A composer's entry, with every way their name was written, so a page asked for by any of them finds it. */
export interface LibraryComposer extends LibraryEntry<LibraryWorkEntry> { spellings: string[] }

export interface LibraryInput {
  works: Work[]
  recordings: Recording[]
  programmes: Programme[]
  comparisons: Comparison[]
  events: ListeningEvent[]
  feedback: Feedback[]
  concerts: Concert[]
  weeks: WeekRecord[]
  explorations: ThemeExploration[]
}

/**
 * Everything met so far, as the Library files it — the one reading behind the
 * Library and a composer's page, so the two never tell it differently.
 *
 * - One row per programme item. Where a stand-in played in its place, the row
 *   is the recording that played, with the curator's choice said beside it;
 *   a stand-in nothing has been played of yet leaves the curator's row alone.
 * - A second perspective is a row of its own, credited to the programme it
 *   was asked from.
 * - A programme set aside by a change of direction keeps only what was heard
 *   of it or said about it (LONG_LISTEN §3).
 * - Heard live: concerts on or before `today`, never one still to come.
 * - Within a work, the curator's recording first, then the rest as they were met.
 */
export function libraryEntries(input: LibraryInput, opts: { hideSkipped: boolean; today: string }): LibraryComposer[] {
  const { works, recordings, programmes, comparisons, events, feedback, concerts } = input
  const recById = new Map(recordings.map((r) => [r.id, r]))
  // A stand-in counts as what played once anything was heard or said through it, as playedProposed reads it.
  const played = (id: string) => events.some((e) => e.recordingId === id) || feedback.some((f) => f.target.id === id)
  // What of a set-aside programme counts: begun, or spoken of — on the recording, or on the work from that programme (as Threads reads it).
  const begun = (ids: string[], from?: { workId: string; programmeId: string }) => listeningState(events, ids) !== 'not-started'
    || feedback.some((f) => (f.reaction || f.more || f.note) && (ids.includes(f.target.id) || (from && f.target.id === from.workId && f.programmeId === from.programmeId)))

  const setAside = setAsideProgrammes(input.weeks, input.explorations, programmes)

  type Row = Omit<LibraryRecording, 'state' | 'said'> & { workId: string; composer: string; fromItem: boolean }
  const rows: Row[] = []
  const shown = new Set<string>()
  const byTime = <T extends { createdAt: string }>(xs: T[]) => [...xs].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const standIns = standInsOf(comparisons)
  const players = standInPlayersOf(comparisons)
  for (const p of byTime(programmes)) {
    for (const item of p.sections.flatMap((x) => x.items)) {
      const ids = heardAs(item, p.id, standIns)
      if (setAside.has(p.id) && !begun(ids, { workId: item.workId, programmeId: p.id })) continue
      const standIn = players.get(`cmp:${p.id}:${item.id}`)
      const through = standIn && standIn.recordingId !== item.recordingId && played(standIn.recordingId) ? standIn : undefined
      const recordingId = through?.recordingId ?? item.recordingId
      if (shown.has(recordingId)) continue
      for (const id of ids) shown.add(id)
      const whose = leadOf(item.proposed)
      rows.push({
        recordingId, rec: recById.get(recordingId), proposed: through?.proposed ?? item.proposed, ids,
        programmeId: p.id, programmeTitle: p.title, at: p.createdAt, workId: item.workId, composer: item.proposed.composer, fromItem: true,
        ...(through ? { note: whose ? `on Spotify instead of ${whose}’s recording` : 'on Spotify instead' } : {}),
      })
    }
  }
  // A second perspective: from the programme it was asked from (`cmp:<programmeId>:<itemId>`), or the
  // programme a pair was written into. A stand-in is its item's row above, never a row of its own.
  for (const c of byTime(comparisons)) {
    if (c.standIn) continue
    const p = programmes.find((x) => c.id.startsWith(`cmp:${x.id}:`) || x.comparisonIds.includes(c.id))
    for (const pv of c.perspectives) {
      if (shown.has(pv.recordingId)) continue
      if (p && setAside.has(p.id) && !begun([pv.recordingId])) continue
      shown.add(pv.recordingId)
      rows.push({
        recordingId: pv.recordingId, rec: recById.get(pv.recordingId), proposed: pv.proposed, ids: [pv.recordingId],
        programmeId: p?.id, programmeTitle: p?.title, note: 'another perspective', at: c.createdAt, workId: c.workId, composer: pv.proposed.composer, fromItem: false,
      })
    }
  }

  // Heard live: each concert's works, by work, the latest first.
  const liveFor = new Map<string, Concert[]>()
  for (const c of [...concerts].filter((x) => x.date <= opts.today).sort((a, b) => b.date.localeCompare(a.date))) {
    for (const w of c.works) liveFor.set(w.workId, [...(liveFor.get(w.workId) ?? []), c])
  }

  const metWorks: { composer: string; spellings: string[]; work: LibraryWorkEntry }[] = []
  for (const w of works) {
    const mine = rows
      .filter((r) => r.workId === w.id)
      .map((r) => ({ ...r, state: listeningState(events, r.ids) }))
      .filter((r) => !opts.hideSkipped || r.state !== 'skipped')
      .sort((a, b) => a.at.localeCompare(b.at) || Number(b.fromItem) - Number(a.fromItem))
    const live = liveFor.get(w.id) ?? []
    if (!mine.length && !live.length) continue
    // What was said of the work itself goes with its first row — the curator's recording — not repeated on each.
    const recs: LibraryRecording[] = mine.map(({ workId: _w, composer: _c, fromItem: _f, ...r }, i) => {
      const said = i === 0 ? itemFeedback(feedback, r.ids, w.id) : feedbackOnAny(feedback, r.ids)
      return { ...r, said: { reaction: said.reaction, notes: said.notes } }
    })
    const spellings = [...mine.map((r) => r.composer), ...live.flatMap((c) => c.works.filter((x) => x.workId === w.id).map((x) => x.composer))]
    metWorks.push({ composer: spellings[0] ?? '', spellings, work: { work: w, recordings: recs, live } })
  }

  // One composer however the name was written (domain/composerGroups.ts), filed by the surname as written:
  // Rimsky-Korsakov under R, Dvořák under D.
  return [...groupByComposer(metWorks, (x) => x.composer)]
    .map(([composer, list]) => ({
      composer,
      spellings: [...new Set(list.flatMap((x) => x.spellings))],
      works: list.map((x) => x.work).sort((a, b) => a.work.title.localeCompare(b.work.title)),
    }))
    .sort((a, b) => filingName(a.composer).localeCompare(filingName(b.composer)) || fold(a.composer).localeCompare(fold(b.composer)))
}

/** The name a composer is filed under: the surname as written, folded — "rimsky korsakov", "dvorak". */
export function filingName(composer: string): string {
  return fold(displaySurname(composer))
}

/** The card catalogue's guide letter for a composer. */
export function filingLetter(composer: string): string {
  return filingName(composer).charAt(0).toUpperCase()
}

/**
 * A work's facts without the catalogue number its title already carries:
 * "Scheherazade, Op. 35" doesn't need "· Op. 35" again underneath.
 */
export function catalogueNotInTitle(title: string, catalogue: string | undefined): string | undefined {
  if (!catalogue?.trim()) return undefined
  return ` ${fold(title)} `.includes(` ${fold(catalogue)} `) ? undefined : catalogue
}

/** Whose recording it is, by the name it goes by: the soloist's, else the conductor's, else the ensemble's or orchestra's. */
function leadOf(r: ProposedRecording): string | undefined {
  return r.soloists[0]?.name ?? r.conductor ?? r.ensemble ?? r.orchestra
}

/**
 * The programmes set aside — the one a changed direction replaced, and with it every programme that
 * joined it (a sitting, "More of this theme"): one rule for every reader of the journey (the Library,
 * the Notion Journal), so they never disagree about what still counts.
 */
export function setAsideProgrammes(
  weeks: { setAsideProgrammeIds: string[] }[],
  explorations: { setAside?: boolean; programmeId: string; extraProgrammeIds?: string[] }[],
  programmes: { id: string; extends?: string }[],
): Set<string> {
  const setAside = new Set([
    ...weeks.flatMap((w) => w.setAsideProgrammeIds),
    ...explorations.filter((e) => e.setAside).flatMap((e) => [e.programmeId, ...(e.extraProgrammeIds ?? [])]),
  ])
  // "More of this theme" continues the programme it extends, set aside with it.
  for (const p of programmes) if (p.extends && setAside.has(p.extends)) setAside.add(p.id)
  return setAside
}
