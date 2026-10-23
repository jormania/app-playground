import { ExternalLink, Pause, Play } from 'lucide-react'
import { useServices } from '../app/services'
import { armWork, assumeStart, playbackLine, type Playback } from '../app/playback'
import { openUrl } from '../spotify/client'
import { clock } from '../domain/programmeStyle'
import s from '../styles/editorial.module.css'

const icon = { size: 15, fill: 'currentColor', strokeWidth: 0, 'aria-hidden': true } as const

/**
 * Opening a confirmed recording in Spotify itself, wherever it is offered (the
 * player's quieter alternative, a recording in the Library): the first track,
 * and the same watching either way — a single-track work is assumed started
 * from this moment, and the work is armed so it is stopped at its last
 * movement rather than running on into the rest of the album.
 */
export function OpenInSpotify({ trackIds, durationMs, durationsMs, onOpened, className, children }: {
  trackIds: string[]
  durationMs?: number
  durationsMs?: number[]
  onOpened?: () => void
  className?: string
  children?: React.ReactNode
}) {
  function opened() {
    if (trackIds.length === 1) assumeStart(trackIds, durationMs)
    armWork(trackIds, durationsMs)
    onOpened?.()
  }
  return (
    <a className={className ?? s.listenAlt} title="Opens the first track in Spotify; the app stops it at the work’s last movement while it can follow Spotify" href={openUrl('track', trackIds[0])} target="_blank" rel="noopener noreferrer" onClick={opened}>
      {children ?? <>open in Spotify<ExternalLink size={14} strokeWidth={1.6} aria-hidden="true" /></>}
    </a>
  )
}

/**
 * Where listening starts, wherever a confirmed recording is shown. Play starts
 * exactly this work (every movement, in order) on whichever device Spotify is
 * active on; once it's on, the same button pauses and resumes it where it is,
 * and a line beneath says where it's playing. Opening Spotify is the quieter
 * alternative — the main action without a Spotify connection.
 */
export function ListenBar({ trackIds, durationsMs, durationMs, playback, onStarted, onOpened, className, steps }: {
  /** The work's tracks, one per movement. */
  trackIds: string[]
  durationsMs?: number[]
  /** The whole work's length: for a single-track work, a tap here is an assumed start (app/playback.ts). */
  durationMs?: number
  playback: Playback
  onStarted?: () => void
  onOpened?: () => void
  className?: string
  /** Previous and next movement either side of Pause (the listening view only): given the control, returns the row. */
  steps?: (control: React.ReactNode) => React.ReactNode
}) {
  const { spotify } = useServices()
  const p = playback
  const movements = trackIds.length
  const line = playbackLine(p, movements)

  // A single-track work started from here is watched from this moment, wherever it then plays.
  const assume = () => { if (movements === 1) assumeStart(trackIds, durationMs) }

  async function play() {
    if (await p.play()) { assume(); onStarted?.() }
  }

  async function resumeLeft() {
    if (p.left && await p.play(p.left.index, p.left.progressMs)) onStarted?.()
  }

  return (
    <>
      <div className={className ? `${s.listenBar} ${className}` : s.listenBar}>
        {spotify.connected ? (
          <>
            {(() => {
              const control = p.at?.playing ? (
                <button className={s.playButton} onClick={() => void p.pause()} disabled={p.busy}><Pause {...icon} />Pause</button>
              ) : p.at ? (
                <button className={s.playButton} onClick={() => void p.resume()} disabled={p.busy} title="Carry on from where it stopped"><Play {...icon} />Resume</button>
              ) : p.left ? (
                // Spotify has let it go (closed, or hours of something else): resumed from where this device saw it last.
                <button className={s.playButton} onClick={() => void resumeLeft()} disabled={p.busy} title="Carry on from where you left it"><Play {...icon} />Resume</button>
              ) : (
                <button className={s.playButton} onClick={() => void play()} disabled={p.busy} title="Every movement of this work, in order, on the device where Spotify is open"><Play {...icon} />Play</button>
              )
              return steps ? steps(control) : control
            })()}
            <OpenInSpotify trackIds={trackIds} durationMs={durationMs} durationsMs={durationsMs} onOpened={onOpened}>
              or open in Spotify<ExternalLink size={14} strokeWidth={1.6} aria-hidden="true" />
            </OpenInSpotify>
          </>
        ) : (
          <OpenInSpotify className={s.playButton} trackIds={trackIds} durationMs={durationMs} durationsMs={durationsMs} onOpened={onOpened}>
            <Play {...icon} />Listen on Spotify
          </OpenInSpotify>
        )}
      </div>
      <p className={s.playbackLine} role="status" aria-live="polite">
        {line && <><span className={p.at?.playing ? s.playingDot : s.pausedDot} aria-hidden="true" />{line}</>}
        {!line && p.left && spotify.connected && (
          <>
            <span className={s.pausedDot} aria-hidden="true" />
            Left at {movements > 1 ? `movement ${p.left.index + 1} of ${movements}, ` : ''}{clock(p.left.progressMs)} ·{' '}
            <button type="button" className={`${s.textButton} ${s.inlineButton}`} onClick={() => void play()} disabled={p.busy}>start from the beginning</button>
          </>
        )}
      </p>
      {p.cantFollow && <p className={s.note}>Reconnect Spotify in Settings so the app can follow what’s playing.</p>}
      {p.noDevice && <DeviceChoice playback={p} />}
    </>
  )
}

/**
 * Nothing is playing anywhere: the devices Spotify can see (a TV or speaker
 * with Spotify open but idle), each one tap from playing there — rather than a
 * walk to the TV to start something first. None seen: how to make one appear.
 */
export function DeviceChoice({ playback: p, compact = false }: { playback: Playback; compact?: boolean }) {
  if (!p.devices.length) {
    return compact
      ? <span className={s.miniNote} role="status">Open Spotify on a device, then try again.</span>
      : <p className={s.note} role="status">Spotify isn’t open on any device yet. Open it on your phone, TV, speaker or computer, then press Play again.</p>
  }
  const choices = p.devices.map((d, i) => (
    <span key={d.id}>
      {i > 0 && ' · '}
      <button type="button" className={`${s.textButton} ${s.inlineButton}`} onClick={() => void p.playOn(d.id)} disabled={p.busy}>{d.name}</button>
    </span>
  ))
  return compact
    ? <span className={s.miniNote} role="status">Play on {choices}</span>
    : <p className={s.note} role="status">Nothing is playing on Spotify just now. Play it on {choices}</p>
}
