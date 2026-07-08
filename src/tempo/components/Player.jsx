import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../ds'
import { useTimerEngine } from '../lib/useTimerEngine'
import { useWakeLock } from '../lib/useWakeLock'
import { cueSet, playChime, playTick } from '../lib/sound'
import { vibrateTransition, vibrateComplete, vibrateTick } from '../lib/haptics'
import { useMediaSession } from '../lib/mediaSession'
import { saveActiveSession, clearActiveSession } from '../lib/storage'
import { soundIsOn } from '../lib/preferences'
import { usePreferences } from '../lib/preferencesContext'
import { SettingsModal } from './SettingsModal'
import { CountdownRing } from './CountdownRing'
import { IconSettings, IconPause, IconPlay, IconSkipForward, IconExitDoor, IconConfirm } from './icons'
import styles from './Player.module.css'

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const EXIT_CONFIRM_MS = 2000

export function Player({ mode, segments, resumeFrom = null, onExit }) {
  const { preferences, updatePreferences } = usePreferences()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [exitArmed, setExitArmed] = useState(false)
  const exitTimerRef = useRef(null)

  // The list the engine actually plays: a resumed session replays exactly what
  // was saved; a fresh one optionally gets a "Get ready" count-in prepended.
  // Fixed at mount so toggling count-in mid-session can't reshuffle indices.
  const [playSegments] = useState(() => {
    if (resumeFrom) return resumeFrom.segments
    return preferences.prepare
      ? [{ id: 'countin', label: 'Get ready', seconds: 3, kind: 'prepare' }, ...segments]
      : segments
  })

  const { status, currentSegment, currentIndex, totalSegments, secondsRemaining, start, pause, resume, skip, reset } =
    useTimerEngine(playSegments, resumeFrom)

  const cue = useMemo(() => cueSet(mode.cue, preferences.volume), [mode.cue, preferences.volume])
  useWakeLock(preferences.wakeLock && status === 'running')

  // Lock-screen / headset / smartwatch transport controls — Pause, Resume and
  // Skip without touching the phone. Live for the whole session (paused or
  // running), gone once it's done.
  useMediaSession({
    active: status !== 'done',
    title: currentSegment?.label ?? mode.name,
    artist: mode.name,
    status,
    onPlay: resume,
    onPause: pause,
    onNext: skip,
  })

  // Auto-start a fresh session; a resumed one begins paused, awaiting Resume.
  useLayoutEffect(() => {
    if (!resumeFrom) start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Cues (sound + haptics) on transitions and completion ──────────────────
  const soundOn = soundIsOn(preferences)
  const prevRef = useRef({ index: currentIndex, status })
  useLayoutEffect(() => {
    const wasStatus = prevRef.current.status
    if (status === 'done' && wasStatus !== 'done') {
      if (soundOn) cue.complete()
      if (preferences.haptics) vibrateComplete()
    } else if (status === 'running' && currentIndex !== prevRef.current.index) {
      if (soundOn) cue.transition()
      if (preferences.haptics) vibrateTransition()
    }
    prevRef.current = { index: currentIndex, status }
  }, [currentIndex, status, soundOn, preferences.haptics, cue])

  // ── Anticipatory tick — last few seconds of a segment (length set in
  // Settings), ding-family only, so there's a "heads up" before the
  // transition instead of it arriving cold. Paired with the ring's pulse
  // and (on supported phones) a light vibrate — same trigger, reinforced
  // three ways, since sound alone can get lost over wind or traffic.
  const tickWindow = preferences.tickWindow
  const tickEligible = mode.cue === 'ding'
  const endingSoon = tickEligible && status === 'running' && secondsRemaining > 0 && secondsRemaining <= tickWindow
  const prevSecondsRef = useRef(secondsRemaining)
  useLayoutEffect(() => {
    const inTickWindow =
      tickEligible &&
      status === 'running' &&
      secondsRemaining <= tickWindow &&
      secondsRemaining >= 1 &&
      secondsRemaining !== prevSecondsRef.current
    if (inTickWindow) {
      if (soundOn) playTick(preferences.volume)
      if (preferences.haptics) vibrateTick()
    }
    prevSecondsRef.current = secondsRemaining
  }, [secondsRemaining, status, tickEligible, soundOn, preferences.volume, preferences.haptics, tickWindow])

  // ── Interval chime — every few minutes while running, but only on the two
  // long-session modes: Sit–Walk (a distinct doubled bell) and Custom (a short
  // soft alarm). The other four modes never chime, so it can't clutter a short
  // Rounds set or double up with the mindfulness step bells.
  const chimeMode = mode.id === 'sitwalk' || mode.id === 'custom'
  useEffect(() => {
    if (!preferences.intervalChime || status !== 'running' || !chimeMode) return undefined
    const id = setInterval(() => {
      if (soundOn) playChime(preferences.volume, mode.id)
    }, preferences.chimeInterval * 60 * 1000)
    return () => clearInterval(id)
  }, [preferences.intervalChime, preferences.chimeInterval, preferences.volume, soundOn, status, chimeMode, mode.id])

  // ── Persist the in-progress session so it survives the app closing ────────
  const latestRef = useRef({ currentIndex, secondsRemaining, status })
  latestRef.current = { currentIndex, secondsRemaining, status }

  const persist = useCallback(() => {
    const snap = latestRef.current
    if (snap.status === 'done' || snap.status === 'idle') {
      clearActiveSession()
      return
    }
    saveActiveSession({
      modeId: mode.id,
      segments: playSegments,
      currentIndex: snap.currentIndex,
      secondsRemaining: snap.secondsRemaining,
    })
  }, [mode.id, playSegments])

  // Snapshot at each segment boundary and status change (cheap, meaningful points).
  useEffect(() => {
    persist()
  }, [currentIndex, status, persist])

  // And on the way out (tab hidden / app backgrounded) to catch mid-segment time.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') persist()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', persist)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', persist)
    }
  }, [persist])

  const handleRestart = useCallback(() => {
    reset()
    start()
  }, [reset, start])

  // ── Exit needs a deliberate second tap mid-session — a stray touch while
  // moving shouldn't end a practice. First tap arms it (button reads "Tap
  // again"); a second tap within the window actually exits; anything else
  // (pause/resume/skip, or just waiting) disarms it. ─────────────────────────
  const handleExitRequest = useCallback(() => {
    if (exitArmed) {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
      setExitArmed(false)
      onExit()
      return
    }
    setExitArmed(true)
    exitTimerRef.current = setTimeout(() => setExitArmed(false), EXIT_CONFIRM_MS)
  }, [exitArmed, onExit])

  useEffect(() => {
    setExitArmed(false)
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
  }, [status, currentIndex])

  useEffect(
    () => () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    },
    [],
  )

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        if (status === 'running') pause()
        else if (status === 'paused') resume()
      } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 's') {
        if (status === 'running' || status === 'paused') skip()
      } else if (e.key === 'Escape') {
        handleExitRequest()
      } else if (e.key === 'Enter' && status === 'done') {
        handleRestart()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, pause, resume, skip, handleExitRequest, handleRestart])

  const fractionRemaining = currentSegment ? secondsRemaining / currentSegment.seconds : 0

  return (
    <div className={styles.page}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={styles.gear}
        aria-label="Settings"
        onClick={() => setSettingsOpen(true)}
      >
        <IconSettings width={20} height={20} />
      </Button>

      {status === 'done' ? (
        <>
          <h1 className={styles.doneTitle}>Done — nicely paced.</h1>
          <p className={styles.doneNote}>That’s {mode.name.toLowerCase()} complete. Come back whenever it suits you.</p>
          <div className={styles.controls}>
            <Button variant="secondary" className={styles.secondaryControl} onClick={onExit}>
              Home
            </Button>
            <Button className={styles.secondaryControl} onClick={handleRestart}>
              Again
            </Button>
          </div>
        </>
      ) : (
        <>
          <CountdownRing fractionRemaining={fractionRemaining} kind={currentSegment?.kind} pulsing={endingSoon}>
            <p className={styles.segmentLabel}>{currentSegment?.label}</p>
            <p className={styles.countdown}>{formatTime(secondsRemaining)}</p>
          </CountdownRing>
          <p className={styles.progress}>
            Step {currentIndex + 1} of {totalSegments}
          </p>
          <div className={styles.controls}>
            {status === 'running' ? (
              <Button variant="secondary" className={styles.primaryControl} onClick={pause}>
                <IconPause
                  width={30}
                  height={30}
                  fill="currentColor"
                  stroke="none"
                  className={styles.controlIcon}
                />
                <span className={styles.controlLabel}>Pause</span>
              </Button>
            ) : (
              <Button variant="secondary" className={styles.primaryControl} onClick={resume}>
                <IconPlay width={30} height={30} className={styles.controlIcon} />
                <span className={styles.controlLabel}>Resume</span>
              </Button>
            )}
            <Button variant="secondary" className={styles.secondaryControl} onClick={skip}>
              <IconSkipForward width={26} height={26} className={styles.controlIcon} />
              <span className={styles.controlLabel}>Skip</span>
            </Button>
            <Button
              variant={exitArmed ? 'primary' : 'secondary'}
              className={styles.secondaryControl}
              onClick={handleExitRequest}
            >
              {exitArmed ? (
                <IconConfirm width={26} height={26} className={styles.controlIcon} />
              ) : (
                <IconExitDoor width={26} height={26} className={styles.controlIcon} />
              )}
              <span className={styles.controlLabel}>{exitArmed ? 'Tap again' : 'Exit'}</span>
            </Button>
          </div>
        </>
      )}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        preferences={preferences}
        onChange={updatePreferences}
        cueKind={mode.cue}
        chimeMode={chimeMode ? mode.id : null}
      />
    </div>
  )
}
