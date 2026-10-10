import { useEffect, useRef, useState } from 'react'
import type { ProgrammeItem } from '../domain/types'
import { creditLine } from '../domain/identity'
import { listeningState } from '../domain/listening'
import { useLoad, useServices } from '../app/services'
import { href } from '../app/router'
import { useWakeLock } from '../../shared/useWakeLock'
import { applyDusk, chooseDusk, likeDusk, recordDusk } from '../app/theme'
import { usePlayback } from '../app/playback'
import { ListenBar } from '../components/ListenBar'
import { FeedbackPanel } from '../components/FeedbackPanel'
import { aboutDuration, isConfirmed } from '../spotify/verify'
import { MAX_ASK, Paragraphs, Problem, Waiting, messageOf } from '../components/common'
import { NotFound } from '../store/repo'
import { Credits } from '../components/Credits'
import s from '../styles/editorial.module.css'

/**
 * One recording, while it plays: the work, who plays it, and what to listen
 * for, in large type with the screen kept awake. With Spotify connected and
 * playing this recording, the movement that's sounding is marked — a place in
 * the music, not a progress bar.
 *
 * One work at a time, and it stops when the work does: nothing plays on by
 * itself. "I've heard it" asks how it landed in place, then offers the next
 * work, for when the listener is ready.
 */
