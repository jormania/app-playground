/**
 * A donut for the main screens: where income came from, where costs went.
 * Up to five named slices in the validated chart order, the rest folded into
 * "Other"; a 2px surface gap between slices; the ring sweeps in once. Tap a
 * slice to read it in the centre; the key below is the list (a tap there
 * narrows the screen to that part).
 */
import { useId, useState } from 'react'
import { lei, percent } from '../lib/money'
import { useCountUp } from './useCountUp'
import styles from '../styles/ui.module.css'

const SLOTS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export interface DonutPart { id: string; name: string; value: number }

export function Donut({ parts, caption, label, onSelect, max = 5 }: {
  parts: DonutPart[]
  /** Under the total in the centre, e.g. "this year". */
  caption: string
  label: string
  onSelect?: (id: string) => void
  max?: number
}) {
  const maskId = useId()
  const [active, setActive] = useState<string | null>(null)
  const sorted = [...parts].filter((p) => p.value > 0).sort((a, b) => b.value - a.value)
  const total = sorted.reduce((s, p) => s + p.value, 0)
  const shownTotal = useCountUp(total)
  if (total <= 0) return <p className={styles.emptyNote}>Nothing here in this period.</p>
  const named = sorted.slice(0, sorted.length > max ? max - 1 : max)
  const rest = sorted.slice(named.length)
  const slices = [
    ...named.map((p, i) => ({ ...p, color: SLOTS[i], other: false })),
    ...(rest.length ? [{ id: '__other', name: rest.length === 1 ? rest[0].name : `${rest.length} others`, value: rest.reduce((s, p) => s + p.value, 0), color: 'var(--chart-other)', other: rest.length > 1 }] : []),
  ]
  const R = 60
  const C = 2 * Math.PI * R
  const gap = slices.length > 1 ? 2 : 0
  let at = 0
  const arcs = slices.map((s) => {
    const len = (s.value / total) * C
    const arc = { ...s, dash: Math.max(0.5, len - gap), offset: -at }
    at += len
    return arc
  })
  const cur = arcs.find((a) => a.id === active)
  return (
    <div className={styles.donut}>
      <svg viewBox="0 0 160 160" className={styles.donutSvg} role="img"
        aria-label={`${label}: ${arcs.map((a) => `${a.name} ${percent(a.value / total)}`).join(', ')}`}>
        <defs>
          <mask id={maskId}>
            <circle cx="80" cy="80" r={R} fill="none" stroke="#fff" strokeWidth="30" pathLength={100} className={styles.donutSweep} transform="rotate(-90 80 80)" />
          </mask>
        </defs>
        <circle cx="80" cy="80" r={R} fill="none" stroke="var(--color-surface-2)" strokeWidth="22" />
        <g mask={`url(#${maskId})`} transform="rotate(-90 80 80)">
          {arcs.map((a) => (
            <circle key={a.id} cx="80" cy="80" r={R} fill="none" stroke={a.color}
              strokeWidth={active === a.id ? 27 : 22} strokeDasharray={`${a.dash} ${C}`} strokeDashoffset={a.offset}
              opacity={active && active !== a.id ? 0.35 : 1} className={styles.donutArc}
              onClick={() => setActive((x) => (x === a.id ? null : a.id))} onMouseEnter={() => setActive(a.id)} onMouseLeave={() => setActive(null)}>
              <title>{`${a.name}: ${lei(a.value)} (${percent(a.value / total)})`}</title>
            </circle>
          ))}
        </g>
      </svg>
      <div className={styles.donutCentre} aria-live="polite">
        {cur ? (
          <>
            <b>{percent(cur.value / total)}</b>
            <span className={styles.donutCentreName}>{cur.name}</span>
            <span>{lei(cur.value)}</span>
          </>
        ) : (
          <>
            <b>{lei(shownTotal)}</b>
            <span>{caption}</span>
          </>
        )}
      </div>
      <div className={styles.donutKey}>
        {arcs.map((a) => {
          // "Other" folds several parts, so it is never a filter.
          const Row = onSelect && a.id !== '__other' ? 'button' : 'div'
          return (
          <Row key={a.id} className={styles.shareKeyRow} onMouseEnter={() => setActive(a.id)} onMouseLeave={() => setActive(null)}
            {...(Row === 'button' ? { type: 'button' as const, onClick: () => onSelect!(a.id) } : {})}>
            <span className={styles.swatch} style={{ background: a.color }} />
            <span className={styles.shareName}>{a.name}</span>
            <span className={styles.shareValue}>{lei(a.value)} <span className={styles.panelSub}>{percent(a.value / total)}</span></span>
          </Row>
          )
        })}
      </div>
    </div>
  )
}
