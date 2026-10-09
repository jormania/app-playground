import { useMemo, useState } from 'react'
import type { ProposedRecording, Recording, Work } from '../domain/types'
import { creditLine, fold, surname } from '../domain/identity'
import { latestFeedback, listeningState, reactionLabel } from '../domain/listening'
import { useLoad, useServices } from '../app/services'
import { href } from '../app/router'
import { openUrl } from '../spotify/client'
import { aboutDuration, isConfirmed } from '../spotify/verify'
import { Problem, Waiting } from '../components/common'
import s from '../styles/editorial.module.css'

interface Entry {
  composer: string
  works: { work: Work; recordings: { rec: Recording; proposed: ProposedRecording; programmeId?: string; programmeTitle?: string }[] }[]
}

const STATE_WORD: Record<string, string> = { 'not-started': 'not yet heard', listening: 'started', heard: 'heard', skipped: 'set aside' }

/**
 * Everything met so far, as a library: composers by surname, their works, and
 * every recording of each — the curator's choice and any second perspective —
 * with where it stands and what you said. Explore, without a feed.
 */
export function LibraryScreen() {
  const { repo } = useServices()
  const [q, setQ] = useState('')
  const { data, error } = useLoad(async () => {
    const [works, recordings, programmes, comparisons, events, feedback] = await Promise.all([
      repo.works.all(), repo.recordings.all(), repo.programmes.all(), repo.comparisons.all(), repo.events.all(), repo.feedback.all(),
    ])
    const met = new Map<string, { proposed: ProposedRecording; programmeId?: string; programmeTitle?: string }>()
    for (const p of [...programmes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      for (const i of p.sections.flatMap((x) => x.items)) if (!met.has(i.recordingId)) met.set(i.recordingId, { proposed: i.proposed, programmeId: p.id, programmeTitle: p.title })
    }
    for (const c of comparisons) for (const pv of c.perspectives) if (!met.has(pv.recordingId)) met.set(pv.recordingId, { proposed: pv.proposed })

    const byComposer = new Map<string, Entry>()
    for (const w of works) {
      const recs = recordings.filter((r) => r.workId === w.id && met.has(r.id)).map((rec) => ({ rec, ...met.get(rec.id)! }))
      if (!recs.length) continue
      const composer = recs[0].proposed.composer
      const e = byComposer.get(composer) ?? { composer, works: [] }
      e.works.push({ work: w, recordings: recs })
      byComposer.set(composer, e)
    }
    const entries = [...byComposer.values()].sort((a, b) => surname(a.composer).localeCompare(surname(b.composer)))
    for (const e of entries) e.works.sort((a, b) => a.work.title.localeCompare(b.work.title))
    return { entries, events, feedback }
  }, [])

  const shown = useMemo(() => {
    if (!data) return []
    const needle = fold(q)
    if (!needle) return data.entries
    return data.entries
      .map((e) => {
        if (fold(e.composer).includes(needle)) return e
        const works = e.works.filter((w) => fold(w.work.title).includes(needle) || w.recordings.some((r) => fold(creditLine(r.proposed)).includes(needle)))
        return works.length ? { ...e, works } : null
      })
      .filter((e): e is Entry => Boolean(e))
  }, [data, q])

  if (error) return <Problem error={error} />
  if (!data) return <Waiting>Opening the library…</Waiting>

  return (
    <div>
      <p className={s.eyebrow}>Library</p>
      <h1 className={s.title}>Everything met so far</h1>
      <p className={s.dek}>Composers, their works, and every recording you’ve been offered of each.</p>
      <label className={s.visuallyHidden} htmlFor="lib-q">Search the library</label>
      <input id="lib-q" className={s.search} type="search" placeholder="A composer, a work, a conductor…" value={q} onChange={(e) => setQ(e.target.value)} />

      {data.entries.length === 0 && <p className={s.quiet} style={{ marginTop: 'var(--space-xl)' }}>Empty for now. It fills as your weeks do.</p>}
      {data.entries.length > 0 && shown.length === 0 && <p className={s.quiet}>Nothing here matches “{q}”.</p>}

      {shown.map((e) => (
        <section key={e.composer} className={s.journalWeek}>
          <h2 className={s.h2}>{e.composer}</h2>
          {e.works.map(({ work, recordings }) => (
            <div key={work.id} className={s.libraryWork}>
              <p className={s.libraryTitle}>{work.title}</p>
              <p className={s.faint}>{[work.catalogue, work.composed, work.form, undefined].filter(Boolean).join(' · ')}</p>
              <ul className={s.bullets}>
                {recordings.map(({ rec, proposed, programmeId, programmeTitle }) => {
                  const fb = latestFeedback(data.feedback, rec.id)
                  const state = listeningState(data.events, rec.id)
                  return (
                    <li key={rec.id}>
                      {creditLine(proposed)}
                      <span className={s.faint}>
                        {' · '}{STATE_WORD[state]}
                        {fb.reaction ? ` · ${reactionLabel(fb.reaction)?.toLowerCase()}` : ''}
                        {isConfirmed(rec) && rec.spotify.durationMs ? ` · ${aboutDuration(rec.spotify.durationMs)}` : ''}
                      </span>
                      {' '}
                      {isConfirmed(rec) && <a href={openUrl('track', rec.spotify.trackIds[0])} target="_blank" rel="noopener noreferrer">Spotify</a>}
                      {programmeId && <> · <a href={href({ name: 'programme', id: programmeId })} className={s.quietLink}>{programmeTitle}</a></>}
                      {fb.notes.length > 0 && <div className={s.said}><q>{fb.notes[fb.notes.length - 1]}</q></div>}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
