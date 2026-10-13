import type { Comparison, Feedback, ListeningEvent, Programme, ProgrammeItem, Theme, ThemeExploration, WeekKey } from '../domain/types'
import { creditLine, sameWork } from '../domain/identity'
import { groupByComposer } from '../domain/composerGroups'
import { listeningState, timesHeard } from '../domain/listening'
import { heardAs, itemFeedback, playedProposed, standInPlayersOf, standInsOf } from '../domain/standIns'
import { sinceWords } from '../domain/week'
import type { Repo } from '../store/repo'

/**
 * A theme's memory, condensed for the curator.
 *
 * This is what makes a returning theme continue rather than restart: the
 * curator is told exactly which works and recordings the thread has covered,
 * how each one landed, what was never reached, and the open questions and next
 * directions the continuity planner left last time. The server then checks the
 * new programme against `covered.works` (curator/validate.js).
 *
 * "Covered" is deliberately generous for a normal week — everything programmed
 * counts, heard or not, because offering the same work twice reads as a
 * curator who wasn't paying attention. A week the listener set aside (changed
 * direction) counts only what they actually heard of it.
 */
export interface CoveredRecording {
  composer: string
  work: string
  credit: string
  state: string
  /** Heard more than once means it was come back to — worth knowing, never shown as a count. */
  heardTimes: number
  reaction?: string
  more?: string
  notes: string[]
}

export interface ThreadDigest {
  themeId: string
  title: string
  summary: string
  firstIntroduced: WeekKey
  since: string
  /** The stage the next exploration would be. */
  nextStage: number
  explorations: { weekKey: WeekKey; stage: number; angle: string; closingNote?: string; setAside?: boolean }[]
  covered: {
    works: { composer: string; title: string; catalogue?: string }[]
    composers: string[]
    recordings: CoveredRecording[]
  }
  response: { drawnTo: string[]; cooler: string[]; unheard: string[]; skipped: string[] }
  reaction?: string
  openQuestions: string[]
  adjacentTopics: string[]
  nextDirections: string[]
}

// The stand-in helpers live in domain/standIns.ts, so domain readers share
// them; re-exported here, where every curation reader has always found them.
export { standInsOf, heardAs, feedbackOnAny, itemFeedback, standInPlayersOf, playedProposed } from '../domain/standIns'

const label = (i: ProgrammeItem, credit: string) => `${i.proposed.composer} — ${i.proposed.work} (${credit})`

export function digestThread(
  theme: Theme,
  explorations: ThemeExploration[],
  programmes: Map<string, Programme>,
  events: ListeningEvent[],
  feedback: Feedback[],
  nowWeek: WeekKey,
  /** The stored comparisons, for items heard through a stand-in; without them only the curator's recording is read. */
  comparisons: Comparison[] = [],
): ThreadDigest {
  const mine = explorations
    .filter((e) => e.themeId === theme.id)
    .sort((a, b) => a.weekKey.localeCompare(b.weekKey))

  const works: ThreadDigest['covered']['works'] = []
  const composers: string[] = []
  const recordings: CoveredRecording[] = []
  const response: ThreadDigest['response'] = { drawnTo: [], cooler: [], unheard: [], skipped: [] }
  const standIns = standInsOf(comparisons)
  const players = standInPlayersOf(comparisons)

  for (const ex of mine) {
    const ps = [ex.programmeId, ...(ex.extraProgrammeIds ?? [])].map((id) => programmes.get(id)).filter((x): x is Programme => Boolean(x))
    for (const { item, ids, p } of ps.flatMap((p) => p.sections.flatMap((s) => s.items).map((item) => ({ item, p, ids: heardAs(item, p.id, standIns) })))) {
      const state = listeningState(events, ids)
      if (ex.setAside && state === 'not-started') continue
      // The recording's word and the work's, merged once for every reader (domain/standIns.ts).
      const { reaction, more, notes } = itemFeedback(feedback, ids, item.workId)
      // Credited to who played: heard through a stand-in, the stand-in's performers.
      const credit = creditLine(playedProposed(item, p.id, players, events, feedback))
      // One work however the curator spelled it this time ("Symphony No. 5" and
      // "Symphony No. 5 in C-sharp minor"): the same identity the validator uses.
      if (!works.some((w) => sameWork({ composer: w.composer, title: w.title, catalogue: w.catalogue }, { composer: item.proposed.composer, title: item.proposed.work, catalogue: item.proposed.catalogue }))) {
        works.push({ composer: item.proposed.composer, title: item.proposed.work, catalogue: item.proposed.catalogue })
      }
      composers.push(item.proposed.composer)
      recordings.push({
        composer: item.proposed.composer,
        work: item.proposed.work,
        credit,
        state,
        heardTimes: ids.reduce((n, id) => n + timesHeard(events, id), 0),
        reaction,
        more,
        notes,
      })
      if (reaction === 'loved' || reaction === 'liked' || more === 'yes') response.drawnTo.push(label(item, credit))
      else if (reaction === 'not-for-me' || reaction === 'too-difficult' || more === 'no') response.cooler.push(label(item, credit))
      if (state === 'not-started') response.unheard.push(label(item, credit))
      if (state === 'skipped') response.skipped.push(label(item, credit))
    }
  }

  return {
    themeId: theme.id,
    title: theme.title,
    summary: theme.summary,
    firstIntroduced: theme.firstIntroduced,
    since: sinceWords(theme.firstIntroduced, nowWeek),
    nextStage: mine.filter((e) => !e.setAside).length + 1,
    explorations: mine.map((e) => ({ weekKey: e.weekKey, stage: e.stage, angle: e.angle, closingNote: e.closingNote, setAside: e.setAside })),
    // One composer however written — accents, a bare surname — grouped as every reader groups them (domain/composerGroups.ts).
    covered: { works, composers: [...groupByComposer(composers, (n) => n).keys()], recordings },
    response,
    reaction: theme.reaction,
    openQuestions: theme.openQuestions,
    adjacentTopics: theme.adjacentTopics,
    nextDirections: theme.nextDirections,
  }
}

/** The same, reading everything it needs from the store. */
export async function threadDigest(repo: Repo, themeId: string, nowWeek: WeekKey): Promise<ThreadDigest> {
  const theme = await repo.themes.require(themeId)
  const explorations = await repo.explorations.many(theme.explorationIds)
  const programmes = new Map((await repo.programmes.many(explorations.flatMap((e) => [e.programmeId, ...(e.extraProgrammeIds ?? [])]))).map((p) => [p.id, p]))
  return digestThread(theme, explorations, programmes, await repo.events.all(), await repo.feedback.all(), nowWeek, await repo.comparisons.all())
}
