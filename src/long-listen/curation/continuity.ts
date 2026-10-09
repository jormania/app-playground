import type { Feedback, ListeningEvent, Programme, ProgrammeItem, Theme, ThemeExploration, WeekKey } from '../domain/types'
import { creditLine } from '../domain/identity'
import { latestFeedback, listeningState, timesHeard } from '../domain/listening'
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

const label = (i: ProgrammeItem) => `${i.proposed.composer} — ${i.proposed.work} (${creditLine(i.proposed)})`

export function digestThread(
  theme: Theme,
  explorations: ThemeExploration[],
  programmes: Map<string, Programme>,
  events: ListeningEvent[],
  feedback: Feedback[],
  nowWeek: WeekKey,
): ThreadDigest {
  const mine = explorations
    .filter((e) => e.themeId === theme.id)
    .sort((a, b) => a.weekKey.localeCompare(b.weekKey))

  const works: ThreadDigest['covered']['works'] = []
  const composers = new Set<string>()
  const recordings: CoveredRecording[] = []
  const response: ThreadDigest['response'] = { drawnTo: [], cooler: [], unheard: [], skipped: [] }

  for (const ex of mine) {
    const ps = [ex.programmeId, ...(ex.extraProgrammeIds ?? [])].map((id) => programmes.get(id)).filter((x): x is Programme => Boolean(x))
    for (const item of ps.flatMap((p) => p.sections.flatMap((s) => s.items))) {
      const state = listeningState(events, item.recordingId)
      if (ex.setAside && state === 'not-started') continue
      const fb = latestFeedback(feedback, item.recordingId)
      const workFb = latestFeedback(feedback, item.workId)
      const reaction = fb.reaction ?? workFb.reaction
      const more = fb.more ?? workFb.more
      if (!works.some((w) => w.composer === item.proposed.composer && w.title === item.proposed.work)) {
        works.push({ composer: item.proposed.composer, title: item.proposed.work, catalogue: item.proposed.catalogue })
      }
      composers.add(item.proposed.composer)
      recordings.push({
        composer: item.proposed.composer,
        work: item.proposed.work,
        credit: creditLine(item.proposed),
        state,
        heardTimes: timesHeard(events, item.recordingId),
        reaction,
        more,
        notes: [...fb.notes, ...workFb.notes],
      })
      if (reaction === 'loved' || reaction === 'liked' || more === 'yes') response.drawnTo.push(label(item))
      else if (reaction === 'not-for-me' || reaction === 'too-difficult' || more === 'no') response.cooler.push(label(item))
      if (state === 'not-started') response.unheard.push(label(item))
      if (state === 'skipped') response.skipped.push(label(item))
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
    covered: { works, composers: [...composers], recordings },
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
  return digestThread(theme, explorations, programmes, await repo.events.all(), await repo.feedback.all(), nowWeek)
}
