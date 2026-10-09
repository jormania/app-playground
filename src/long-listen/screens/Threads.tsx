import { useState } from 'react'
import type { ListeningEvent, Programme, ProgrammeOption, Recording, Theme, ThemeExploration, Work } from '../domain/types'
import { threadContents } from '../domain/threadContents'
import { sinceWords, weekFromKey } from '../domain/week'
import { useLoad, useServices } from '../app/services'
import { go, href } from '../app/router'
import { Empty, Problem, Waiting, messageOf } from '../components/common'
import s from '../styles/editorial.module.css'

/**
 * Themes as threads. Each one keeps every visit, how it landed, the questions
 * it left open and where it could go next — the memory a returning theme is
 * built from. Below them, the paths offered and not taken, still open.
 */
export function ThreadsScreen() {
  const { repo, journey, bump, say, week } = useServices()
  const { data, error } = useLoad(async () => {
    const [themes, explorations, programmes, options, works, recordings, events] = await Promise.all([
      repo.themes.all(), repo.explorations.all(), repo.programmes.all(), repo.options.all(), repo.works.all(), repo.recordings.all(), repo.events.all(),
    ])
    return {
      works: new Map(works.map((w) => [w.id, w])),
      recordings: new Map(recordings.map((r) => [r.id, r])),
      events,
      themes: themes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      explorations,
      programmes: new Map(programmes.map((p) => [p.id, p])),
      open: options.filter((o) => o.status === 'open').sort((a, b) => b.weekKey.localeCompare(a.weekKey)),
    }
  }, [])
  const [busy, setBusy] = useState<string | null>(null)

  if (error) return <Problem error={error} />
  if (!data) return <Waiting>Gathering the threads…</Waiting>

  async function take(o: ProgrammeOption) {
    const thisWeek = await repo.weeks.get(week.key)
    if (thisWeek?.programmeId && !window.confirm('This week already has a programme. Take this path instead? The current one stays in your journal.')) return
    setBusy(o.id)
    try {
      await journey.ensureWeek()
      const p = await journey.takeOpenPath(o.id)
      bump()
      go({ name: 'programme', id: p.id })
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <p className={s.eyebrow}>Threads</p>
      <h1 className={s.title}>What we’ve been following</h1>
      <p className={s.dek}>A theme isn’t used up in a week. Each one here can return — from where it was left, not from the start.</p>

      {data.themes.length === 0 && <Empty link={{ href: '#/', label: 'Choose this week’s direction' }}>Nothing yet. Choose a direction this week and the first thread begins.</Empty>}
      {data.themes.length > 0 && <h2 className={s.sectionHead} style={{ marginTop: 'var(--space-xl)' }}>Your threads</h2>}
      <ul className={s.entries} style={{ marginTop: 0 }}>
        {data.themes.map((t) => <ThreadEntry key={t.id} t={t} explorations={data.explorations} programmes={data.programmes} works={data.works} recordings={data.recordings} events={data.events} now={week.key} />)}
      </ul>

      {data.open.length > 0 && (
        <section className={s.block}>
          <h2 className={s.sectionHead}>Paths still open</h2>
          <p className={s.quiet}>Directions offered in earlier weeks and not taken then. The curator keeps them in mind; you can also take one now.</p>
          <ul className={s.entries}>
            {data.open.map((o) => (
              <li key={o.id} className={s.entry}>
                <p className={s.mood}>Offered {sinceWords(o.weekKey, week.key)}</p>
                <h3 className={s.entryTitle}>{o.title}</h3>
                <p className={s.quiet}>{o.pitch}</p>
                <button className={s.textButton} onClick={() => take(o)} disabled={busy !== null}>{busy === o.id ? 'The curator is building it…' : 'Take this path now'}</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function ThreadEntry({ t, explorations, programmes, works, recordings, events, now }: {
  t: Theme; explorations: ThemeExploration[]; programmes: Map<string, Programme>
  works: Map<string, Work>; recordings: Map<string, Recording>; events: ListeningEvent[]; now: string
}) {
  const visits = explorations.filter((e) => e.themeId === t.id).sort((a, b) => a.weekKey.localeCompare(b.weekKey))
  // Every programme the thread has had, extras included, for what it holds.
  const held = visits.flatMap((v) => [v.programmeId, ...(v.extraProgrammeIds ?? [])]).map((id) => programmes.get(id)).filter((p): p is Programme => Boolean(p))
  const contents = threadContents(held, works, recordings, events)
  // The title opens the latest visit; the line of visits is drawn only when there is more than that one to show.
  const latest = visits[visits.length - 1]
  const lineWorthDrawing = visits.length > 1 || visits.some((v) => v.extraProgrammeIds?.length || v.closingNote)
  return (
    <li className={s.entry}>
      <h2 className={s.entryTitle}>{latest ? <a className={s.titleLink} href={href({ name: 'programme', id: latest.programmeId })}>{t.title}</a> : t.title}</h2>
      {/* When, said once: each visit below carries its own dates. */}
      <p className={s.faint}>First explored {sinceWords(t.firstIntroduced, now)}{visits.length > 1 ? ` · ${visits.length} visits` : ''}</p>
      {t.summary && <p>{t.summary}</p>}
      {contents && <p className={s.quiet}>{contents}</p>}
      {t.reaction && <p className={s.italic}>{t.reaction}</p>}
      {/* Its visits strung on one line, oldest first: the thread, drawn. */}
      {lineWorthDrawing && <ol className={s.threadLine} aria-label="Visits">
        {visits.map((v) => {
          const p = programmes.get(v.programmeId)
          // A visit named like its thread is named by its week instead, so the title isn't said twice.
          const sameName = !p || p.title === t.title
          return (
            <li key={v.id}>
              <a href={href({ name: 'programme', id: v.programmeId })}>{sameName ? weekFromKey(v.weekKey).label : p.title}</a>
              {!sameName && <span className={s.faint}> · {weekFromKey(v.weekKey).label}</span>}
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
