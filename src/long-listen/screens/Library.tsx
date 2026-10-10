import { useMemo, useState } from 'react'
import type { Concert, ProposedRecording, Recording, Work } from '../domain/types'
import { Landmark } from 'lucide-react'
import { concertDate } from './Concerts'
import { creditLine, fold, surname } from '../domain/identity'
import { compactFacts } from '../domain/workFacts'
import { latestFeedback, listeningState, reactionLabel } from '../domain/listening'
import { useLoad, useServices } from '../app/services'
import { href } from '../app/router'
import { openUrl } from '../spotify/client'
import { aboutDuration, isConfirmed } from '../spotify/verify'
import { Empty, Problem, Waiting } from '../components/common'
import { Credits } from '../components/Credits'
import { whoPlays } from '../domain/concertSoloists'
import s from '../styles/editorial.module.css'

interface Entry {
  composer: string
  works: { work: Work; recordings: { rec: Recording; proposed: ProposedRecording; programmeId?: string; programmeTitle?: string; role?: string }[]; live: Concert[] }[]
}

const STATE_WORD: Record<string, string> = { 'not-started': 'not started', listening: 'started', heard: 'heard', skipped: 'skipped' }

/**
 * Everything met so far, as a library: composers by surname, their works, and
 * every recording of each — the curator's choice and any second perspective —
 * with where it stands and what you said. Explore, without a feed.
 */
