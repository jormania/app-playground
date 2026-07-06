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

  const breathwork = session.breathwork !== false

  // "Go dark" — the screen blacks out but the device stays awake, so the
  // synthesised sound keeps playing (it would be suspended if the display
  // actually slept). Tap to peek for a few seconds. The dark backdrop shows the
  // real moon, so ask for a location only in this mode.
  const dark = session.screen === 'dark'
  const coords = useCoords(dark)
  const [veiled, setVeiled] = useState(dark)
  const peekTimer = useRef(0)

  const peek = () => {
    setVeiled(false)
    clearTimeout(peekTimer.current)
    peekTimer.current = setTimeout(() => setVeiled(true), 6000)
  }
  useEffect(() => () => clearTimeout(peekTimer.current), [])

  // Always keep the screen awake during a session — in "Go dark" it's black but
  // still on, which is what keeps the audio alive.
  useWakeLock(true)

  const { progress, scale, phase } = useDescent({
    startedAt: session.startedAt,
    totalSec: session.totalSec,
    breath: session.breath,
    running: true,
    onDone: onFinish,
  })

  // Build the soundscape once, resuming its envelope at the current elapsed so a
  // mid-night resume doesn't restart the ebb from the top.
  useEffect(() => {
    const s = createNightSoundscape()
    sound.current = s
    const elapsedSec = Math.max(0, (Date.now() - session.startedAt) / 1000)
    s.start({ totalSec: session.totalSec, elapsedSec, volume: session.volume, scene: session.scene, intensity: session.intensity })
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

      <div className={styles.progress} aria-hidden="true">
        <div className={styles.progressFill} style={{ transform: `scaleX(${progress.toFixed(4)})` }} />
      </div>

      {dark && veiled && (
        <button type="button" className={styles.veil} onClick={peek} aria-label="Tap to peek">
          <NightSky coords={coords} />
        </button>
      )}
    </main>
  )
}

// The whole screen fades toward black over the final stretch, matching the
// sound's ebb — the room goes quiet and dark together.
function dimFor(progress) {
  if (progress < 0.7) return 1
  const t = (progress - 0.7) / 0.3
  return (1 - 0.72 * Math.min(1, t)).toFixed(3)
}
