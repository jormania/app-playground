import { useEffect, useState } from 'react'
import { tempoOf } from '../midi/clockTracker'
import { noteName } from '../midi/noteNames'
import { summarise } from '../midi/timing'
import type { ProbeSnapshot } from '../probe/probeSession'
import { clock, ms } from './format'
import styles from './probe.module.css'

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  )
}

/** Re-render once a second so a tempo readout can go blank when the clock stops sending. */
function useNow(periodMs: number): number {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), periodMs)
    return () => clearInterval(id)
  }, [periodMs])
  return now
}

const TRANSPORT_TEXT = { playing: 'Style playing', stopped: 'Style stopped', unknown: '' } as const

export function LivePanel({ snap }: { snap: ProbeSnapshot }) {
  const now = Math.max(useNow(1000), snap.clock.ticks.at(-1) ?? 0)
  const tempo = tempoOf(snap.clock, now)
  const transport = TRANSPORT_TEXT[snap.clock.transport]
  const t = snap.tracker
  const last = t.lastNoteOn
  const done = t.lastPlayed && last && t.lastPlayed.onTime === last.onTime && t.lastPlayed.note === last.note ? t.lastPlayed : null
  const lag = summarise(snap.dispatchLag)
  const frame = summarise(snap.toFrame)
  const c = t.counts
  const realtime = Object.entries(c.realtime).map(([k, n]) => `${k}h×${n}`).join(' ')

  return (
    <section className={styles.panel} aria-label="Live readout">
      <h2 className={styles.h2}>Live</h2>
      <div className={styles.held} aria-live="polite">
        {t.held.length ? t.held.map((h) => <span key={`${h.channel}:${h.note}`} className={styles.chip}>{noteName(h.note)}</span>) : <span className={styles.faint}>No keys held</span>}
        {t.sustain && <span className={`${styles.chip} ${styles.chipAlt}`}>Sustain</span>}
      </div>
      <div className={styles.stats}>
        <Stat label="Last note" value={last ? `${noteName(last.note)} (${last.note})` : '—'} />
        <Stat label="Channel" value={last?.channel ?? '—'} />
        <Stat label="Velocity" value={last?.velocity ?? '—'} />
        <Stat label="Note on" value={last ? clock(last.onTime, snap.origin) : '—'} />
        <Stat label="Note off" value={done ? clock(done.offTime, snap.origin) : last ? 'held' : '—'} />
        <Stat label="Duration" value={done ? ms(done.durationMs, 0) : '—'} />
      </div>
      <div className={styles.stats}>
        <Stat label="On / Off" value={`${c.noteOn} / ${c.noteOff}`} />
        <Stat label="Velocity range" value={t.velocities ? `${t.velocities.min}–${t.velocities.max}` : '—'} />
        <Stat label="Channels seen" value={t.channels.length ? t.channels.join(', ') : '—'} />
        <Stat label="Lost / orphan / reordered" value={`${c.doubleOns} / ${c.orphanOffs} / ${c.outOfOrder}`} />
        <Stat label="Dispatch lag p50 / p95" value={lag ? `${lag.median.toFixed(1)} / ${lag.p95.toFixed(1)} ms` : '—'} />
        <Stat
          label="Keyboard tempo (MIDI Clock)"
          value={tempo ? `${tempo.bpm.toFixed(1)} BPM${transport ? ` · ${transport}` : ''}` : transport || 'no clock'}
        />
        <Stat label="To next frame p50 / p95" value={frame ? `${frame.median.toFixed(1)} / ${frame.p95.toFixed(1)} ms` : '—'} />
      </div>
      {realtime && <p className={styles.faint}>Realtime (not keys): {realtime}</p>}
    </section>
  )
}
