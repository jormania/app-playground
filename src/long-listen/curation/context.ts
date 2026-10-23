import type { Repo } from '../store/repo'
import type { ListeningWeek } from '../domain/week'
import { creditLine, fold, sameWork, type WorkLike } from '../domain/identity'
import { knownWorkIds, listeningState, timesHeard } from '../domain/listening'
import type { ListenerPreferences, ProgrammeItem, WeekMood } from '../domain/types'
import { DEFAULT_TIME_ZONE, weekOf, weekOfDate, weeksBetween, type CivilDate } from '../domain/week'
import { whoPlays } from '../domain/concertSoloists'
import { digestThread, heardAs, itemFeedback, playedProposed, standInPlayersOf, standInsOf, type ThreadDigest } from './continuity'

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
  recentWeeks: { week: string; chosen?: string; mood?: string; form?: string; alsoOffered: string[] }[]
  /**
   * The last thirty recordings touched, with when (weeks ago, 0 = this week) —
   * so a reason can point to a moment in the listener's own listening, never
   * to a label about them.
   */
  recentListening: { composer: string; work: string; recording: string; state: string; reaction?: string; notes: string[]; heardTimes: number; weeksAgo: number }[]
  /**
   * Works the listener called interesting or too difficult, three weeks or more
   * ago, not offered again since: candidates for a second hearing, which the
   * curator may offer one of, once, as a question.
   */
  secondHearings: { composer: string; work: string; recording: string; reaction: string; note?: string; weeksAgo: number; workId: string }[]
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
  /** Concerts heard live in the last twelve weeks: what was played, where, and what the listener said. */
  concerts: { venue: string; date: string; performers: string; works: string[]; note?: string; weeksAgo: number }[]
  /** "This week, differently" — this week only; outranks preferences for the week. */
  thisWeek?: WeekMood[]
}