export function ListenModeScreen({ programmeId, itemId }: { programmeId: string; itemId: string }) {
  const { repo, spotify, journey, bump } = useServices()
  const { data, error, retry } = useLoad(async () => {
    const programme = await repo.programmes.require(programmeId)
    const items = programme.sections.flatMap((x) => x.items)
    const item = items.find((i) => i.id === itemId)
    if (!item) throw new NotFound(`item ${itemId} is not in programme ${programmeId}`)
    const standIns = new Map((await repo.comparisons.many(items.map((i) => `cmp:${programmeId}:${i.id}`))).filter((c) => c.standIn).map((c) => [c.id.split(':').pop()!, c]))
    const ids = [...items.map((i) => i.recordingId), ...[...standIns.values()].flatMap((c) => c.perspectives.map((x) => x.recordingId))]
    const [recordings, events, feedback, explanation, answers] = await Promise.all([
      repo.recordings.many(ids), repo.events.all(), repo.feedback.all(), repo.explanations.get(`${programmeId}:${itemId}`), journey.answers(programmeId, itemId),
    ])
    const byId = new Map(recordings.map((r) => [r.id, r]))
    // What plays: the programme's recording, or — when Spotify lacks it — the stand-in found in its place.
    const playable = (i: ProgrammeItem) => {
      if (isConfirmed(byId.get(i.recordingId))) return { recording: byId.get(i.recordingId), proposed: i.proposed, standIn: false }
      const other = standIns.get(i.id)?.perspectives[1]
      return other && isConfirmed(byId.get(other.recordingId)) ? { recording: byId.get(other.recordingId), proposed: other.proposed, standIn: true } : undefined
    }
    const here = playable(item)
    const notes = here?.recording ? (await repo.marks.get(`companion:${here.recording.id}`))?.value as { movements: string[] } | undefined : undefined
    return {
      programme, item, recording: here?.recording, credit: here?.proposed ?? item.proposed, standIn: here?.standIn ?? false,
      next: nextWork(items, item, (i) => Boolean(playable(i)), (i) => [i.recordingId, ...(standIns.get(i.id)?.perspectives[1] ? [standIns.get(i.id)!.perspectives[1].recordingId] : [])], events), feedback, notes: notes?.movements ?? [], explanation, answers,
    }
  }, [programmeId, itemId])
  useWakeLock(true)

  // Dusk while this screen is open: a dark shade with light text, chosen afresh on each visit while the owner decides.
  const { settings } = useServices()
  // Chosen once per visit (a change in Settings shows on the next one), counted once, applied while open —
  // and only once there is a work to show: a dead link is not a visit, and its message reads on the paper.
  const [shade] = useState(() => chooseDusk(settings.dusk))
  const [duskChoice] = useState(settings.dusk)
  const [liked, setLiked] = useState(false)
  const counted = useRef(false)
  const loaded = Boolean(data)
  useEffect(() => {
    if (!loaded) return
    if (!counted.current) { counted.current = true; recordDusk(shade, duskChoice) }
    return applyDusk(shade)
  }, [shade, duskChoice, loaded])
  const sp0 = isConfirmed(data?.recording) ? data.recording.spotify : undefined
  // Which movement is sounding, playing or paused — shared with the programme's buttons.
  const playback = usePlayback(sp0?.trackUris, sp0?.trackIds)

  const { curatorReady, say } = useServices()
  // The companion's notes are written once per programme; if this recording has none yet, ask for them now.
  const askedNotes = useRef(false)
  useEffect(() => {
    if (!data || !sp0 || data.notes.length || !curatorReady || askedNotes.current) return
    askedNotes.current = true
    journey.companion(programmeId).then((n) => { if (n) bump() }).catch(() => {})
  }, [data, sp0, curatorReady, journey, programmeId, bump])

  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [explaining, setExplaining] = useState(false)

  const [heardOpen, setHeardOpen] = useState(false)
  const [marking, setMarking] = useState(false)
  // A ref as well as the state: two taps in one frame both see the state as it was before either.
  const markingNow = useRef(false)

  if (error) return <Problem error={error} onRetry={retry} notFound={{ text: 'There’s no such work to listen to — perhaps an old link.', link: { href: href({ name: 'week' }), label: 'This week' } }} />
  if (!data) return <Waiting>Opening the listening view…</Waiting>
  const { programme, item, recording, next, credit, standIn, notes } = data
  const sp = isConfirmed(recording) ? recording.spotify : undefined
  // What is marked, and reacted to, is the recording that plays — a stand-in's own, where it stands in.
  const played = { recordingId: recording?.id ?? item.recordingId, workId: item.workId }
  // This recording's own movements, as its album divides them.
  const movements = sp?.trackNames ?? []

  async function ask() {
    const q = question.trim()
    if (!q) return
    setAsking(true)
    try {
      const movement = nowIndex !== null ? movements[nowIndex] : undefined
      await journey.explain(programme.id, item.id, q, { recording: creditLine(credit), movement })
      setQuestion('')
      bump()
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setAsking(false)
    }
  }

  async function explain() {
    setExplaining(true)
    try { await journey.explain(programme.id, item.id); bump() } catch (e) { say(messageOf(e), 'danger') } finally { setExplaining(false) }
  }

  // Once per tap: a second tap while the first is being kept would record the work heard twice.
  async function heard() {
    if (markingNow.current) return
    markingNow.current = true
    setMarking(true)
    try {
      await journey.markListening(played, 'heard', programme.id)
      bump()
      setHeardOpen(true)
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      markingNow.current = false
      setMarking(false)
    }
  }

  const started = () => { void journey.markListening(played, 'play-started', programme.id, 'app').then(bump) }
  const nowIndex = playback.at?.index ?? null

  // A movement can be started from the list: the place in the music, by its name.
  async function playFrom(i: number) {
    if (await playback.play(i)) started()
  }

  return (
    <article className={s.listenMode}>
      <p className={s.eyebrow}><a href={href({ name: 'programme', id: programme.id })} className={`${s.quietLink} ${s.backLink}`}>← {programme.title}</a></p>
      <p className={s.composer}>{item.proposed.composer}</p>
      <h1 className={s.title}>{item.proposed.work}</h1>
      <Credits r={credit} className={s.dek} after={sp?.durationMs ? aboutDuration(sp.durationMs) : undefined} />
      {standIn && <p className={s.note}>On Spotify in place of the curator’s choice ({creditLine(item.proposed)}), which Spotify doesn’t carry.</p>}

      {/* The same listen bar as the programme; placed first, since pressing it is what this screen is for. */}
      {sp && <ListenBar firstTrackId={sp.trackIds[0]} movements={movements.length} playback={playback} onStarted={started} className={s.mtMd} />}

      {movements.length > 1 && (
        <ol className={s.movements}>
          {movements.map((m, i) => (
            <li key={`${i}-${m}`} className={nowIndex === i ? s.movementNow : undefined} aria-current={nowIndex === i ? 'true' : undefined}>
              {spotify.connected
                ? <button type="button" className={s.movementButton} onClick={() => void playFrom(i)} disabled={playback.busy} title="Play from this movement">{m}</button>
                : m}
              {nowIndex === i && <span className={s.nowWord}> — {playback.at?.playing ? 'now' : 'paused'}</span>}
              {/* The companion's note, as Spotify reaches the movement — or every note, when Spotify can't say where it is. */}
              {notes[i] && (nowIndex === i || !spotify.connected) && <p className={s.movementNote}>{notes[i]}</p>}
            </li>
          ))}
        </ol>
      )}

      {movements.length <= 1 && notes[0] && (nowIndex === 0 || !spotify.connected) && <p className={s.movementNote}>{notes[0]}</p>}

      {item.listenFor.length > 0 && (
        <>
          <p className={`${s.label} ${s.mtXl}`}>Listen for</p>
          <ul className={`${s.listenFor} ${s.listenForLarge}`}>{item.listenFor.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </>
      )}

      {/* Ask about this: a question answered with the work, the recording and the movement sounding as context. */}
      <section className={s.companion} aria-label="Ask about this">
        <p className={s.label}>Ask about this</p>
        {data.answers.map((a) => (
          <div key={a.id} className={s.answer}>
            <p className={s.answerQ}>{a.question}{a.movement ? <span className={s.faint}> · during {a.movement}</span> : null}</p>
            <Paragraphs text={a.body} className={s.prose} />
          </div>
        ))}
        {curatorReady ? (
          <form className={s.askRow} onSubmit={(e) => { e.preventDefault(); void ask() }}>
            <label className={s.visuallyHidden} htmlFor="ask">Your question</label>
            <input id="ask" className={s.input} maxLength={MAX_ASK} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Why does the horn come back here?" disabled={asking} />
            <button className={`${s.outlineButton} ${s.smallButton}`} type="submit" disabled={asking || !question.trim()}>{asking ? 'Asking…' : 'Ask'}</button>
          </form>
        ) : <p className={s.note}>Add your Anthropic key in Settings to ask the curator.</p>}
        {data.explanation ? (
          <div className={s.answer}>
            <p className={s.answerQ}>{data.explanation.heading}</p>
            <Paragraphs text={data.explanation.body} className={s.prose} />
          </div>
        ) : curatorReady && (
          <button className={s.textButton} onClick={() => void explain()} disabled={explaining}>{explaining ? 'The curator is writing…' : 'A little more context'}</button>
        )}
      </section>

      {/* Heard: say how it landed here, then go straight on — no trip back up the programme. */}
      {heardOpen ? (
        <div className={`${s.panel} ${s.mtXl}`}>
          <FeedbackPanel
            targets={[{ type: 'recording', id: played.recordingId, label: 'This recording' }, { type: 'work', id: item.workId, label: 'The work itself' }]}
            programmeId={programme.id}
            feedback={data.feedback}
            startOpen
          />
          <div className={`${s.actions} ${s.mtMd}`}>
            {next
              ? <a className={s.primaryButton} href={href({ name: 'listen', programmeId, itemId: next.id })}>Next: {next.proposed.work} →</a>
              : <span className={s.quiet}>That was the last work this week.</span>}
            <a className={s.textButton} href={href({ name: 'programme', id: programme.id })}>Back to the programme</a>
          </div>
        </div>
      ) : (
        <div className={`${s.actions} ${s.mtXl}`}>
          <button className={s.outlineButton} onClick={() => void heard()} disabled={marking}>I’ve heard it</button>
        </div>
      )}
      <p className={`${s.settingHint} ${s.mtLg}`}>
        The screen stays awake while this page is open.
        {settings.dusk === 'rotate' && (
          liked
            ? <> · Noted — this shade counts once more in Settings.</>
            : <> · <button className={`${s.textButton} ${s.quietButton}`} onClick={() => { likeDusk(shade); setLiked(true) }}>I like this shade</button></>
        )}
      </p>
    </article>
  )
}

/** The next work in programme order that can be played (its recording, or a stand-in, confirmed on Spotify) and wasn't skipped. */
function nextWork(items: ProgrammeItem[], current: ProgrammeItem, canPlay: (i: ProgrammeItem) => boolean, idsOf: (i: ProgrammeItem) => string[], events: Parameters<typeof listeningState>[0]): ProgrammeItem | undefined {
  const after = items.slice(items.findIndex((i) => i.id === current.id) + 1)
  return after.find((i) => canPlay(i) && listeningState(events, idsOf(i)) !== 'skipped')
}
