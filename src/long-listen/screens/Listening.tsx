import type { ListeningEvent, ProposedRecording } from '../domain/types'
import { creditLine } from '../domain/identity'
import { latestFeedback, listeningState, reactionLabel } from '../domain/listening'
import { weekOf, weekFromKey } from '../domain/week'
import { useLoad, useServices } from '../app/services'
import { href } from '../app/router'
import { Problem, Waiting } from '../components/common'
import s from '../styles/editorial.module.css'

/**
 * What's been listened to, as a journal: by week, newest first, each recording
 * with what was said about it. Deliberately no totals, no time listened, no
 * streak — this page is memory, not measurement.
 */
export function ListeningScreen() {
  const { repo, settings, spotify, syncSpotify, say } = useServices()
  const { data, error } = useLoad(async () => {
    const [events, feedback, programmes, comparisons] = await Promise.all([repo.events.all(), repo.feedback.all(), repo.programmes.all(), repo.comparisons.all()])
    const proposedOf = new Map<string, { proposed: ProposedRecording; programmeId?: string; programmeTitle?: string }>()
    for (const p of programmes) for (const i of p.sections.flatMap((x) => x.items)) proposedOf.set(i.recordingId, { proposed: i.proposed, programmeId: p.id, programmeTitle: p.title })
    for (const c of comparisons) for (const pv of c.perspectives) if (!proposedOf.has(pv.recordingId)) proposedOf.set(pv.recordingId, { proposed: pv.proposed })

    // The week each recording was last touched in, and where it stands now.
    const lastTouch = new Map<string, ListeningEvent>()
    for (const e of events) {
      if (e.kind === 'opened') continue
      const prev = lastTouch.get(e.recordingId)
      if (!prev || e.at > prev.at) lastTouch.set(e.recordingId, e)
    }
    const byWeek = new Map<string, { rid: string; state: string }[]>()
    for (const [rid, e] of lastTouch) {
      const state = listeningState(events, rid)
      if (state === 'not-started') continue
      const wk = weekOf(new Date(e.playedAt ?? e.at), settings.timeZone).key
      byWeek.set(wk, [...(byWeek.get(wk) ?? []), { rid, state }])
    }
    return { weeks: [...byWeek.entries()].sort((a, b) => b[0].localeCompare(a[0])), proposedOf, feedback }
  }, [settings.timeZone])

  if (error) return <Problem error={error} />
  if (!data) return <Waiting>Opening the journal…</Waiting>

  const STATE_WORD: Record<string, string> = { heard: 'Heard', listening: 'Listening', skipped: 'Set aside for now' }

  return (
    <div>
      <p className={s.eyebrow}>My listening</p>
      <h1 className={s.title}>What we’ve heard</h1>
      <p className={s.dek}>Recordings you’ve heard or started, and what you said about them — the curator reads this too.</p>
      {spotify.connected && (
        <p className={s.faint}>
          Spotify’s recent history is checked each time you open the app.{' '}
          <button className={s.textButton} onClick={() => syncSpotify().then((n) => say(n ? 'Picked up your recent Spotify listening.' : 'Nothing new from Spotify.')).catch(() => say('Spotify can’t be reached right now.', 'danger'))}>Check now</button>
        </p>
      )}

      {data.weeks.length === 0 && <p className={s.quiet} style={{ marginTop: 'var(--space-xl)' }}>Nothing here yet. Mark a recording as heard on this week’s programme, or connect Spotify to have it noticed.</p>}

      {data.weeks.map(([wk, list]) => (
        <section key={wk}>
          <h2 className={s.weekHead}>{weekFromKey(wk).label}</h2>
          <ul className={s.entries} style={{ marginTop: 0 }}>
            {list.map(({ rid, state }) => {
              const info = data.proposedOf.get(rid)
              if (!info) return null
              const fb = latestFeedback(data.feedback, rid)
              return (
                <li key={rid} className={s.entry}>
                  <p className={s.composer}>{info.proposed.composer}</p>
                  <h3 className={s.entryTitle}>{info.proposed.work}</h3>
                  <p className={s.quiet}>{creditLine(info.proposed)}</p>
                  <p className={s.faint}>
                    {STATE_WORD[state]}{fb.reaction ? ` · ${reactionLabel(fb.reaction)}` : ''}
                    {info.programmeId && <> · from <a href={href({ name: 'programme', id: info.programmeId })}>{info.programmeTitle}</a></>}
                  </p>
                  {fb.notes.map((n, i) => <p key={i} className={s.said}><q>{n}</q></p>)}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
