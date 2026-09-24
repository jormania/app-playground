import { memo } from 'react'
import { noteName } from '../midi/noteNames'
import { describeRaw, REALTIME_NAMES } from '../midi/parse'
import type { MidiEvent } from '../midi/types'
import { clock } from './format'
import styles from './probe.module.css'

function cells(e: MidiEvent): [string, string, string, string, string] {
  switch (e.type) {
    case 'noteon':
      return ['Note On', noteName(e.note), String(e.note), String(e.velocity), String(e.channel)]
    case 'noteoff':
      return [e.viaZeroVelocity ? 'Note Off*' : 'Note Off', noteName(e.note), String(e.note), String(e.velocity), String(e.channel)]
    case 'cc':
      return [e.controller === 64 ? 'Sustain' : `CC ${e.controller}`, '', '', String(e.value), String(e.channel)]
    case 'program':
      return ['Program', '', '', String(e.program), String(e.channel)]
    case 'realtime':
      return [REALTIME_NAMES[e.status] ?? 'Realtime', '', '', '', '']
    default:
      return [describeRaw(e.data), '', '', '', '']
  }
}

// Memoised: it redraws only when a non-clock event arrives, not on every tick.
export const EventLog = memo(function EventLog({ log, origin }: { log: MidiEvent[]; origin: number }) {
  return (
    <section className={styles.panel} aria-label="Event monitor">
      <h2 className={styles.h2}>Event monitor</h2>
      <div className={styles.logScroll}>
        <table className={styles.log}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Note</th>
              <th>MIDI</th>
              <th>Vel</th>
              <th>Ch</th>
            </tr>
          </thead>
          <tbody>
            {log.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.faint}>Nothing received yet.</td>
              </tr>
            )}
            {log.slice(0, 60).map((e, i) => {
              const [kind, note, midi, vel, ch] = cells(e)
              return (
                <tr key={`${e.time}-${i}`} className={e.type === 'noteon' ? styles.rowOn : undefined}>
                  <td>{clock(e.time, origin)}</td>
                  <td>{kind}</td>
                  <td>{note}</td>
                  <td>{midi}</td>
                  <td>{vel}</td>
                  <td>{ch}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.faint}>* Note Off sent as Note On with velocity 0 — the PSR-E383’s documented form.</p>
    </section>
  )
})
