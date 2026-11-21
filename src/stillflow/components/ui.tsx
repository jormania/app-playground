import { useState, type ReactNode } from 'react'
import type { Session } from '../domain/types'
import { INTENSITY_LABELS, REPEAT_LABELS, repeatLabel } from '../domain/vocabulary'
import { cx } from '../../ds/lib/cx'
import styles from './ui.module.css'

/** The lowercase wordmark with its ripple: two arcs settling on a still line. */
export function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={cx(styles.wordmark, styles[`wm_${size}`])}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className={styles.mark}>
        <path d="M5 21c3.2-4.5 6.6-6.7 11-6.7S23.8 16.5 27 21" />
        <path d="M9.5 21c1.8-2.4 3.9-3.6 6.5-3.6s4.7 1.2 6.5 3.6" />
        <path d="M4 25h24" />
      </svg>
      stillflow
    </span>
  )
}

export function IntensityDots({ level, showLabel = false }: { level: number; showLabel?: boolean }) {
  const label = level ? INTENSITY_LABELS[level - 1] : 'Intensity not set'
  return (
    <span className={styles.intensity} title={label} aria-label={label}>
      <span className={styles.dots} aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => <i key={n} className={cx(styles.dot, n <= level && styles.dotOn)} />)}
      </span>
      {showLabel && <span className={styles.intensityLabel}>{label}</span>}
    </span>
  )
}

/** YouTube's thumbnail, or a quiet two-tone plate when there isn't one or it fails (offline). */
export function Thumb({ session, className }: { session: Session; className?: string }) {
  const [failed, setFailed] = useState(false)
  const src = session.thumbnailUrl
  return (
    <div className={cx(styles.thumb, className)}>
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <div className={styles.plate} aria-hidden="true">
          <svg viewBox="0 0 120 68" preserveAspectRatio="xMidYMid slice">
            <circle cx={30 + (session.durationMinutes % 50)} cy="70" r="46" />
            <circle cx={96 - (session.intensity * 7)} cy="8" r="30" />
          </svg>
          <span>{session.styles[0] ?? 'Practice'}</span>
        </div>
      )}
      <span className={styles.duration}>{session.durationMinutes} min</span>
    </div>
  )
}

export function Chip({
  selected, onClick, children, tone = 'sage',
}: { selected?: boolean; onClick?: () => void; children: ReactNode; tone?: 'sage' | 'lavender' }) {
  return (
    <button type="button" className={cx(styles.chip, selected && styles.chipOn, tone === 'lavender' && styles.lavender)}
      aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  )
}

export function ChipGroup<T extends string | number>({
  label, options, selected, onChange, render,
}: {
  label: string
  options: readonly T[]
  selected: T[]
  onChange: (next: T[]) => void
  render?: (v: T) => ReactNode
}) {
  return (
    <fieldset className={styles.group}>
      <legend>{label}</legend>
      <div className={styles.chips}>
        {options.map((o) => (
          <Chip key={String(o)} selected={selected.includes(o)}
            onClick={() => onChange(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o])}>
            {render ? render(o) : String(o)}
          </Chip>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * Repeat interest, 1–5: how much you'd like to practise this again. Drawn as
 * five rising steps rather than stars, because it is not a quality score.
 */
export function RepeatRating({ value, onChange, label = 'Repeat interest', showCaption = true }: {
  value?: number
  onChange?: (v: number | undefined) => void
  label?: string
  showCaption?: boolean
}) {
  return (
    <span className={styles.repeat}>
      <span className={styles.steps} role={onChange ? 'radiogroup' : 'img'} aria-label={onChange ? label : `${label}: ${repeatLabel(value)}`}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = (value ?? 0) >= n
          const bar = <i className={cx(styles.step, on && styles.stepOn)} style={{ height: `${6 + n * 3}px` }} />
          return onChange ? (
            <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n}: ${REPEAT_LABELS[n - 1]}`}
              className={styles.stepBtn} onClick={() => onChange(value === n ? undefined : n)}>
              {bar}
            </button>
          ) : <span key={n} className={styles.stepBtn} aria-hidden="true">{bar}</span>
        })}
      </span>
      {showCaption && <span className={styles.repeatCaption}>{repeatLabel(value)}</span>}
    </span>
  )
}

export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className={styles.sectionHead}>
      <h2>{title}</h2>
      {action}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <svg viewBox="0 0 64 40" aria-hidden="true">
        <path d="M6 30c8-11 16-16 26-16s18 5 26 16" />
        <path d="M18 30c4-5 8.5-7.5 14-7.5S42 25 46 30" />
        <path d="M4 35h56" />
      </svg>
      <h3>{title}</h3>
      {children && <div className={styles.emptyBody}>{children}</div>}
    </div>
  )
}

export function ConfidenceNote({ session }: { session: Session }) {
  if (session.isDemo) return <span className={cx(styles.badge, styles.badgeDemo)}>Demo record</span>
  if (session.classificationConfidence === 'high') return null
  return (
    <span className={cx(styles.badge, session.classificationConfidence === 'low' && styles.badgeLow)}
      title={`Classification: ${session.classificationSource}, ${session.classificationConfidence} confidence`}>
      {session.classificationConfidence === 'low' ? 'Details are a guess' : 'Details read from YouTube'}
    </span>
  )
}

/** Explore's two views of the library: every session, or your own lists. */
export function LibraryTabs({ on }: { on: 'sessions' | 'collections' }) {
  return (
    <nav className={styles.libraryTabs} aria-label="Library">
      <a href="#/explore" aria-current={on === 'sessions' ? 'page' : undefined}>All sessions</a>
      <a href="#/collections" aria-current={on === 'collections' ? 'page' : undefined}>Collections</a>
    </nav>
  )
}
