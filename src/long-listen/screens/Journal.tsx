import type { ListeningEvent, ProgrammeOption, ProposedRecording } from '../domain/types'
import { creditLine } from '../domain/identity'
import { latestFeedback, listeningState, reactionLabel } from '../domain/listening'
import { weekFromKey, weekOf } from '../domain/week'
import { useLoad, useServices } from '../app/services'
import { href } from '../app/router'
import { Problem, Waiting } from '../components/common'
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
    const [weeks, options, events, feedback, programmes, comparisons] = await Promise.all([
      repo.weeks.all(), repo.options.all(), repo.events.all(), repo.feedback.all(), repo.programmes.all(), repo.comparisons.all(),
    ])
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
    const keys = [...new Set([...weeks.map((w) => w.weekKey), ...heardIn.keys()])].sort((a, b) => b.localeCompare(a))
    const programmeTitle = new Map(programmes.map((p) => [p.id, p.title]))
    return {
      entries: keys.map((key) => {
        const w = weeks.find((x) => x.weekKey === key)
        const offered = w ? [...(w.earlierOptionIds ?? []), ...w.optionIds].map((id) => optionById.get(id)).filter((o): o is ProgrammeOption => Boolean(o)) : []
        const taken = w?.chosenOptionId ? optionById.get(w.chosenOptionId) : undefined
        if (taken && !offered.includes(taken)) offered.push(taken)
        return { key, week: w, offered, heard: heardIn.get(key) ?? [] }
      }),
      proposedOf, feedback, programmeTitle,
    }
  }, [settings.timeZone])

  if (error) return <Problem error={error} />
  if (!data) return <Waiting>Opening the journal…</Waiting>
  const STATE_WORD: Record<string, string> = { heard: 'Heard', listening: 'Listening', skipped: 'Set aside for now' }

  return (
    <div>
      <p className={s.eyebrow}>Journal</p>
      <h1 className={s.title}>The weeks so far</h1>
      <p className={s.dek}>What was offered, which way you went, and what stayed with you.</p>
      {spotify.connected && (
        <p className={s.faint}>
          Your recent Spotify listening is picked up each time you open the app.{' '}
          <button className={s.textButton} onClick={() => syncSpotify().then((n) => say(n ? 'Picked up your recent Spotify listening.' : 'Nothing new from Spotify.')).catch(() => say('Spotify can’t be reached right now.', 'danger'))}>Check now</button>
        </p>
      )}
      {data.entries.length === 0 && <p className={s.quiet} style={{ marginTop: 'var(--space-xl)' }}>Nothing here yet. Your first week begins on This week.</p>}

      {data.entries.map(({ key, week, offered, heard }) => {
        const wk = weekFromKey(key)
        return (
          <section key={key} className={s.journalWeek}>
            <h2 className={s.weekHead}>Week {wk.number} · {wk.label}</h2>
            {week?.programmeId && (
              <p className={s.entryTitle} style={{ margin: 0 }}>
                <a href={href({ name: 'programme', id: week.programmeId })} className={s.quietLink}>{data.programmeTitle.get(week.programmeId)}</a>
              </p>
            )}
            {offered.length > 0 && (
              <p className={s.faint}>
                {offered.map((o, i) => <span key={o.id}>{i ? ' · ' : ''}{o.title} <span className={s.italic}>({OPTION_WORD[o.status]})</span></span>)}
              </p>
            )}
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
                      <p className={s.faint}>{STATE_WORD[state]}{fb.reaction ? ` · ${reactionLabel(fb.reaction)}` : ''}</p>
                      {fb.notes.map((n, i) => <p key={i} className={s.said}><q>{n}</q></p>)}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
