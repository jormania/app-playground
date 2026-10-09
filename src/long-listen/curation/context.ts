import type { Repo } from '../store/repo'
import type { ListeningWeek } from '../domain/week'
import { creditLine } from '../domain/identity'
import { knownWorkIds, listeningState, latestFeedback, timesHeard } from '../domain/listening'
import type { ListenerPreferences } from '../domain/types'
import { weeksBetween } from '../domain/week'
import { digestThread, type ThreadDigest } from './continuity'

/**
 * What the curator is told about the listener when it proposes a week's three
 * directions — structured, bounded, deterministic (same store, same JSON), so
 * nothing in it needs the model to guess.
 *
 * Bounded on purpose: the twelve most recently active threads, the last eight
 * weeks, the last thirty things listened to. Older history is still in the
 * store and still reaches the curator through each thread's digest when that
 * thread is relevant; it is not resent every week.
 */
export interface CuratorContext {
  /** Said by the listener in Settings — outranks anything inferred. */
  preferences: Omit<ListenerPreferences, 'nextRequest'>
  listenerNotes: string
  taste: { facet: string; subject: string; statement: string; stance: string; confidence: string }[]
  questions: string[]
  threads: ThreadDigest[]
  openPaths: { title: string; pitch: string; mood: string; offeredIn: string }[]
  recentWeeks: { week: string; chosen?: string; mood?: string; alsoOffered: string[] }[]
  recentListening: { composer: string; work: string; recording: string; state: string; reaction?: string; notes: string[]; heardTimes: number }[]
  /**
   * Every work programmed in the last twelve weeks, in any theme — so a new
   * theme doesn't hand back last month's symphony by accident. A deliberate
   * return is fine; an unnoticed one is not.
   */
  alreadyProgrammed: { composer: string; work: string; weeksAgo: number }[]
  /**
   * Works the listener knew before the app suggested them — the music they
   * brought with them. Not a verdict on the works; it tells the curator what
   * is not a discovery for this listener.
   */
  alreadyKnown: { composer: string; work: string }[]
  requestedNext?: string
}

export async function buildContext(repo: Repo, week: ListeningWeek, requestedNext?: string): Promise<CuratorContext> {
  const [taste, prefs, themes, explorations, weeks, options, events, feedback] = await Promise.all([
    repo.taste(), repo.preferences(), repo.themes.all(), repo.explorations.all(), repo.weeks.all(), repo.options.all(), repo.events.all(), repo.feedback.all(),
  ])
  const programmes = new Map((await repo.programmes.all()).map((p) => [p.id, p]))

  const threads = themes
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 12)
    .map((t) => digestThread(t, explorations, programmes, events, feedback, week.key))

  const optionById = new Map(options.map((o) => [o.id, o]))
  const recentWeeks = weeks
    .filter((w) => w.weekKey < week.key)
    .sort((a, b) => b.weekKey.localeCompare(a.weekKey))
    .slice(0, 8)
    .map((w) => {
      const chosen = w.chosenOptionId ? optionById.get(w.chosenOptionId) : undefined
      return {
        week: w.weekKey,
        chosen: chosen?.title,
        mood: chosen?.mood,
        alsoOffered: w.optionIds.filter((id) => id !== w.chosenOptionId).map((id) => optionById.get(id)?.title ?? '').filter(Boolean),
      }
    })

  const openPaths = options
    .filter((o) => o.status === 'open' && o.weekKey < week.key)
    .sort((a, b) => b.weekKey.localeCompare(a.weekKey))
    .slice(0, 12)
    .map((o) => ({ title: o.title, pitch: o.pitch, mood: o.mood, offeredIn: o.weekKey }))

  // The most recent thirty recordings touched, newest first.
  const seen = new Set<string>()
  const recentIds: string[] = []
  for (const e of [...events].sort((a, b) => b.at.localeCompare(a.at))) {
    if (seen.has(e.recordingId)) continue
    seen.add(e.recordingId)
    recentIds.push(e.recordingId)
    if (recentIds.length >= 30) break
  }
  const itemByRecording = new Map(
    [...programmes.values()].flatMap((p) => p.sections.flatMap((s) => s.items)).map((i) => [i.recordingId, i]),
  )
  const recentListening = recentIds.flatMap((rid) => {
    const item = itemByRecording.get(rid)
    if (!item) return []
    const fb = latestFeedback(feedback, rid)
    return [{
      composer: item.proposed.composer,
      work: item.proposed.work,
      recording: creditLine(item.proposed),
      state: listeningState(events, rid),
      reaction: fb.reaction,
      notes: fb.notes.slice(-3),
      heardTimes: timesHeard(events, rid),
    }]
  })

  const alreadyProgrammed: CuratorContext['alreadyProgrammed'] = []
  for (const p of [...programmes.values()].sort((a, b) => b.weekKey.localeCompare(a.weekKey))) {
    const weeksAgo = weeksBetween(p.weekKey, week.key)
    if (weeksAgo > 12 || weeksAgo < 0) continue
    for (const i of p.sections.flatMap((x) => x.items)) {
      if (!alreadyProgrammed.some((a) => a.composer === i.proposed.composer && a.work === i.proposed.work)) {
        alreadyProgrammed.push({ composer: i.proposed.composer, work: i.proposed.work, weeksAgo })
      }
    }
  }
  const known = knownWorkIds(feedback)
  const alreadyKnown: CuratorContext['alreadyKnown'] = []
  for (const i of [...programmes.values()].flatMap((p) => p.sections.flatMap((x) => x.items))) {
    if (known.has(i.workId) && !alreadyKnown.some((a) => a.composer === i.proposed.composer && a.work === i.proposed.work)) {
      alreadyKnown.push({ composer: i.proposed.composer, work: i.proposed.work })
    }
  }
  const { nextRequest, ...preferences } = prefs

  return {
    preferences,
    listenerNotes: taste.notesToCurator,
    taste: taste.observations
      .filter((o) => !o.supersededBy)
      .map(({ facet, subject, statement, stance, confidence }) => ({ facet, subject, statement, stance, confidence })),
    questions: taste.questions,
    threads,
    openPaths,
    recentWeeks,
    recentListening,
    alreadyProgrammed,
    alreadyKnown,
    requestedNext: (requestedNext ?? nextRequest).trim() || undefined,
  }
}
