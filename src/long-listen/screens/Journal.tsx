import type { Concert, ListeningEvent, ProgrammeOption, ProposedRecording } from '../domain/types'
import { creditLine } from '../domain/identity'
import { latestFeedback, listeningState, reactionLabel } from '../domain/listening'
import { weekFromKey, weekOf } from '../domain/week'
import { useLoad, useServices } from '../app/services'
import { Landmark } from 'lucide-react'
import { concertDate, concertPerformers } from './Concerts'
import { href } from '../app/router'
import { Empty, Problem, Waiting } from '../components/common'
import s from '../styles/editorial.module.css'

const OPTION_WORD: Record<ProgrammeOption['status'], string> = {
  offered: 'offered',
  chosen: 'chosen',
  open: 'left open',
  'taken-later': 'taken later',
  'set-aside': 'begun, then set aside',
}

/**
 * The journal: every week so far, newest first — the three directions offered,
 * the one followed, and what was heard and said. Deliberately no totals, no time
 * listened, no streak. This page is memory, not measurement.
 */
export function JournalScreen() {
  const { repo, settings, spotify, syncSpotify, say } = useServices()
  const { data, error } = useLoad(async () => {
    const [weeks, options, events, feedback, programmes, comparisons, concerts] = await Promise.all([
      repo.weeks.all(), repo.options.all(), repo.events.all(), repo.feedback.all(), repo.programmes.all(), repo.comparisons.all(), repo.concerts.all(),
    ])
    // Concerts stand in the week they happened, with the hall's mark: live, not the week's programme.
    const concertsIn = new Map<string, Concert[]>()
    for (const c of [...concerts].sort((a, b) => a.date.localeCompare(b.date))) {
      const wk = weekOf(new Date(`${c.date}T12:00:00Z`), settings.timeZone).key
      concertsIn.set(wk, [...(concertsIn.get(wk) ?? []), c])
    }
    const proposedOf = new Map<string, { proposed: ProposedRecording; programmeId?: string }>()
    for (const p of programmes) for (const i of p.sections.flatMap((x) => x.items)) proposedOf.set(i.recordingId, { proposed: i.proposed, programmeId: p.id })
    for (const c of comparisons) for (const pv of c.perspectives) if (!proposedOf.has(pv.recordingId)) proposedOf.set(pv.recordingId, { proposed: pv.proposed })

    // Each recording appears in the week it was last touched, with where it stands now.
    const lastTouch = new Map<string, ListeningEvent>()
    for (const e of events) {
      if (e.kind === 'opened') continue
      const prev = lastTouch.get(e.recordingId)
      if (!prev || e.at > prev.at) lastTouch.set(e.recordingId, e)
    }
    const heardIn = new Map<string, { rid: string; state: string }[]>()
    for (const [rid, e] of lastTouch) {
      const state = listeningState(events, rid)
      if (state === 'not-started') continue
      const wk = weekOf(new Date(e.playedAt ?? e.at), settings.timeZone).key
      heardIn.set(wk, [...(heardIn.get(wk) ?? []), { rid, state }])
    }

    const optionById = new Map(options.map((o) => [o.id, o]))
    const keys = [...new Set([...weeks.map((w) => w.weekKey), ...heardIn.keys(), ...concertsIn.keys()])].sort((a, b) => b.localeCompare(a))
    const programmeTitle = new Map(programmes.map((p) => [p.id, p.title]))
    const extensionsOf = new Map<string, string[]>()
    for (const p of [...programmes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      if (p.extends) extensionsOf.set(p.extends, [...(extensionsOf.get(p.extends) ?? []), p.id])
    }
    return {
      entries: keys.map((key) => {
        const w = weeks.find((x) => x.weekKey === key)
        const offered = w ? [...(w.earlierOptionIds ?? []), ...w.optionIds].map((id) => optionById.get(id)).filter((o): o is ProgrammeOption => Boolean(o)) : []
        const taken = w?.chosenOptionId ? optionById.get(w.chosenOptionId) : undefined
        if (taken && !offered.includes(taken)) offered.push(taken)
        return { key, week: w, offered, heard: heardIn.get(key) ?? [], concerts: concertsIn.get(key) ?? [] }
      }),
      proposedOf, feedback, programmeTitle, extensionsOf, concertCount: concerts.length,
    }
  }, [settings.timeZone])

  if (error) return <Problem error={error} />
  if (!data) return <Waiting>Opening the journal…</Waiting>
  const STATE_WORD: Record<string, string> = { heard: 'Heard', listening: 'Started', skipped: 'Skipped' }

  return (
    <div>
      <p className={s.eyebrow}>Journal</p>
      <h1 className={s.title}>The weeks so far</h1>
      <p className={s.dek}>What was offered, which way you went, and what stayed with you.</p>
      <p className={s.faint}>
        <Landmark size={15} strokeWidth={1.6} aria-hidden="true" className={s.hallMark} />{' '}
        <a href={href({ name: 'concerts' })}>All concerts</a>{data.concertCount ? '' : ' — what you hear live, kept here too'} · <a href={href({ name: 'concert', id: 'new' })}>add one</a>
      </p>
      {spotify.connected && (
        <p className={s.faint}>
          Your recent Spotify listening is picked up each time you open the app.{' '}
          <button className={s.textButton} onClick={() => syncSpotify().then((n) => say(n ? 'Picked up your recent Spotify listening.' : 'Nothing new from Spotify.')).catch(() => say('Spotify can’t be reached right now.', 'danger'))}>Check now</button>
        </p>
      )}
      {data.entries.length === 0 && <Empty link={{ href: '#/', label: 'Go to this week' }}>Nothing here yet. Your first week begins on This week.</Empty>}

      {data.entries.map(({ key, week, offered, heard, concerts }) => {
        const wk = weekFromKey(key)
        return (
          <section key={key} className={s.journalWeek} aria-label={`Week ${wk.number}`}>
            {/* The week's number in the margin, a rule running down to the next:
                the journal reads as a timeline, not a feed. */}
            <div className={s.weekMark} aria-hidden="true">
              <span className={s.weekWord}>Week</span>
              <span className={s.weekNum}>{wk.number}</span>
            </div>
            <div className={s.weekBody}>
            <h2 className={s.weekHead}>{wk.label}</h2>
            {week?.programmeId && (
              <p className={s.entryTitle} style={{ margin: 0 }}>
                <a href={href({ name: 'programme', id: week.programmeId })} className={s.quietLink}>{data.programmeTitle.get(week.programmeId)}</a>
              </p>
            )}
            {week?.programmeId && (data.extensionsOf.get(week.programmeId) ?? []).map((id) => (
              <p key={id} className={s.quiet} style={{ margin: 0 }}>
                and more: <a href={href({ name: 'programme', id })} className={s.quietLink}>{data.programmeTitle.get(id)}</a>
              </p>
            ))}
            {(week?.setAsideProgrammeIds ?? []).map((id) => (
              <p key={id} className={s.faint} style={{ margin: 0 }}>
                set aside: <a href={href({ name: 'programme', id })} className={s.quietLink}>{data.programmeTitle.get(id)}</a>
              </p>
            ))}
            {offered.length > 0 && (
              <ul className={s.offeredList} aria-label="Offered this week">
                {offered.map((o) => (
                  <li key={o.id}>
                    <span className={o.status === 'chosen' ? undefined : s.quiet}>{o.title}</span>{' '}
                    <span className={`${s.tag} ${o.status === 'chosen' ? s.tagOn : ''}`}>{OPTION_WORD[o.status]}</span>
                  </li>
                ))}
              </ul>
            )}
            {concerts.map((c) => (
              <div key={c.id} className={s.journalConcert}>
                <p className={s.composer}><Landmark size={15} strokeWidth={1.6} aria-hidden="true" className={s.hallMark} /> Heard live · {c.venue} · {concertDate(c.date)}</p>
                <a className={`${s.entryTitle} ${s.quietLink}`} href={href({ name: 'concert', id: c.id })}>{c.works.map((w) => `${w.composer.split(' ').slice(-1)[0]}, ${w.title}`).join(' · ')}</a>
                {concertPerformers(c) && <p className={s.quiet} style={{ margin: 0 }}>{concertPerformers(c)}</p>}
                {c.note && <p className={s.said}><q>{c.note}</q></p>}
              </div>
            ))}
            {heard.length > 0 && (
              <ul className={s.entries} style={{ marginTop: 'var(--space-sm)' }}>
                {heard.map(({ rid, state }) => {
                  const info = data.proposedOf.get(rid)
                  if (!info) return null
                  const fb = latestFeedback(data.feedback, rid)
                  return (
                    <li key={rid} className={s.entry}>
                      <p className={s.composer}>{info.proposed.composer}</p>
                      <h3 className={s.h2} style={{ margin: 0 }}>{info.proposed.work}</h3>
                      <p className={s.quiet}>{creditLine(info.proposed)}</p>
                      <p className={s.tagRow}>
                        <span className={`${s.tag} ${state === 'heard' ? s.tagOn : ''}`}>{STATE_WORD[state]}</span>
                        {fb.reaction && <span className={s.tag}>{reactionLabel(fb.reaction)}</span>}
                      </p>
                      {fb.notes.map((n, i) => <p key={i} className={s.said}><q>{n}</q></p>)}
                    </li>
                  )
                })}
              </ul>
            )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