export function LibraryScreen() {
  const { repo, settings } = useServices()
  const hideSkipped = settings.hideSkipped
  const [q, setQ] = useState('')
  const { data, error, retry } = useLoad(async () => {
    const [works, recordings, programmes, comparisons, events, feedback, concerts] = await Promise.all([
      repo.works.all(), repo.recordings.all(), repo.programmes.all(), repo.comparisons.all(), repo.events.all(), repo.feedback.all(), repo.concerts.all(),
    ])
    // Heard live: each concert's works, by work.
    const liveFor = new Map<string, Concert[]>()
    for (const c of [...concerts].sort((a, b) => b.date.localeCompare(a.date))) for (const w of c.works) liveFor.set(w.workId, [...(liveFor.get(w.workId) ?? []), c])
    const composerOf = new Map(concerts.flatMap((c) => c.works.map((w) => [w.workId, w.composer] as const)))
    const met = new Map<string, { proposed: ProposedRecording; programmeId?: string; programmeTitle?: string; role?: string }>()
    // The programme a work was first offered in, so a second recording of it can say where it came from too.
    const firstFor = new Map<string, { programmeId: string; programmeTitle: string }>()
    for (const p of [...programmes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      for (const i of p.sections.flatMap((x) => x.items)) {
        if (!met.has(i.recordingId)) met.set(i.recordingId, { proposed: i.proposed, programmeId: p.id, programmeTitle: p.title })
        if (!firstFor.has(i.workId)) firstFor.set(i.workId, { programmeId: p.id, programmeTitle: p.title })
      }
    }
    // A comparison's recordings: a second hearing of a programme's work, or one
    // Spotify has standing in for the programme's choice. Said, so a recording
    // with no programme of its own doesn't look like it came from nowhere.
    for (const c of comparisons) {
      for (const pv of c.perspectives) {
        if (met.has(pv.recordingId)) continue
        met.set(pv.recordingId, { proposed: pv.proposed, ...firstFor.get(c.workId), role: c.standIn ? 'on Spotify in its place' : 'a second hearing' })
      }
    }

    const byComposer = new Map<string, Entry>()
    for (const w of works) {
      const recs = recordings
        .filter((r) => r.workId === w.id && met.has(r.id))
        .filter((r) => !hideSkipped || listeningState(events, r.id) !== 'skipped')
        .map((rec) => ({ rec, ...met.get(rec.id)! }))
      const live = liveFor.get(w.id) ?? []
      if (!recs.length && !live.length) continue
      const composer = recs[0]?.proposed.composer ?? composerOf.get(w.id) ?? ''
      const e = byComposer.get(composer) ?? { composer, works: [] }
      e.works.push({ work: w, recordings: recs, live })
      byComposer.set(composer, e)
    }
    const entries = [...byComposer.values()].sort((a, b) => surname(a.composer).localeCompare(surname(b.composer)))
    for (const e of entries) e.works.sort((a, b) => a.work.title.localeCompare(b.work.title))
    return { entries, events, feedback }
  }, [hideSkipped])

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

  if (error) return <Problem error={error} onRetry={retry} />
  if (!data) return <Waiting>Opening the library…</Waiting>

  return (
    <div>
      <p className={s.eyebrow}>Library</p>
      <h1 className={s.title}>Everything met so far</h1>
      <p className={s.dek}>Composers, their works, and every recording you’ve been offered of each.</p>
      <label className={s.visuallyHidden} htmlFor="lib-q">Search the library</label>
      <input id="lib-q" className={s.search} type="search" placeholder="A composer, a work, a conductor…" value={q} onChange={(e) => setQ(e.target.value)} />

      {data.entries.length === 0 && <Empty link={{ href: '#/', label: 'Go to this week' }}>Empty for now. It fills as your weeks do.</Empty>}
      {data.entries.length > 0 && shown.length === 0 && <p className={s.quiet}>Nothing here matches “{q}”.</p>}

      {shown.map((e, i) => {
        // A card catalogue's guide letter wherever the surnames move on to a new one.
        const letter = initialOf(e.composer)
        const newLetter = i === 0 || initialOf(shown[i - 1].composer) !== letter
        return (
        <section key={e.composer} className={s.journalWeek}>
          {newLetter && <p className={s.indexLetter} aria-hidden="true">{letter}</p>}
          <h2 className={s.h2}>{e.composer}</h2>
          {e.works.map(({ work, recordings, live }) => (
            <div key={work.id} className={s.libraryWork}>
              <p className={s.libraryTitle}>{work.title}</p>
              {/* What, which number, when — one line; the fuller words are on the programme. */}
              {compactFacts(work.form, work.catalogue, work.composed) && <p className={s.workMeta}>{compactFacts(work.form, work.catalogue, work.composed)}</p>}
              <ul className={s.libraryRecs}>
                {recordings.map(({ rec, proposed, programmeId, programmeTitle, role }) => {
                  const fb = latestFeedback(data.feedback, rec.id)
                  const state = listeningState(data.events, rec.id)
                  return (
                    <li key={rec.id} className={s.libraryRec}>
                      {/* Who played it; then, on one row, where you stand with it, how long, where to hear it and where it came from. */}
                      <Credits r={proposed} />
                      <span className={s.tagRow}>
                        <span className={`${s.tag} ${state === 'heard' ? s.tagOn : ''}`}>{STATE_WORD[state]}</span>
                        {fb.reaction && <span className={s.tag}>{reactionLabel(fb.reaction)?.toLowerCase()}</span>}
                        {isConfirmed(rec) && rec.spotify.durationMs ? <span>{aboutDuration(rec.spotify.durationMs)}</span> : null}
                        {isConfirmed(rec) && <a href={openUrl('track', rec.spotify.trackIds[0])} target="_blank" rel="noopener noreferrer">Spotify</a>}
                        {(programmeId || role) && (
                          <span>
                            {role && <>{role}{programmeId ? ', ' : ''}</>}
                            {programmeId && <>from <a href={href({ name: 'programme', id: programmeId })} className={s.quietLink}>{programmeTitle}</a></>}
                          </span>
                        )}
                      </span>
                      {fb.notes.length > 0 && <div className={s.said}><q>{fb.notes[fb.notes.length - 1]}</q></div>}
                    </li>
                  )
                })}
              </ul>
              {live.map((c) => (
                <div key={c.id} className={s.libraryLive}>
                  <p className={s.flush}>
                    <span className={`${s.tag} ${s.tagOn}`}><Landmark size={12} strokeWidth={1.8} aria-hidden="true" /> heard live</span>{' '}
                    <a href={href({ name: 'concert', id: c.id })} className={s.quietLink}>{c.venue}, {concertDate(c.date)}</a>
                  </p>
                  <Credits r={{ conductor: c.conductor, orchestra: c.orchestra, soloists: whoPlays(c, c.works.find((x) => x.workId === work.id) ?? { title: work.title, soloists: [] }) }} />
                </div>
              ))}
            </div>
          ))}
        </section>
        )
      })}
    </div>
  )
}

/** The surname's first letter, without its accent: Dvořák files under D. */
function initialOf(composer: string): string {
  return surname(composer).normalize('NFD').charAt(0).toUpperCase()
}
