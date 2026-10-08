import { useEffect, useState } from 'react'
import { creditLine } from '../domain/identity'
import { useLoad, useServices } from '../app/services'
import { go, href } from '../app/router'
import { useWakeLock } from '../../shared/useWakeLock'
import { openUrl } from '../spotify/client'
import { aboutDuration } from '../spotify/verify'
import { Problem, Waiting, messageOf } from '../components/common'
import s from '../styles/editorial.module.css'

/**
 * One recording, while it plays: the work, who plays it, and what to listen
 * for, in large type with the screen kept awake. With Spotify connected and
 * playing this recording, the movement that's sounding is marked — a place in
 * the music, not a progress bar.
 */
export function ListenModeScreen({ programmeId, itemId }: { programmeId: string; itemId: string }) {
  const { repo, spotify, journey, bump, say } = useServices()
  const { data, error } = useLoad(async () => {
    const programme = await repo.programmes.require(programmeId)
    const item = programme.sections.flatMap((x) => x.items).find((i) => i.id === itemId)
    if (!item) throw new Error('missing item')
    const [recording, work] = await Promise.all([repo.recordings.get(item.recordingId), repo.works.get(item.workId)])
    return { programme, item, recording, work }
  }, [programmeId, itemId])
  useWakeLock(true)

  // Which of this recording's tracks is sounding now, if any. Polled gently, only while visible.
  const [nowIndex, setNowIndex] = useState<number | null>(null)
  const trackIds = data?.recording?.spotify?.trackIds
  useEffect(() => {
    if (!spotify.connected || !trackIds?.length) return
    let live = true
    const look = () => {
      if (document.visibilityState !== 'visible') return
      spotify.nowPlaying().then((np) => {
        if (!live) return
        const i = np?.isPlaying ? trackIds.indexOf(np.trackId) : -1
        setNowIndex(i >= 0 ? i : null)
      }).catch(() => {})
    }
    look()
    const timer = setInterval(look, 10_000)
    return () => { live = false; clearInterval(timer) }
  }, [spotify, trackIds])

  if (error) return <Problem error={error} />
  if (!data) return <Waiting>Opening…</Waiting>
  const { programme, item, recording, work } = data
  const sp = recording?.spotify
  const movements = work?.movements ?? []

  async function heard() {
    await journey.markListening(item, 'heard', programme.id)
    bump()
    go({ name: 'programme', id: programme.id })
  }

  async function play() {
    if (!sp) return
    try {
      await spotify.play(sp.trackUris)
      await journey.markListening(item, 'play-started', programme.id, 'app')
    } catch (e) {
      say(messageOf(e), 'danger')
    }
  }

  return (
    <article className={s.listenMode}>
      <p className={s.eyebrow}><a href={href({ name: 'programme', id: programme.id })} className={s.quietLink}>← {programme.title}</a></p>
      <p className={s.composer}>{item.proposed.composer}</p>
      <h1 className={s.title}>{item.proposed.work}</h1>
      <p className={s.dek}>{creditLine(item.proposed)}{sp?.durationMs ? ` · ${aboutDuration(sp.durationMs)}` : ''}</p>

      {movements.length > 1 && (
        <ol className={s.movements}>
          {movements.map((m, i) => (
            <li key={m.index} className={nowIndex === i ? s.movementNow : undefined} aria-current={nowIndex === i ? 'true' : undefined}>
              {m.title}{nowIndex === i && <span className={s.nowWord}> — now</span>}
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
        {sp && <a href={openUrl('track', sp.trackIds[0])} target="_blank" rel="noopener noreferrer">Open in Spotify</a>}
        {sp && spotify.connected && <button className={s.textButton} onClick={play}>Play on your device</button>}
        <button className={s.textButton} onClick={heard}>I’ve heard it</button>
      </div>
      <p className={s.note}>The screen stays awake while this page is open.</p>
    </article>
  )
}
