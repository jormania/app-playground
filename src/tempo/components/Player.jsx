import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../ds'
import { useTimerEngine } from '../lib/useTimerEngine'
import { useWakeLock } from '../lib/useWakeLock'
import { cueSet, playChime } from '../lib/sound'
import { vibrateTransition, vibrateComplete } from '../lib/haptics'
import { loadPreferences, savePreferences, saveActiveSession, clearActiveSession } from '../lib/storage'
import { SettingsModal } from './SettingsModal'
import { CountdownRing } from './CountdownRing'
import styles from './Player.module.css'

const DEFAULT_PREFERENCES = {
  sound: true,
  wakeLock: true,
  haptics: true,
  prepare: true, // a 3·2·1 count-in before the first step
  volume: 'normal', // cue volume: 'soft' | 'normal' | 'loud'
  intervalChime: false, // a soft bell every few minutes of a running session
  chimeInterval: 5, // minutes between interval chimes: 3 | 5 | 10
}

function initialPreferences() {
  return { ...DEFAULT_PREFERENCES, ...loadPreferences({}) }
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function Player({ mode, segments, resumeFrom = null, onExit }) {
  const [preferences, setPreferences] = useState(initialPreferences)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // The list the engine actually plays: a resumed session replays exactly what
  // was saved; a fresh one optionally gets a "Get ready" count-in prepended.
  // Fixed at mount so toggling count-in mid-session can't reshuffle indices.
  const [playSegments] = useState(() => {
    if (resumeFrom) return resumeFrom.segments
    return initialPreferences().prepare
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
  const prevRef = useRef({ index: currentIndex, status })
  useLayoutEffect(() => {
    const wasStatus = prevRef.current.status
    if (status === 'done' && wasStatus !== 'done') {
      if (preferences.sound) cue.complete()
      if (preferences.haptics) vibrateComplete()
    } else if (status === 'running' && currentIndex !== prevRef.current.index) {
      if (preferences.sound) cue.transition()
      if (preferences.haptics) vibrateTransition()
    }
    prevRef.current = { index: currentIndex, status }
  }, [currentIndex, status, preferences.sound, preferences.haptics, cue])

  // ── Interval chime — a soft bell every few minutes while running (long sits) ──
  useEffect(() => {
    if (!preferences.intervalChime || status !== 'running') return undefined
    const id = setInterval(() => {
      if (preferences.sound) playChime(preferences.volume)
    }, preferences.chimeInterval * 60 * 1000)
    return () => clearInterval(id)
  }, [preferences.intervalChime, preferences.chimeInterval, preferences.sound, preferences.volume, status])

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

  function updatePreferences(patch) {
    setPreferences((prev) => {
      const next = { ...prev, ...patch }
      savePreferences(next)
      return next
    })
  }

  const handleRestart = useCallback(() => {
    reset()
    start()
  }, [reset, start])

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
        onExit()
      } else if (e.key === 'Enter' && status === 'done') {
        handleRestart()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, pause, resume, skip, onExit, handleRestart])

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
        ⚙
      </Button>

      {status === 'done' ? (
        <>
          <h1 className={styles.doneTitle}>Done — nicely paced.</h1>
          <p className={styles.doneNote}>That’s {mode.name.toLowerCase()} complete. Come back whenever it suits you.</p>
          <div className={styles.controls}>
            <Button variant="secondary" onClick={onExit}>
              Home
            </Button>
            <Button onClick={handleRestart}>Again</Button>
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
              <Button variant="secondary" onClick={pause}>
                Pause
              </Button>
            ) : (
              <Button variant="secondary" onClick={resume}>
                Resume
              </Button>
            )}
            <Button variant="secondary" onClick={skip}>
              Skip
            </Button>
            <Button variant="ghost" onClick={onExit}>
              Exit
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
