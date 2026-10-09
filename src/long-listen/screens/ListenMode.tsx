import { useEffect } from 'react'
import { creditLine } from '../domain/identity'
import { useLoad, useServices } from '../app/services'
import { go, href } from '../app/router'
import { useWakeLock } from '../../shared/useWakeLock'
import { enterDusk } from '../app/theme'
import { usePlayback } from '../app/playback'
import { ListenBar } from '../components/ListenBar'
import { aboutDuration, isConfirmed } from '../spotify/verify'
import { Problem, Waiting } from '../components/common'
import s from '../styles/editorial.module.css'

/**
 * One recording, while it plays: the work, who plays it, and what to listen
 * for, in large type with the screen kept awake. With Spotify connected and
 * playing this recording, the movement that's sounding is marked — a place in
 * the music, not a progress bar.
 */
export function ListenModeScreen({ programmeId, itemId }: { programmeId: string; itemId: string }) {
  const { repo, spotify, journey, bump } = useServices()
  const { data, error } = useLoad(async () => {
    const programme = await repo.programmes.require(programmeId)
    const item = programme.sections.flatMap((x) => x.items).find((i) => i.id === itemId)
    if (!item) throw new Error('missing item')
    const recording = await repo.recordings.get(item.recordingId)
    return { programme, item, recording }
  }, [programmeId, itemId])
  useWakeLock(true)

  // Dusk while this screen is open: it stays lit, so neither day-bright nor night-dark.
  useEffect(() => enterDusk(), [])
  const sp0 = isConfirmed(data?.recording) ? data.recording.spotify : undefined
  // Which movement is sounding, playing or paused — shared with the programme's buttons.
  const playback = usePlayback(sp0?.trackUris, sp0?.trackIds)

  if (error) return <Problem error={error} />
  if (!data) return <Waiting>Opening…</Waiting>
  const { programme, item, recording } = data
  const sp = isConfirmed(recording) ? recording.spotify : undefined
  // This recording's own movements, as its album divides them.
  const movements = sp?.trackNames ?? []

  async function heard() {
    await journey.markListening(item, 'heard', programme.id)
    bump()
    go({ name: 'programme', id: programme.id })
  }

  const started = () => { void journey.markListening(item, 'play-started', programme.id, 'app').then(bump) }
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
      <p className={s.dek}>{creditLine(item.proposed)}{sp?.durationMs ? ` · ${aboutDuration(sp.durationMs)}` : ''}</p>

      {/* The same listen bar as the programme; placed first, since pressing it is what this screen is for. */}
      {sp && <ListenBar firstTrackId={sp.trackIds[0]} movements={movements.length} playback={playback} onStarted={started} style={{ marginTop: 'var(--space-md)' }} />}

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

      <div className={s.actions} style={{ marginTop: 'var(--space-xl)' }}>
        <button className={s.outlineButton} onClick={heard}>I’ve heard it</button>
      </div>
      <p className={s.note}>The screen stays awake while this page is open.</p>
    </article>
  )
}
