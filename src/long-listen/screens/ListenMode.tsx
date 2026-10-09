import { useEffect, useRef, useState } from 'react'
import type { ProgrammeItem, Recording } from '../domain/types'
import { creditLine } from '../domain/identity'
import { listeningState } from '../domain/listening'
import { useLoad, useServices } from '../app/services'
import { go, href } from '../app/router'
import { useWakeLock } from '../../shared/useWakeLock'
import { playChime, primeAudio } from '../../shared/sound'
import { triggerHaptic } from '../../shared/haptics'
import { readJson, writeJson } from '../../shared/storage'
import { enterDusk } from '../app/theme'
import { usePlayback, usePlayerState } from '../app/playback'
import { ListenBar } from '../components/ListenBar'
import { FeedbackPanel } from '../components/FeedbackPanel'
import { follow, FOLLOW_START, type Follow } from '../spotify/continuation'
import { aboutDuration, isConfirmed } from '../spotify/verify'
import { Problem, Waiting } from '../components/common'
import s from '../styles/editorial.module.css'

/** Set by a view that hands over to the next work, read once by the next view: "start playing on arrival". */
const AUTOPLAY = 'long-listen:autoplay'
/** How long "Next: …" shows after the chime before the next work starts. */
const HANDOVER_MS = 6000

/**
 * One recording, while it plays: the work, who plays it, and what to listen
 * for, in large type with the screen kept awake. With Spotify connected and
 * playing this recording, the movement that's sounding is marked — a place in
 * the music, not a progress bar.
 *
 * Keep listening: with "carry on" on, when the last movement ends the phone
 * chimes softly (and buzzes), says what comes next, and starts it — one work
 * at a time, so the chime falls in the gap and never over the music. "I've
 * heard it" asks how it landed in place, then offers the next work.
 */
