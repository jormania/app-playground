import type { SeriesDef } from '../domain/types'
import type { Pace } from '../lib/series'
import { cx } from '../../ds/lib/cx'
import { YoursTag } from './ui'
import s from '../screens/screens.module.css'

const fmt = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** A quiet progress ring: the fraction done, with the count in its middle. */
export function Ring({ value, max }: { value: number; max: number }) {
  const r = 30
  const c = 2 * Math.PI * r
  const frac = max ? Math.min(1, value / max) : 0
  return (
    <span className={s.ring} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={`${value} of ${max} done`}>
      <svg viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r={r} className={s.ringTrack} />
        {frac > 0 && <circle cx="36" cy="36" r={r} className={s.ringFill} strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 36 36)" />}
      </svg>
      <span className={s.ringLabel}><strong>{value}</strong><small>/{max}</small></span>
    </span>
  )
}

/**
 * Where a series run stands: ring, days done, when it started, the pace. The
 * same band heads the series page and Today's "Your next practice"; on Today it
 * also names the series, which the series page already has as its title, and
 * shows the Today message: never a count of misses, only "Practised today" or
 * an invitation. The series page keeps the honest calendar count.
 */
export function SeriesBand({ def, done, skipped = 0, started, pace, name = false }: {
  def: SeriesDef
  done: number
  /** Days skipped by choice: settled, so the pace counts them, but the ring shows only what was practised. */
  skipped?: number
  started?: string
  pace?: Pace | null
  name?: boolean
}) {
  const unit = def.unit.toLowerCase()
  return (
    <div className={s.journeyTop}>
      <Ring value={done} max={def.length} />
      <div className={s.journeyHead}>
        {name && <span className={cx(s.entrySource, s.titleTag)}>{def.name}{def.kind === 'custom' && <YoursTag kind="series" />}</span>}
        <span className={s.journeyKicker}>{done >= def.length ? 'Every practice done' : `${done} of ${def.length} ${unit}s done`}</span>
        {started && <span className={s.journeyStarted}>Started {fmt(started)}{skipped ? ` · ${skipped} skipped` : ''}</span>}
        {pace && done + skipped < def.length && <span className={s.pacePill}>{name ? pace.today : pace.label}</span>}
      </div>
    </div>
  )
}
