import type { ListeningEvent, Programme, Recording, Theme, ThemeExploration, Work } from '../domain/types'
import { threadContents } from '../domain/threadContents'
import { standInsOf } from '../curation/continuity'
import { sinceWords, weekFromKey } from '../domain/week'
import { useLoad, useServices } from '../app/services'
import { href } from '../app/router'
import { Empty, Problem, Waiting } from '../components/common'
import { OpenPaths } from '../components/OpenPaths'
import s from '../styles/editorial.module.css'

/**
 * Themes as threads. Each one keeps every visit, how it landed, the questions
 * it left open and where it could go next — the memory a returning theme is
 * built from. Below them, the paths offered and not taken, still open.
 */
export function ThreadsScreen() {
  const { repo, week, settings } = useServices()
  const { data, error, retry } = useLoad(async () => {
    const [themes, explorations, programmes, options, works, recordings, events, comparisons] = await Promise.all([
      repo.themes.all(), repo.explorations.all(), repo.programmes.all(), repo.options.all(), repo.works.all(), repo.recordings.all(), repo.events.all(), repo.comparisons.all(),
    ])
    return {
      works: new Map(works.map((w) => [w.id, w])),
      recordings: new Map(recordings.map((r) => [r.id, r])),
      events,
      // A work heard through a stand-in is heard, and runs as long as the stand-in does.
      standIns: standInsOf(comparisons),
      themes: themes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      explorations,
      programmes: new Map(programmes.map((p) => [p.id, p])),
      // Earlier weeks only, as the heading says (and as This week and the programme count them):
      // this week's own directions left open are still on This week to choose between.
      open: options.filter((o) => o.status === 'open' && o.weekKey < week.key).sort((a, b) => b.weekKey.localeCompare(a.weekKey)),
    }
  }, [week.key])

  if (error) return <Problem error={error} onRetry={retry} />
  if (!data) return <Waiting>Gathering the threads…</Waiting>

  return (
    <div>
      <p className={s.eyebrow}>Threads</p>
      <h1 className={s.title}>What we’ve been following</h1>
      <p className={s.dek}>A theme isn’t used up in a week. Each one here can return — from where it was left, not from the start.</p>

      {data.themes.length === 0 && <Empty link={{ href: href({ name: 'week' }), label: 'This week' }}>Nothing yet. Choose a direction this week and the first thread begins.</Empty>}
      {data.themes.length > 0 && <h2 className={s.sectionHead}>Your threads</h2>}
      <ul className={s.entries}>
        {data.themes.map((t) => <ThreadEntry key={t.id} t={t} explorations={data.explorations} programmes={data.programmes} works={data.works} recordings={data.recordings} events={data.events} standIns={data.standIns} now={week.key} hideSkipped={settings.hideSkipped} />)}
      </ul>

      {data.open.length > 0 && (
        <section className={s.block} aria-label="Paths still open">
          <h2 className={s.sectionHead}>Paths still open</h2>
          <p className={s.sectionGuide}>Directions offered in earlier weeks and not taken then. The curator keeps them in mind; you can also take one now.</p>
          <OpenPaths paths={data.open} nowKey={week.key} level={3} />
        </section>
      )}
    </div>
  )
}

function ThreadEntry({ t, explorations, programmes, works, recordings, events, standIns, now, hideSkipped }: {
  t: Theme; explorations: ThemeExploration[]; programmes: Map<string, Programme>
  works: Map<string, Work>; recordings: Map<string, Recording>; events: ListeningEvent[]; standIns: Map<string, string>; now: string; hideSkipped: boolean
}) {
  const visits = explorations.filter((e) => e.themeId === t.id).sort((a, b) => a.weekKey.localeCompare(b.weekKey))
  // Every programme the thread has had, extras included, for what it holds.
  const held = visits.flatMap((v) => [v.programmeId, ...(v.extraProgrammeIds ?? [])]).map((id) => programmes.get(id)).filter((p): p is Programme => Boolean(p))
  const contents = threadContents(held, works, recordings, events, hideSkipped, standIns)
  // The title opens the latest visit; the line of visits is drawn only when there is more than that one to show.
  const latest = visits[visits.length - 1]
  const lineWorthDrawing = visits.length > 1 || visits.some((v) => v.extraProgrammeIds?.length || v.closingNote)
  return (
    <li className={s.entry}>
      <h3 className={s.entryTitle}>{latest ? <a className={s.titleLink} href={href({ name: 'programme', id: latest.programmeId })}>{t.title}</a> : t.title}</h3>
      {/* When, said once: each visit below carries its own dates. */}
      <p className={s.faint}>First explored {sinceWords(t.firstIntroduced, now)}{visits.length > 1 ? ` · ${visits.length} visits` : ''}</p>
      {t.summary && <p>{t.summary}</p>}
      {/* What the thread holds, one fact to a line on an accent edge — read at a glance, not as another paragraph. */}
      {contents && (
        <ul className={s.threadFacts} aria-label="What this thread holds">
          {contents.split(' · ').map((fact) => <li key={fact}>{fact}</li>)}
        </ul>
      )}
      {t.reaction && <p className={s.italic}>{t.reaction}</p>}
      {/* Its visits strung on one line, oldest first: the thread, drawn. */}
      {lineWorthDrawing && <ol className={s.threadLine} aria-label="Visits">
        {visits.map((v) => {
          const p = programmes.get(v.programmeId)
          // Every visit by its programme's name, then its week — the first included, even when the
          // thread took its name from it: a visit known only by its dates reads as missing its name.
          return (
            <li key={v.id}>
              <a href={href({ name: 'programme', id: v.programmeId })}>{p?.title ?? weekFromKey(v.weekKey).label}</a>
              {p && <span className={s.faint}> · {weekFromKey(v.weekKey).label}</span>}
              {v.setAside && <span className={s.faint}> · set aside</span>}
              {(v.extraProgrammeIds ?? []).map((id) => (
                <span key={id} className={s.faint}> · and <a href={href({ name: 'programme', id })}>{programmes.get(id)?.title ?? 'more'}</a></span>
              ))}
              {v.closingNote && <div className={`${s.quiet} ${s.italic}`}>{v.closingNote}</div>}
            </li>
          )
        })}
      </ol>}
      {(t.openQuestions.length > 0 || t.nextDirections.length > 0) && (
        <div className={s.threadNotes}>
          {t.openQuestions.length > 0 && (
            <div>
              <p className={s.h3}>Still open</p>
              <ul className={s.bullets}>{t.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </div>
          )}
          {t.nextDirections.length > 0 && (
            <div>
              <p className={s.h3}>Where it could go next</p>
              <ul className={s.bullets}>{t.nextDirections.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </li>
  )
}
