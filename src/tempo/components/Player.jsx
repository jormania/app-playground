import { useLayoutEffect, useRef, useState } from 'react'
import { Button } from '../../ds'
import { useTimerEngine } from '../lib/useTimerEngine'
import { useWakeLock } from '../lib/useWakeLock'
import { playTransitionCue, playCompletionCue } from '../lib/sound'
import { loadPreferences, savePreferences } from '../lib/storage'
import { SettingsModal } from './SettingsModal'
import { CountdownRing } from './CountdownRing'
import styles from './Player.module.css'

const DEFAULT_PREFERENCES = { sound: true, wakeLock: true }

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function Player({ segments, onExit }) {
  const { status, currentSegment, currentIndex, totalSegments, secondsRemaining, start, pause, resume, skip, reset } =
    useTimerEngine(segments)

  const [preferences, setPreferences] = useState(() => loadPreferences(DEFAULT_PREFERENCES))
  const [settingsOpen, setSettingsOpen] = useState(false)

  useWakeLock(preferences.wakeLock && status === 'running')

  // The user already pressed Start on the setup screen — begin the moment this
  // mounts. useLayoutEffect (not useEffect) so it fires before paint, avoiding
  // a one-frame flash of the idle state.
  useLayoutEffect(() => {
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const prevRef = useRef({ index: currentIndex, status })
  useLayoutEffect(() => {
    if (preferences.sound) {
      if (status === 'done' && prevRef.current.status !== 'done') {
        playCompletionCue()
      } else if (status === 'running' && currentIndex !== prevRef.current.index) {
        playTransitionCue()
      }
    }
    prevRef.current = { index: currentIndex, status }
  }, [currentIndex, status, preferences.sound])

  function updatePreferences(patch) {
    setPreferences((prev) => {
      const next = { ...prev, ...patch }
      savePreferences(next)
      return next
    })
  }

  function handleRestart() {
    reset()
    start()
  }

  const kindClass = currentSegment ? styles[currentSegment.kind] : ''
  const fractionRemaining = currentSegment ? secondsRemaining / currentSegment.seconds : 0

  return (
    <div className={`${styles.page} ${kindClass}`}>
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
          <h1 className={styles.doneTitle}>Session complete</h1>
          <div className={styles.controls}>
            <Button variant="secondary" onClick={onExit}>Home</Button>
            <Button onClick={handleRestart}>Restart</Button>
          </div>
        </>
      ) : (
        <>
          <CountdownRing fractionRemaining={fractionRemaining} kind={currentSegment?.kind}>
            <p className={styles.segmentLabel}>{currentSegment?.label}</p>
            <p className={styles.countdown}>{formatTime(secondsRemaining)}</p>
          </CountdownRing>
          <p className={styles.progress}>
            Segment {currentIndex + 1} of {totalSegments}
          </p>
          <div className={styles.controls}>
            {status === 'running' ? (
              <Button variant="secondary" onClick={pause}>Pause</Button>
            ) : (
              <Button variant="secondary" onClick={resume}>Resume</Button>
            )}
            <Button variant="secondary" onClick={skip}>Skip</Button>
            <Button variant="ghost" onClick={onExit}>Exit</Button>
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
