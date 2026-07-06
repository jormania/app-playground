import { useEffect, useRef, useState } from 'react'
import { cyclePhases, scaleFor } from './breath'

// One requestAnimationFrame loop that drives the whole descent: the session
// progress + remaining time, and the breathing orb's live scale/phase. Keeping
// it in a single loop means the breath and the clock never disagree.
//
//   startedAt  epoch ms the session began (survives reload → resume mid-night)
//   totalSec   session length
//   breath     'exhale' | '478'
//   running    drive the loop only while true
//   onDone     called once when elapsed first reaches the total
//
// Returns { progress 0..1, remainingSec, scale 0..1, phase } — `scale` is the
// orb size (1 = fully expanded / lungs full, 0 = settled / empty).
export function useDescent({ startedAt, totalSec, breath, running, onDone }) {
  const [state, setState] = useState({ progress: 0, remainingSec: totalSec, scale: 0, phase: 'inhale' })

  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const firedDone = useRef(false)

  // Rolling breath timeline, in elapsed-seconds. `queue` holds the remaining
  // phases of the current cycle; when it empties we rebuild a fresh cycle at the
  // current elapsed, so the exhale lengthens as the night goes on.
  const breath_ = useRef({ queue: [], phase: null, phaseStart: 0, phaseDur: 0 })

  useEffect(() => {
    if (!running) return undefined

    // Reset the breath timeline whenever we (re)start or the pattern changes.
    breath_.current = { queue: [], phase: null, phaseStart: 0, phaseDur: 0 }
    firedDone.current = false

    let raf = 0

    const frame = () => {
      const elapsed = Math.max(0, (Date.now() - startedAt) / 1000)
      const progress = totalSec > 0 ? Math.min(1, elapsed / totalSec) : 1
      const remainingSec = Math.max(0, Math.ceil(totalSec - elapsed))

      // Advance the breath phase(s). Capped so a long tab-hidden jump can't spin.
      const b = breath_.current
      let guard = 0
      while ((b.phase === null || elapsed >= b.phaseStart + b.phaseDur) && guard < 400) {
        guard += 1
        if (b.queue.length === 0) b.queue = cyclePhases(breath, elapsed, totalSec)
        const next = b.queue.shift()
        b.phaseStart = b.phase === null ? elapsed : b.phaseStart + b.phaseDur
        b.phase = next
        b.phaseDur = next.dur
      }
      const t = b.phaseDur > 0 ? (elapsed - b.phaseStart) / b.phaseDur : 0
      const scale = scaleFor(b.phase, Math.min(1, Math.max(0, t)))

      setState({ progress, remainingSec, scale, phase: b.phase.phase })

      if (!firedDone.current && elapsed >= totalSec) {
        firedDone.current = true
        onDoneRef.current?.()
        return // stop the loop; the session is over
      }
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [startedAt, totalSec, breath, running])

  return state
}
