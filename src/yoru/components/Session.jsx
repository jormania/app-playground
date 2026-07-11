import { useEffect, useMemo, useRef, useState } from 'react'
import BreathOrb from './BreathOrb'
import Note from './Note'
import NightSky from './NightSky'
import { useDescent } from '../lib/useDescent'
import { useWakeLock } from '../lib/useWakeLock'
import { useCoords } from '../lib/useCoords'
import { createNightSoundscape } from '../lib/soundscape'
import { phaseLabel } from '../lib/breath'
import { moonPhase, moonArc, moonPhaseName } from '../lib/sky'
import styles from './Session.module.css'

// The three display modes, as a quiet in-session control. Short forms of the
// Settings labels (Stay lit / Go dark / Turn off).
const MODES = [
  { value: 'lit', label: 'lit' },
  { value: 'dark', label: 'dark' },
  { value: 'off', label: 'off' },
]
// How long a peek reveals the session (and the mode control) before the overlay
// eases back over a covered mode.
const PEEK_MS = 6000

// The running descent: the breathing orb, the night soundscape ebbing beneath
// it, and the note. Everything dims toward the end; nothing announces the finish
// with a jolt — the sound simply reaches silence and we ease to the close.
export default function Session({ session, onNote, onFinish }) {
  const sound = useRef(null)

  // Three display modes, switchable mid-session (see switchMode): 'lit' shows the
  // orb; 'dark' covers the screen with a night sky but stays awake so audio keeps
  // playing; 'off' releases the wake lock so the device screen can truly sleep to
  // save power — and comes back to 'lit' the moment you re-engage with the app.
  const [screenMode, setScreenMode] = useState(session.screen || 'lit')
  const dark = screenMode === 'dark'
  const off = screenMode === 'off'
  const covered = dark || off

  // The orb (and breathwork) only make sense when the screen is lit.
  const breathwork = session.breathwork !== false && screenMode === 'lit'

  const { coords, status: geoStatus, request: requestLocation } = useCoords(dark)

  // While `veiled`, a covered mode draws its overlay (the sky for 'dark', black
  // for 'off'). A tap peeks — hiding it briefly to reveal the session and the
  // mode control — then it eases back over. 'lit' has no overlay.
  const [veiled, setVeiled] = useState(covered)
  const peekTimer = useRef(0)
  const peek = () => {
    setVeiled(false)
    clearTimeout(peekTimer.current)
    peekTimer.current = setTimeout(() => setVeiled(true), PEEK_MS)
  }
  useEffect(() => () => clearTimeout(peekTimer.current), [])

  // Change display mode without disturbing the rest of the session — the sound,
  // the clock and the breath all keep going. Entering a covered mode draws its
  // overlay at once; 'lit' clears it.
  const switchMode = (mode) => {
    clearTimeout(peekTimer.current)
    setScreenMode(mode)
    setVeiled(mode === 'dark' || mode === 'off')
  }

  // The mode control is offered whenever the session itself is showing: always in
  // 'lit', and during a peek in the covered modes.
  const showModes = screenMode === 'lit' || !veiled

  // A quiet caption for the moon, computed independently of NightSky (which is
  // unmounted while peeking — the sky itself is what a peek hides) so the info
  // is available exactly when there's nowhere else to see it. Refreshed every
  // few minutes; the phase and the moon's rise/set window both move slowly.
  const [moonCaption, setMoonCaption] = useState('')
  useEffect(() => {
    if (!dark || !coords) {
      setMoonCaption('')
      return undefined
    }
    const refresh = () => {
      const now = new Date()
      const name = moonPhaseName(moonPhase(now).phase)
      const arc = moonArc(now, coords)
      let clause = ''
      if (arc) {
        const t = now.getTime()
        if (t >= arc.riseAt && t <= arc.setAt) clause = ` · sets ${formatClock(arc.setAt)}`
        else if (t < arc.riseAt) clause = ` · rises ${formatClock(arc.riseAt)}`
      }
      setMoonCaption(name + clause)
    }
    refresh()
    const id = setInterval(refresh, 5 * 60000)
    return () => clearInterval(id)
  }, [dark, coords])

  // On returning to the app: revive the soundscape if the browser suspended it
  // while backgrounded (iOS Safari does this on tab-hide / screen-lock, in every
  // display mode), and — only from 'off' — come back to 'lit'.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      sound.current?.resume()
      if (screenMode === 'off') {
        clearTimeout(peekTimer.current)
        setScreenMode('lit')
        setVeiled(false)
      }
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

  // Optional breath haptics — a barely-there tick on each phase change, so the
  // breath can be followed with eyes closed.
  const haptics = session.haptics && breathwork
  useEffect(() => {
    if (haptics && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(16)
  }, [phase, haptics])

  // Ending requires a deliberate press-and-hold on the orb (a filling ring shows
  // the progress), so a stray touch can't end the night. A short tap shows a
  // hint instead. On completion the whole screen fades to black, then hands over
  // to the close — no hard cut.
  const HOLD_MS = 1170 // 780ms base, +50%
  const holdTimer = useRef(0)
  const hintTimer = useRef(0)
  const [holding, setHolding] = useState(false)
  const [tapHint, setTapHint] = useState(false)
  const [ending, setEnding] = useState(false)
  const startHold = () => {
    if (ending) return
    setHolding(true)
    holdTimer.current = setTimeout(() => {
      holdTimer.current = 0
      setHolding(false)
      setEnding(true)
      setTimeout(onFinish, 620) // let the fade-to-black land before the close
    }, HOLD_MS)
  }
  const endHold = () => {
    setHolding(false)
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = 0
      setTapHint(true)
      clearTimeout(hintTimer.current)
      hintTimer.current = setTimeout(() => setTapHint(false), 2200)
    }
  }
  useEffect(() => () => {
    clearTimeout(holdTimer.current)
    clearTimeout(hintTimer.current)
  }, [])

  // Keyboard equivalent of the press-and-hold, so ending isn't pointer-only:
  // holding Enter/Space behaves exactly like holding the orb.
  const onKeyDown = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    if (e.repeat) return
    startHold()
  }
  const onKeyUp = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    endHold()
  }

  const label = useMemo(() => phaseLabel(phase), [phase])

  return (
    <main className={styles.session} style={{ '--dim': dimFor(progress) }}>
      <div className={styles.enter} aria-hidden="true" />
      <div className={styles.top}>
        {showModes && (
          <div className={styles.topStack}>
            <div className={styles.modes} role="group" aria-label="Display mode">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  className={m.value === screenMode ? `${styles.mode} ${styles.modeOn}` : styles.mode}
                  aria-pressed={m.value === screenMode}
                  onClick={() => switchMode(m.value)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {dark && !veiled && moonCaption && <p className={styles.moonCaption}>{moonCaption}</p>}
          </div>
        )}
      </div>

      <button
        type="button"
        className={holding ? `${styles.center} ${styles.holding}` : styles.center}
        onPointerDown={startHold}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Press and hold to end the night"
      >
        {breathwork ? (
          <BreathOrb scale={scale} label={label} />
        ) : (
          <span className={styles.ambient} aria-hidden="true">夜</span>
        )}
        <svg className={styles.ring} viewBox="0 0 100 100" aria-hidden="true">
          <circle className={styles.ringFill} cx="50" cy="50" r="47" style={{ animationDuration: `${HOLD_MS}ms` }} />
        </svg>
        <span className={tapHint ? `${styles.holdHint} ${styles.holdHintShow}` : styles.holdHint}>
          hold to end the night
        </span>
      </button>

      <div className={styles.bottom}>
        <Note value={session.note} onChange={onNote} />
      </div>

      <span className={styles.countdown} aria-hidden="true" style={{ opacity: fadeLate(progress, 0.5) }}>
        {formatTime(remainingSec)}
      </span>

      <div className={styles.progress} aria-hidden="true" style={{ opacity: fadeLate(progress, 1) }}>
        <div className={styles.progressFill} style={{ transform: `scaleX(${progress.toFixed(4)})` }} />
      </div>

      {dark && veiled && (
        // A div, not a button: it needs to contain the sky's own "enable
        // location" button, and buttons can't nest.
        <div
          className={styles.veil}
          role="button"
          tabIndex={0}
          onClick={peek}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return
            e.preventDefault()
            peek()
          }}
          aria-label="Tap to peek"
        >
          <NightSky
            coords={coords}
            moonPath={session.moonPath !== false}
            starReveal={session.starReveal !== false}
            geoStatus={geoStatus}
            onRequestLocation={requestLocation}
          />
        </div>
      )}

      {off && veiled && (
        <button type="button" className={styles.blackout} onClick={peek} aria-label="Tap to peek" />
      )}
      {ending && <div className={styles.endFade} aria-hidden="true" />}
    </main>
  )
}

// HH:MM, local 24-hour — deliberately not toLocaleTimeString, which defaults
// to 12-hour + AM/PM in several locales; a rise/set time reads better plain.
function formatClock(ms) {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// mm:ss for the discrete countdown.
function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

// The countdown and progress hairline fade to nothing over the last quarter, so
// nothing is lit near sleep. `max` is the starting opacity.
function fadeLate(progress, max) {
  if (progress < 0.6) return max
  return (max * (1 - Math.min(1, (progress - 0.6) / 0.25))).toFixed(3)
}

// The whole screen fades toward black over the final stretch, matching the
// sound's ebb — the room goes quiet and dark together.
function dimFor(progress) {
  if (progress < 0.7) return 1
  const t = (progress - 0.7) / 0.3
  return (1 - 0.72 * Math.min(1, t)).toFixed(3)
}