export function ListenModeScreen({ programmeId, itemId }: { programmeId: string; itemId: string }) {
  const { repo, spotify, journey, bump, settings, updateSettings } = useServices()
  const { data, error } = useLoad(async () => {
    const programme = await repo.programmes.require(programmeId)
    const items = programme.sections.flatMap((x) => x.items)
    const item = items.find((i) => i.id === itemId)
    if (!item) throw new Error('missing item')
    const [recordings, events, feedback] = await Promise.all([repo.recordings.many(items.map((i) => i.recordingId)), repo.events.all(), repo.feedback.all()])
    const byId = new Map(recordings.map((r) => [r.id, r]))
    return { programme, item, recording: byId.get(item.recordingId), next: nextWork(items, item, byId, events), feedback }
  }, [programmeId, itemId])
  useWakeLock(true)

  // Dusk while this screen is open: it stays lit, so neither day-bright nor night-dark.
  useEffect(() => enterDusk(), [])
  const sp0 = isConfirmed(data?.recording) ? data.recording.spotify : undefined
  // Which movement is sounding, playing or paused — shared with the programme's buttons.
  const playback = usePlayback(sp0?.trackUris, sp0?.trackIds)
  const player = usePlayerState()

  const [heardOpen, setHeardOpen] = useState(false)
  const [upcoming, setUpcoming] = useState<{ item: ProgrammeItem; at: number } | null>(null)

  // Handed over from the previous work: start this one as soon as it's known.
  const autostarted = useRef(false)
  useEffect(() => {
    if (!sp0 || autostarted.current) return
    if (readJson<string>(AUTOPLAY, '') !== itemId) return
    autostarted.current = true
    writeJson(AUTOPLAY, '')
    void playback.play().then((ok) => { if (ok && data) void journey.markListening(data.item, 'play-started', programmeId, 'app') })
  }, [sp0, itemId, playback, data, journey, programmeId])

  // Watch for this work's end; with carry-on, chime in the gap and say what's next.
  const followed = useRef<Follow>(FOLLOW_START)
  useEffect(() => {
    if (!sp0) return
    const { next, ended } = follow(followed.current, player.np, sp0.trackIds)
    followed.current = next
    if (!ended || !settings.carryOn || !data?.next || upcoming) return
    playChime('soft', 'sitwalk')
    triggerHaptic('success')
    setUpcoming({ item: data.next, at: Date.now() })
  }, [player.np, sp0, settings.carryOn, data, upcoming])

  useEffect(() => {
    if (!upcoming) return
    const t = setTimeout(() => {
      writeJson(AUTOPLAY, upcoming.item.id)
      go({ name: 'listen', programmeId, itemId: upcoming.item.id })
    }, HANDOVER_MS)
    return () => clearTimeout(t)
  }, [upcoming, programmeId])

  if (error) return <Problem error={error} />
  if (!data) return <Waiting>Opening…</Waiting>
  const { programme, item, recording, next } = data
  const sp = isConfirmed(recording) ? recording.spotify : undefined
  // This recording's own movements, as its album divides them.
  const movements = sp?.trackNames ?? []

  async function heard() {
    await journey.markListening(item, 'heard', programme.id)
    bump()
    setHeardOpen(true)
  }

  const started = () => { void journey.markListening(item, 'play-started', programme.id, 'app').then(bump) }
  const nowIndex = playback.at?.index ?? null

  // A movement can be started from the list: the place in the music, by its name.
  async function playFrom(i: number) {
    primeAudio()
    if (await playback.play(i)) started()
  }

  return (
    // Any tap here wakes the audio context, so the chime at a work's end — which has no tap of its own — may sound.
    <article className={s.listenMode} onPointerDown={primeAudio}>
      <p className={s.eyebrow}><a href={href({ name: 'programme', id: programme.id })} className={`${s.quietLink} ${s.backLink}`}>← {programme.title}</a></p>
      <p className={s.composer}>{item.proposed.composer}</p>
      <h1 className={s.title}>{item.proposed.work}</h1>
      <p className={s.dek}>{creditLine(item.proposed)}{sp?.durationMs ? ` · ${aboutDuration(sp.durationMs)}` : ''}</p>

      {upcoming && (
        <div className={s.handover} role="status">
          <p className={s.label}>Next</p>
          <p className={s.handoverWork}>{upcoming.item.proposed.composer} — {upcoming.item.proposed.work}</p>
          <div className={s.actions}>
            <button className={s.primaryButton} onClick={() => { writeJson(AUTOPLAY, upcoming.item.id); go({ name: 'listen', programmeId, itemId: upcoming.item.id }) }}>Start it now</button>
            <button className={s.textButton} onClick={() => setUpcoming(null)}>Stay here</button>
          </div>
        </div>
      )}

      {/* The same listen bar as the programme; placed first, since pressing it is what this screen is for. */}
      {sp && <ListenBar firstTrackId={sp.trackIds[0]} movements={movements.length} playback={playback} onStarted={() => { primeAudio(); started() }} style={{ marginTop: 'var(--space-md)' }} />}
      {sp && spotify.connected && next && (
        <label className={`${s.row} ${s.carryOn}`}>
          <input type="checkbox" checked={settings.carryOn} onChange={(e) => { primeAudio(); updateSettings({ carryOn: e.target.checked }) }} />
          Then carry on to {next.proposed.composer.split(' ').slice(-1)[0]}’s {next.proposed.work}, with a soft chime between
        </label>
      )}

      {movements.length > 1 && (
        <ol className={s.movements}>
          {movements.map((m, i) => (
            <li key={`${i}-${m}`} className={nowIndex === i ? s.movementNow : undefined} aria-current={nowIndex === i ? 'true' : undefined}>
              {spotify.connected
                ? <button type="button" className={s.movementButton} onClick={() => void playFrom(i)} disabled={playback.busy} title="Play from this movement">{m}</button>
                : m}
              {nowIndex === i && <span className={s.nowWord}> — {playback.at?.playing ? 'now' : 'paused'}</span>}
            </li>
          ))}
        </ol>
      )}

      {item.listenFor.length > 0 && (
        <>
          <p className={s.label} style={{ marginTop: 'var(--space-xl)' }}>Listen for</p>
          <ul className={`${s.listenFor} ${s.listenForLarge}`}>{item.listenFor.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </>
      )}

      {/* Heard: say how it landed here, then go straight on — no trip back up the programme. */}
      {heardOpen ? (
        <div className={s.panel} style={{ marginTop: 'var(--space-xl)' }}>
          <FeedbackPanel
            targets={[{ type: 'recording', id: item.recordingId, label: 'This recording' }, { type: 'work', id: item.workId, label: 'The work itself' }]}
            programmeId={programme.id}
            feedback={data.feedback}
            startOpen
          />
          <div className={s.actions} style={{ marginTop: 'var(--space-md)' }}>
            {next
              ? <a className={s.primaryButton} href={href({ name: 'listen', programmeId, itemId: next.id })}>Next: {next.proposed.work} →</a>
              : <span className={s.quiet}>That was the last work this week.</span>}
            <a className={s.textButton} href={href({ name: 'programme', id: programme.id })}>Back to the programme</a>
          </div>
        </div>
      ) : (
        <div className={s.actions} style={{ marginTop: 'var(--space-xl)' }}>
          <button className={s.outlineButton} onClick={heard}>I’ve heard it</button>
        </div>
      )}
      <p className={s.note}>The screen stays awake while this page is open.</p>
    </article>
  )
}

/** The next work in programme order that can be played: confirmed on Spotify, and not skipped. */
function nextWork(items: ProgrammeItem[], current: ProgrammeItem, recordings: Map<string, Recording>, events: Parameters<typeof listeningState>[0]): ProgrammeItem | undefined {
  const after = items.slice(items.findIndex((i) => i.id === current.id) + 1)
  return after.find((i) => isConfirmed(recordings.get(i.recordingId)) && listeningState(events, i.recordingId) !== 'skipped')
}
