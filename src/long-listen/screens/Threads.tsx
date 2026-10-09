import { useState } from 'react'
import type { Programme, ProgrammeOption, Theme, ThemeExploration } from '../domain/types'
import { sinceWords, weekFromKey } from '../domain/week'
import { useLoad, useServices } from '../app/services'
import { go, href } from '../app/router'
import { Problem, Waiting, messageOf } from '../components/common'
import s from '../styles/editorial.module.css'

/**
 * Themes as threads. Each one keeps every visit, how it landed, the questions
 * it left open and where it could go next — the memory a returning theme is
 * built from. Below them, the paths offered and not taken, still open.
 */
export function ThreadsScreen() {
  const { repo, journey, bump, say, week } = useServices()
  const { data, error } = useLoad(async () => {
    const [themes, explorations, programmes, options] = await Promise.all([repo.themes.all(), repo.explorations.all(), repo.programmes.all(), repo.options.all()])
    return {
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

      {data.themes.length === 0 && <p className={s.quiet} style={{ marginTop: 'var(--space-xl)' }}>Nothing yet. Choose a direction this week and the first thread begins.</p>}
      <ul className={s.entries}>
        {data.themes.map((t) => <ThreadEntry key={t.id} t={t} explorations={data.explorations} programmes={data.programmes} now={week.key} />)}
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

function ThreadEntry({ t, explorations, programmes, now }: { t: Theme; explorations: ThemeExploration[]; programmes: Map<string, Programme>; now: string }) {
  const visits = explorations.filter((e) => e.themeId === t.id).sort((a, b) => a.weekKey.localeCompare(b.weekKey))
  return (
    <li className={s.entry}>
      <h2 className={s.entryTitle}>{t.title}</h2>
      <p className={s.faint}>First explored {sinceWords(t.firstIntroduced, now)} · {weekFromKey(t.firstIntroduced).label}</p>
      {t.reaction && <p>{t.reaction}</p>}
      <ul className={s.bullets}>
        {visits.map((v) => {
          const p = programmes.get(v.programmeId)
          return (
            <li key={v.id}>
              <a href={href({ name: 'programme', id: v.programmeId })}>{p?.title ?? 'Programme'}</a>
              <span className={s.faint}> · {weekFromKey(v.weekKey).label}{v.setAside ? ' · set aside' : ''}</span>
              {(v.extraProgrammeIds ?? []).map((id) => (
                <span key={id} className={s.faint}> · and <a href={href({ name: 'programme', id })}>{programmes.get(id)?.title ?? 'more'}</a></span>
              ))}
              {v.closingNote && <div className={`${s.quiet} ${s.italic}`}>{v.closingNote}</div>}
            </li>
          )
        })}
      </ul>
      {t.openQuestions.length > 0 && (
        <>
          <p className={s.h3} style={{ marginTop: 'var(--space-sm)' }}>Still open</p>
          <ul className={s.bullets}>{t.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
        </>
      )}
      {t.nextDirections.length > 0 && (
        <>
          <p className={s.h3} style={{ marginTop: 'var(--space-sm)' }}>Where it could go next</p>
          <ul className={s.bullets}>{t.nextDirections.map((q, i) => <li key={i}>{q}</li>)}</ul>
        </>
      )}
    </li>
  )
}
