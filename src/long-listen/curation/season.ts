import type { Repo } from '../store/repo'
import type { WeekKey } from '../domain/types'
import { creditLine } from '../domain/identity'
import { listeningState } from '../domain/listening'
import { feedbackOnAny, heardAs, standInsOf } from './continuity'
import { weekFromKey } from '../domain/week'
import type { Season } from '../domain/season'

/**
 * What the curator reads to write a season in review: only that season's
 * weeks — their programmes and sittings, the threads they touched, what was
 * heard and said, concerts heard live, the taste notes first or last seen in
 * it, and the paths left open. Facts only; the prose is the curator's.
 */
export async function seasonContext(repo: Repo, s: Season, now: WeekKey) {
  const inSeason = new Set(s.weekKeys.filter((k) => k <= now))
  const [weeks, programmes, explorations, themes, options, events, feedback, concerts, taste, prefs, comparisons] = await Promise.all([
    repo.weeks.all(), repo.programmes.all(), repo.explorations.all(), repo.themes.all(), repo.options.all(),
    repo.events.all(), repo.feedback.all(), repo.concerts.all(), repo.taste(), repo.preferences(), repo.comparisons.all(),
  ])
  // A work heard through a stand-in was heard: its listening and reactions sit under the stand-in.
  const standIns = standInsOf(comparisons)
  const progs = programmes.filter((p) => inSeason.has(p.weekKey))
  const items = progs.flatMap((p) => p.sections.flatMap((x) => x.items).map((i) => ({ i, p })))
  const said = (id: string | string[]) => {
    const f = feedbackOnAny(feedback, Array.isArray(id) ? id : [id])
    return { ...(f.reaction ? { reaction: f.reaction } : {}), ...(f.notes.length ? { said: f.notes } : {}) }
  }
  const met = items.map(({ i, p }) => {
    const ids = heardAs(i, p.id, standIns)
    return {
      composer: i.proposed.composer, work: i.proposed.work, recording: creditLine(i.proposed), week: weekFromKey(p.weekKey).label,
      state: listeningState(events, ids), ...said(ids), ...said(i.workId),
    }
  })
  const exs = explorations.filter((e) => inSeason.has(e.weekKey))
  const themeIds = [...new Set(exs.map((e) => e.themeId))]
  const start = s.startsOn
  const end = s.endsOn
  const seen = (iso: string) => iso.slice(0, 10) >= start && iso.slice(0, 10) <= end
  return {
    language: prefs.language,
    season: { number: s.number, label: s.label, weeksSoFar: s.weeksSoFar },
    soFar: !s.complete,
    weeks: weeks.filter((w) => inSeason.has(w.weekKey)).sort((a, b) => a.weekKey.localeCompare(b.weekKey)).map((w) => {
      // "More of this theme" of a programme set aside went with it: it is not still part of the week.
      const setAside = (p: (typeof progs)[number]) => w.setAsideProgrammeIds.includes(p.id) || Boolean(p.extends && w.setAsideProgrammeIds.includes(p.extends))
      return {
        week: weekFromKey(w.weekKey).label,
        programme: progs.find((p) => p.id === w.programmeId)?.title,
        alsoThisWeek: progs.filter((p) => p.weekKey === w.weekKey && p.id !== w.programmeId && !setAside(p)).map((p) => (p.sitting ? `a sitting: ${p.title} ("${p.sitting.request}")` : p.title)),
        setAside: progs.filter((p) => p.weekKey === w.weekKey && setAside(p)).map((p) => p.title),
        mood: w.mood,
        ...said(w.programmeId ?? ''),
      }
    }),
    threads: themes.filter((t) => themeIds.includes(t.id)).map((t) => ({
      title: t.title, summary: t.summary, reaction: t.reaction, openQuestions: t.openQuestions, nextDirections: t.nextDirections,
      visitsThisSeason: exs.filter((e) => e.themeId === t.id).length, ...said(t.id),
    })),
    heard: met.filter((m) => m.state === 'heard'),
    started: met.filter((m) => m.state === 'listening'),
    skipped: met.filter((m) => m.state === 'skipped').map((m) => ({ composer: m.composer, work: m.work })),
    concerts: concerts.filter((c) => c.date >= start && c.date <= end).map((c) => ({ venue: c.venue, date: c.date, works: c.works.map((w) => `${w.composer}, ${w.title}`), said: c.note })),
    taste: {
      newThisSeason: taste.observations.filter((o) => !o.supersededBy && seen(o.firstSeen)).map((o) => ({ statement: o.statement, stance: o.stance, confidence: o.confidence })),
      heldBefore: taste.observations.filter((o) => !o.supersededBy && !seen(o.firstSeen)).map((o) => ({ statement: o.statement, stance: o.stance, confidence: o.confidence, stillSeenThisSeason: seen(o.lastSeen) })),
      changed: taste.observations.filter((o) => o.supersededBy && seen(o.lastSeen)).map((o) => ({ was: o.statement, became: taste.observations.find((x) => x.id === o.supersededBy)?.statement })),
      questions: taste.questions,
    },
    openPaths: options.filter((o) => o.status === 'open' && inSeason.has(o.weekKey)).map((o) => ({ title: o.title, pitch: o.pitch })),
  }
}
