import { ExternalLink, Pause, Play } from 'lucide-react'
import { useServices } from '../app/services'
import { playbackLine, type Playback } from '../app/playback'
import { openUrl } from '../spotify/client'
import s from '../styles/editorial.module.css'

const icon = { size: 15, fill: 'currentColor', strokeWidth: 0, 'aria-hidden': true } as const

/**
 * Where listening starts, wherever a confirmed recording is shown. Play starts
 * exactly this work (every movement, in order) on whichever device Spotify is
 * active on; once it's on, the same button pauses and resumes it where it is,
 * and a line beneath says where it's playing. Opening Spotify is the quieter
 * alternative — the main action without a Spotify connection.
 */
export function ListenBar({ firstTrackId, movements, playback, onStarted, onOpened, style }: {
  firstTrackId: string
  movements: number
  playback: Playback
  onStarted?: () => void
  onOpened?: () => void
  style?: React.CSSProperties
}) {
  const { spotify } = useServices()
  const p = playback
  const line = playbackLine(p, movements)

  async function play() {
    if (await p.play()) onStarted?.()
  }

  return (
    <>
      <div className={s.listenBar} style={style}>
        {spotify.connected ? (
          <>
            {p.at?.playing ? (
              <button className={s.playButton} onClick={() => void p.pause()} disabled={p.busy}><Pause {...icon} />Pause</button>
            ) : p.at ? (
              <button className={s.playButton} onClick={() => void p.resume()} disabled={p.busy} title="Carry on from where it stopped"><Play {...icon} />Resume</button>
            ) : (
              <button className={s.playButton} onClick={() => void play()} disabled={p.busy} title="Every movement of this work, in order, on the device where Spotify is open"><Play {...icon} />Play</button>
            )}
            <a className={s.listenAlt} title="Opens the first track in Spotify; it carries on through the album" href={openUrl('track', firstTrackId)} target="_blank" rel="noopener noreferrer" onClick={onOpened}>
              or open in Spotify<ExternalLink size={14} strokeWidth={1.6} aria-hidden="true" />
            </a>
          </>
        ) : (
          <a className={s.playButton} href={openUrl('track', firstTrackId)} target="_blank" rel="noopener noreferrer" onClick={onOpened}>
            <Play {...icon} />Listen on Spotify
          </a>
        )}
      </div>
      <p className={s.playbackLine} role="status" aria-live="polite">
        {line && <><span className={p.at?.playing ? s.playingDot : s.pausedDot} aria-hidden="true" />{line}</>}
      </p>
      {p.cantFollow && <p className={s.note}>Reconnect Spotify in Settings so the app can follow what’s playing.</p>}
      {p.noDevice && (
        <p className={s.note} role="status">
          Spotify isn’t open on any device yet. Open it on your phone, speaker or computer, then press Play again.
        </p>
      )}
    </>
  )
}
