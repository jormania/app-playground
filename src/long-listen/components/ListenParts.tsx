import { useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import type { NowPlaying } from '../spotify/client'
import { playbackOf } from '../spotify/client'
import type { Playback } from '../app/playback'
import { DeviceChoice } from './ListenBar'
import { clock, primeMinutes, type movementTitles } from '../domain/programmeStyle'
import s from '../styles/editorial.module.css'

type Movement = ReturnType<typeof movementTitles>[number]

/**
 * Where the movement sounding is, to the second: Spotify's last reading,
 * carried forward by the clock while it plays (a reading comes every few
 * seconds at most), so the line moves smoothly instead of in jumps.
 */
export function useLiveProgress(np: NowPlaying | null, trackIds: string[] | undefined): { index: number; progressMs: number; durationMs: number; playing: boolean } | null {
  const [now, setNow] = useState(() => Date.now())
  // A fresh reading: count from it — stamped in the same render it arrives in, so the first frame
  // never adds the time since the reading before (which made the clock jump ahead, then back).
  const [seen, setSeen] = useState(() => ({ np, at: Date.now() }))
  if (seen.np !== np) setSeen({ np, at: Date.now() })
  const readAt = seen.np === np ? seen.at : Date.now()
  const at = trackIds?.length ? playbackOf(np, trackIds) : null
  const playing = Boolean(at?.playing)
  useEffect(() => {
    if (!playing) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [playing])
  if (!at || !np || !np.durationMs) return null
  const progressMs = Math.min(np.durationMs, np.progressMs + (playing ? Math.max(0, now - readAt) : 0))
  return { index: at.index, progressMs, durationMs: np.durationMs, playing }
}

/** A movement's place, as a hairline and a clock: "4:12 of 9:30". */
export function MovementProgress({ progressMs, durationMs, last = false }: { progressMs: number; durationMs: number; last?: boolean }) {
  const pct = durationMs ? Math.min(100, (progressMs / durationMs) * 100) : 0
  return (
    <span className={s.moveProgress}>
      <span className={s.moveTrack} aria-hidden="true"><span className={s.moveFill} style={{ width: `${pct}%` }} /></span>
      <span className={s.moveClock}>{clock(progressMs)} of {clock(durationMs)}{last ? ' · last movement' : ''}</span>
    </span>
  )
}

/**
 * Previous and next, kept inside the work: back from the first movement starts
 * it again; there is no next after the last — the work ends where it ends.
 */
export function MovementSteps({ playback, index, count, onPlayed, children }: { playback: Playback; index: number; count: number; onPlayed?: () => void; children?: React.ReactNode }) {
  // A step is a start like a tap on the movement list: said once it has begun.
  const back = () => void playback.play(Math.max(0, index - 1)).then((ok) => { if (ok) onPlayed?.() })
  const on = () => void playback.play(index + 1).then((ok) => { if (ok) onPlayed?.() })
  return (
    <span className={s.moveSteps}>
      <button type="button" className={s.stepButton} onClick={back} disabled={playback.busy} aria-label={index === 0 ? 'Start this movement again' : 'Previous movement'} title={index === 0 ? 'Start this movement again' : 'Previous movement'}>
        <SkipBack size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {children}
      <button type="button" className={s.stepButton} onClick={on} disabled={playback.busy || index >= count - 1} aria-label="Next movement" title={index >= count - 1 ? 'This is the last movement' : 'Next movement'}>
        <SkipForward size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </span>
  )
}

/**
 * The player, pinned to the foot of the screen once the Play row has scrolled
 * away while this work is on: the movement, where it is, and the three
 * controls — so reading the notes or asking a question never means scrolling
 * back up to pause.
 */
export function MiniPlayer({ playback, movement, index, count, progress, onPlayed }: {
  playback: Playback
  onPlayed?: () => void
  movement?: Movement
  index: number
  count: number
  progress: { progressMs: number; durationMs: number; playing: boolean } | null
}) {
  const playing = Boolean(playback.at?.playing)
  // While pinned, messages rise above it rather than cover its controls (the design system's --toast-offset).
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = document.documentElement
    const lift = () => root.style.setProperty('--toast-offset', `${ref.current?.offsetHeight ?? 0}px`)
    lift()
    window.addEventListener('resize', lift)
    return () => { window.removeEventListener('resize', lift); root.style.removeProperty('--toast-offset') }
  }, [])
  return (
    <div ref={ref} className={s.miniPlayer} role="region" aria-label="Now playing">
      <div className={s.miniInner}>
        <div className={s.miniText}>
          <span className={s.miniTitle}>
            {movement ? <><span className={s.movementNumeral}>{movement.numeral}.</span> <em>{movement.title}</em></> : 'This work'}
          </span>
          {progress && <MovementProgress progressMs={progress.progressMs} durationMs={progress.durationMs} />}
          {/* A command that found no device: said here, where it was tapped, not under a bar scrolled out of sight. */}
          {playback.noDevice && <DeviceChoice playback={playback} compact />}
        </div>
        <MovementSteps playback={playback} index={index} count={count} onPlayed={onPlayed}>
          <button type="button" className={s.miniPlay} onClick={() => void (playing ? playback.pause() : playback.resume())} disabled={playback.busy} aria-label={playing ? 'Pause' : 'Resume'}>
            {playing ? <Pause size={16} fill="currentColor" strokeWidth={0} aria-hidden="true" /> : <Play size={16} fill="currentColor" strokeWidth={0} aria-hidden="true" />}
          </button>
        </MovementSteps>
      </div>
    </div>
  )
}

/** A movement's length in the margin, where Spotify has given it. */
export function movementLength(durations: number[] | undefined, i: number): string | undefined {
  return primeMinutes(durations?.[i])
}

/**
 * Focus only: what comes after the movement sounding, in one faint line — the
 * list that says it is hidden there. On the last movement, how long the work has left.
 */
export function ThenLine({ next, nextLength, leftMs }: { next?: Movement; nextLength?: string; leftMs?: number }) {
  if (next) return <p className={s.thenLine}>then {next.numeral}. {next.title}{nextLength ? ` · ${nextLength}` : ''}</p>
  if (leftMs === undefined) return null
  return <p className={s.thenLine}>the work ends in about {Math.max(1, Math.ceil(leftMs / 60000))}′</p>
}
