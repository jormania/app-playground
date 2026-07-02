import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../ds'
import { useTimerEngine } from '../lib/useTimerEngine'
import { useWakeLock } from '../lib/useWakeLock'
import { cueSet, playChime } from '../lib/sound'
import { vibrateTransition, vibrateComplete } from '../lib/haptics'
import { saveActiveSession, clearActiveSession } from '../lib/storage'
import { soundIsOn } from '../lib/preferences'
import { usePreferences } from '../lib/preferencesContext'
import { SettingsModal } from './SettingsModal'
import { CountdownRing } from './CountdownRing'
import { IconSettings } from './icons'
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

  // ── Interval chime — a soft bell every few minutes while running (long sits) ──
  useEffect(() => {
    if (!preferences.intervalChime || status !== 'running') return undefined
    const id = setInterval(() => {
      if (soundOn) playChime(preferences.volume)
    }, preferences.chimeInterval * 60 * 1000)
    return () => clearInterval(id)
  }, [preferences.intervalChime, preferences.chimeInterval, preferences.volume, soundOn, status])

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
            <Button variant="secondary" className={styles.controlButton} onClick={onExit}>
              Home
            </Button>
            <Button className={styles.controlButton} onClick={handleRestart}>
              Again
            </Button>
          </div>
        </>
      ) : (
        <>
          <CountdownRing fractionRemaining={fractionRemaining} kind={currentSegment?.kind}>
            <p className={styles.segmentLabel}>{currentSegment?.label}</p>
            <p className={styles.countdown}>{formatTime(secondsRemaining)}</p>
          </CountdownRing>
          <p className={styles.progress}>
            Step {currentIndex + 1} of {totalSegments}
          </p>
          <div className={styles.controls}>
            {status === 'running' ? (
              <Button variant="secondary" className={styles.controlButton} onClick={pause}>
                Pause
              </Button>
            ) : (
              <Button variant="secondary" className={styles.controlButton} onClick={resume}>
                Resume
              </Button>
            )}
            <Button variant="secondary" className={styles.controlButton} onClick={skip}>
              Skip
            </Button>
            <Button
              variant={exitArmed ? 'primary' : 'secondary'}
              className={styles.controlButton}
              onClick={handleExitRequest}
            >
              {exitArmed ? 'Tap again' : 'Exit'}
            </Button>
          </div>
        </>
      )}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        preferences={preferences}
        onChange={updatePreferences}
      />
    </div>
  )
}
