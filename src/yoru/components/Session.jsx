import { useEffect, useMemo, useRef, useState } from 'react'
import BreathOrb from './BreathOrb'
import Note from './Note'
import NightSky from './NightSky'
import { useDescent } from '../lib/useDescent'
import { useWakeLock } from '../lib/useWakeLock'
import { useCoords } from '../lib/useCoords'
import { createNightSoundscape } from '../lib/soundscape'
import { phaseLabel } from '../lib/breath'
import styles from './Session.module.css'

// The running descent: the breathing orb, the night soundscape ebbing beneath
// it, and the note. Everything dims toward the end; nothing announces the finish
// with a jolt — the sound simply reaches silence and we ease to the close.
export default function Session({ session, onNote, onFinish }) {
  const sound = useRef(null)

  // Three screen modes. 'lit' shows the orb; 'dark' blacks out to a night sky
  // but stays awake (audio keeps playing); 'off' releases the wake lock so the
  // device screen truly sleeps to save power — and flips back to 'lit' the
  // moment you re-engage with the app.
  const [screenMode, setScreenMode] = useState(session.screen || 'lit')
  const dark = screenMode === 'dark'
  const off = screenMode === 'off'

  // The orb (and breathwork) only make sense when the screen is lit.
  const breathwork = session.breathwork !== false && screenMode === 'lit'

  const coords = useCoords(dark)
  const [veiled, setVeiled] = useState(dark)
  const peekTimer = useRef(0)

  const peek = () => {
    setVeiled(false)
    clearTimeout(peekTimer.current)
    peekTimer.current = setTimeout(() => setVeiled(true), 6000)
  }
  useEffect(() => () => clearTimeout(peekTimer.current), [])

  // In 'off' mode, come back to 'lit' as soon as the app is visible again.
  useEffect(() => {
    if (screenMode !== 'off') return undefined
    const onVis = () => {
      if (document.visibilityState === 'visible') setScreenMode('lit')
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [screenMode])

  // Keep the screen awake except in 'off' (there we let the device sleep).
  useWakeLock(!off)

  const { progress, scale, phase, remainingSec } = useDescent({
    startedAt: session.startedAt,
    totalSec: session.totalSec,
    breath: session.breath,
    running: true,
    onDone: onFinish,
  })

  // Build the soundscape once, resuming its envelope at the current elapsed so a
  // mid-night resume doesn't restart the ebb from the top. Skipped entirely when
  // sound is off (a breath-only night).
  useEffect(() => {
    const s = createNightSoundscape()
    sound.current = s
    const elapsedSec = Math.max(0, (Date.now() - session.startedAt) / 1000)
    s.start({ totalSec: session.totalSec, elapsedSec, mix: session.mix })
    return () => s.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Couple the bed's tidal swell to the breath (only when breathwork is on).
  useEffect(() => {
    if (breathwork) sound.current?.setBreath(scale)
  }, [scale, breathwork])

  const label = useMemo(() => phaseLabel(phase), [phase])

  return (
    <main className={styles.session} style={{ '--dim': dimFor(progress) }}>
      <div className={styles.top} aria-hidden="true" />

      <button type="button" className={styles.center} onClick={onFinish} aria-label="Tap to end the night">
        {breathwork ? (
          <BreathOrb scale={scale} label={label} />
        ) : (
          <span className={styles.ambient} aria-hidden="true">夜</span>
        )}
      </button>

      <div className={styles.bottom}>
        <Note value={session.note} onChange={onNote} />
      </div>

      <span className={styles.countdown} aria-hidden="true">{formatTime(remainingSec)}</span>

      <div className={styles.progress} aria-hidden="true">
        <div className={styles.progressFill} style={{ transform: `scaleX(${progress.toFixed(4)})` }} />
      </div>

      {dark && veiled && (
        <button type="button" className={styles.veil} onClick={peek} aria-label="Tap to peek">
          <NightSky coords={coords} />
        </button>
      )}

      {off && <div className={styles.blackout} aria-hidden="true" />}
    </main>
  )
}

// mm:ss for the discrete countdown.
function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

// The whole screen fades toward black over the final stretch, matching the
// sound's ebb — the room goes quiet and dark together.
function dimFor(progress) {
  if (progress < 0.7) return 1
  const t = (progress - 0.7) / 0.3
  return (1 - 0.72 * Math.min(1, t)).toFixed(3)
}