export async function buildContext(
  repo: Repo, week: ListeningWeek, requestedNext?: string,
  /** The listener's time zone (Journey passes its own): "how many weeks ago" counts their weeks. */
  timeZone: string = DEFAULT_TIME_ZONE,
  /** Today, in the listener's zone: a concert after it hasn't been heard. Without it, the week's last day. */
  today?: string,
): Promise<CuratorContext> {
  // Whole listening weeks from an instant to the week being curated (0 = this
  // week, never negative), counted in the listener's weeks like everything else
  // — not in UTC days, which put a Sunday-night play in the wrong week.
  const weeksSince = (at: string | undefined): number => {
    const t = at ? new Date(at) : undefined
    if (!t || Number.isNaN(t.getTime())) return 0
    return Math.max(0, weeksBetween(weekOf(t, timeZone).key, week.key))
  }
  // One work however the curator spelled it this time — the identity the validator uses, not the raw strings.
  const sameAs = (a: WorkLike) => (b: { composer: string; work: string }) => sameWork(a, { composer: b.composer, title: b.work })
  const [taste, prefs, themes, explorations, weeks, options, events, feedback] = await Promise.all([
    repo.taste(), repo.preferences(), repo.themes.all(), repo.explorations.all(), repo.weeks.all(), repo.options.all(), repo.events.all(), repo.feedback.all(),
  ])
  const programmes = new Map((await repo.programmes.all()).map((p) => [p.id, p]))
  // Where Spotify lacked the curator's recording, the stand-in is what was heard and reacted to.
  const comparisons = await repo.comparisons.all()
  const standIns = standInsOf(comparisons)
  const players = standInPlayersOf(comparisons)

  // The twelve most recently touched, and any older one the request names ("Return to …" from Threads, or
  // a wish that names it): past the twelve, a thread could never come back, though Threads says it can.
  const asked = fold(requestedNext ?? prefs.nextRequest ?? '')
  const named = (t: { title: string }) => Boolean(asked && t.title.trim() && asked.includes(fold(t.title)))
  const byRecent = [...themes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const threads = [...byRecent.slice(0, 12), ...byRecent.slice(12).filter(named)]
    .map((t) => digestThread(t, explorations, programmes, events, feedback, week.key, comparisons))

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
        form: chosen?.form,
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
  const lastAt = new Map<string, string>()
  for (const e of [...events].sort((a, b) => b.at.localeCompare(a.at))) {
    if (seen.has(e.recordingId)) continue
    seen.add(e.recordingId)
    lastAt.set(e.recordingId, e.at)
    recentIds.push(e.recordingId)
    if (recentIds.length >= 30) break
  }
  const itemByRecording = new Map(
    [...programmes.values()].flatMap((p) => p.sections.flatMap((s) => s.items)).map((i) => [i.recordingId, i]),
  )
  // A stand-in's recording reads as its item, credited to who actually played
  // (the shared playedProposed, as the thread digest and the season credit it).
  const standInFor = new Map<string, { item: ProgrammeItem; proposed: ProgrammeItem['proposed'] }>()
  for (const [cmpId, s] of players) {
    const [, programmeId, itemId] = cmpId.split(':')
    const item = programmes.get(programmeId)?.sections.flatMap((x) => x.items).find((i) => i.id === itemId)
    if (item) standInFor.set(s.recordingId, { item, proposed: playedProposed(item, programmeId, players, events, feedback) })
  }
  const recentListening = recentIds.flatMap((rid) => {
    const own = itemByRecording.get(rid)
    const item = own ?? standInFor.get(rid)?.item
    if (!item) return []
    const proposed = own ? item.proposed : standInFor.get(rid)!.proposed
    // What was said about the work counts too, merged as every reader merges it:
    // a note left on the work ("the sea as an orchestra") was dropped here.
    const fb = itemFeedback(feedback, [rid], item.workId)
    return [{
      composer: proposed.composer,
      work: proposed.work,
      recording: creditLine(proposed),
      state: listeningState(events, rid),
      reaction: fb.reaction,
      notes: fb.notes.slice(-3),
      heardTimes: timesHeard(events, rid),
      weeksAgo: weeksSince(lastAt.get(rid)),
    }]
  })

  // Second hearings: the latest word on a recording or its work was "interesting"
  // or "too difficult", at least three weeks ago, and it hasn't been offered again.
  const offeredAgain = new Set((await repo.marks.all()).filter((m) => m.id.startsWith('again:')).map((m) => m.id.slice('again:'.length)))
  const secondHearings: CuratorContext['secondHearings'] = []
  // Each item with its programme (item ids are only unique within one), its stand-in read with it.
  const programmeOf = new Map([...programmes.values()].flatMap((p) => p.sections.flatMap((s) => s.items).map((i) => [i, p.id] as const)))
  for (const item of itemByRecording.values()) {
    if (offeredAgain.has(item.workId) || secondHearings.some((x) => x.workId === item.workId || sameAs({ composer: item.proposed.composer, title: item.proposed.work })(x))) continue
    const programmeId = programmeOf.get(item) ?? ''
    const ids = heardAs(item, programmeId, standIns)
    const { reaction, notes } = itemFeedback(feedback, ids, item.workId)
    if (reaction !== 'interesting' && reaction !== 'too-difficult') continue
    const said = feedback.filter((f) => ids.includes(f.target.id) || f.target.id === item.workId).map((f) => f.at).sort().pop()
    const weeksAgo = weeksSince(said)
    if (weeksAgo < 3) continue
    secondHearings.push({
      composer: item.proposed.composer, work: item.proposed.work,
      // Credited to who played: heard through a stand-in, the stand-in's performers.
      recording: creditLine(playedProposed(item, programmeId, players, events, feedback)),
      reaction, note: notes.pop(), weeksAgo,
      // So the programme that takes it up is matched by the work, not the curator's spelling of it.
      workId: item.workId,
    })
  }
  secondHearings.sort((a, b) => a.weeksAgo - b.weeksAgo)

  const alreadyProgrammed: CuratorContext['alreadyProgrammed'] = []
  for (const p of [...programmes.values()].sort((a, b) => b.weekKey.localeCompare(a.weekKey))) {
    const weeksAgo = weeksBetween(p.weekKey, week.key)
    if (weeksAgo > 12 || weeksAgo < 0) continue
    for (const i of p.sections.flatMap((x) => x.items)) {
      if (!alreadyProgrammed.some(sameAs({ composer: i.proposed.composer, title: i.proposed.work, catalogue: i.proposed.catalogue }))) {
        alreadyProgrammed.push({ composer: i.proposed.composer, work: i.proposed.work, weeksAgo })
      }
    }
  }
  const known = knownWorkIds(feedback)
  const alreadyKnown: CuratorContext['alreadyKnown'] = []
  // Heard live counts as known: never offered back as a discovery.
  const allConcerts = await repo.concerts.all()
  for (const c of allConcerts) for (const w of c.works) {
    if (!alreadyKnown.some(sameAs({ composer: w.composer, title: w.title, catalogue: w.catalogue }))) alreadyKnown.push({ composer: w.composer, work: w.title })
  }
  const concerts: CuratorContext['concerts'] = allConcerts
    .map((c) => ({
      venue: c.venue, date: c.date,
      performers: [c.orchestra, c.conductor].filter(Boolean).join(', '),
      // Each work with the soloists who played in it — never the whole evening's list on every work.
      works: c.works.map((w) => {
        const who = whoPlays(c, w).map((s) => (s.instrument ? `${s.name}, ${s.instrument}` : s.name))
        return `${w.composer} — ${w.title}${who.length ? ` (with ${who.join('; ')})` : ''}`
      }),
      note: c.note,
      // The concert's own calendar date, already the listener's: its week, not an invented UTC evening.
      weeksAgo: Math.max(0, weeksBetween(weekOfDate(civilOf(c.date)).key, week.key)),
    }))
    // Heard live: never a concert still to come (a date typed ahead, or a year read wrongly).
    .filter((c) => c.weeksAgo <= 12 && c.date <= (today ?? week.endsOn))
    .sort((a, b) => b.date.localeCompare(a.date))
  for (const i of [...programmes.values()].flatMap((p) => p.sections.flatMap((x) => x.items))) {
    if (known.has(i.workId) && !alreadyKnown.some(sameAs({ composer: i.proposed.composer, title: i.proposed.work, catalogue: i.proposed.catalogue }))) {
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
    secondHearings: secondHearings.slice(0, 3),
    concerts,
    requestedNext: (requestedNext ?? nextRequest).trim() || undefined,
    thisWeek: weeks.find((w) => w.weekKey === week.key)?.mood?.length ? weeks.find((w) => w.weekKey === week.key)!.mood : undefined,
  }
}

/** "2026-10-20" as a calendar date. */
function civilOf(d: string): CivilDate {
  const [year, month, day] = d.split('-').map(Number)
  return { year, month, day }
}
