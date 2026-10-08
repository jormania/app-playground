import type { Repo } from '../store/repo'
import type { ListeningWeek } from '../domain/week'
import { creditLine } from '../domain/identity'
import { listeningState, latestFeedback } from '../domain/listening'
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
  listenerNotes: string
  taste: { facet: string; subject: string; statement: string; stance: string; confidence: string }[]
  questions: string[]
  threads: ThreadDigest[]
  openPaths: { title: string; pitch: string; mood: string; offeredIn: string }[]
  recentWeeks: { week: string; chosen?: string; mood?: string; alsoOffered: string[] }[]
  recentListening: { composer: string; work: string; recording: string; state: string; reaction?: string; notes: string[] }[]
  requestedNext?: string
}

export async function buildContext(repo: Repo, week: ListeningWeek, requestedNext?: string): Promise<CuratorContext> {
  const [taste, themes, explorations, weeks, options, events, feedback] = await Promise.all([
    repo.taste(), repo.themes.all(), repo.explorations.all(), repo.weeks.all(), repo.options.all(), repo.events.all(), repo.feedback.all(),
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
    }]
  })

  return {
    listenerNotes: taste.notesToCurator,
    taste: taste.observations
      .filter((o) => !o.supersededBy)
      .map(({ facet, subject, statement, stance, confidence }) => ({ facet, subject, statement, stance, confidence })),
    questions: taste.questions,
    threads,
    openPaths,
    recentWeeks,
    recentListening,
    requestedNext: requestedNext || undefined,
  }
}
