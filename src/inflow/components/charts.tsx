/**
 * Hand-drawn SVG charts: small, themed by tokens, and nothing to download.
 * Forms follow the dataviz rules: one hue for magnitude (bars, breakdowns),
 * the previous period as a recessive ghost bar, thin marks with rounded data
 * ends, a legend for two series, a hover readout on every bar, and the
 * fixed three-hue order for taxability.
 */
import { useState } from 'react'
import type { Bucket } from '../lib/period'
import { compact, lei, percent } from '../lib/money'
import type { BreakdownRow } from '../lib/analytics'
import styles from '../styles/ui.module.css'

export interface TrendChartProps {
  buckets: Bucket[]
  current: number[]
  previous: number[]
  previousLabel: string
  /** Index of the bucket containing today, highlighted in the readout. */
  todayIndex?: number
}

export function TrendChart({ buckets, current, previous, previousLabel }: TrendChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const H = 180
  const top = 12
  const bottom = 22
  const left = 4
  const plotH = H - top - bottom
  const max = Math.max(1, ...current, ...previous)
  const n = buckets.length
  const slot = (W - left) / n
  const barW = Math.max(3, Math.min(34, slot * 0.36))
  const y = (v: number) => top + plotH - (v / max) * plotH
  const ticks = [0.5, 1].map((f) => f * max)
  const showEvery = n > 16 ? Math.ceil(n / 8) : 1
  const h = hover ?? -1

  return (
    <div>
      <div className={styles.legend} aria-hidden>
        <span><span className={styles.swatch} style={{ background: 'var(--color-accent)' }} />This period</span>
        <span><span className={styles.swatch} style={{ background: 'var(--chart-ghost)' }} />{capitalise(previousLabel)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img" aria-label={`Income per ${n <= 7 ? 'day' : 'period'}: ${buckets.map((b, i) => `${b.label} ${lei(current[i])}`).join(', ')}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={W} y1={y(t)} y2={y(t)} className={styles.gridLine} />
            <text x={W} y={y(t) - 4} textAnchor="end" className={styles.chartLabel}>{compact(t)}</text>
          </g>
        ))}
        <line x1={left} x2={W} y1={top + plotH} y2={top + plotH} className={styles.gridLine} />
        {buckets.map((b, i) => {
          const cx = left + slot * i + slot / 2
          const curH = (current[i] / max) * plotH
          const prevH = (previous[i] / max) * plotH
          return (
            <g key={b.from} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)} className={styles.barGroup}>
              <rect x={left + slot * i} y={top} width={slot} height={plotH + bottom} className={styles.barHit} />
              {prevH > 0 && <path d={barPath(cx + barW * 0.15, top + plotH, barW, prevH)} className={styles.barPrev} />}
              {curH > 0 && <path d={barPath(cx - barW * 1.15, top + plotH, barW, curH)} className={styles.barCur} opacity={h === -1 || h === i ? 1 : 0.55} />}
              {(i % showEvery === 0 || n <= 16) && (
                <text x={cx} y={H - 6} textAnchor="middle" className={styles.chartLabel}>{b.label}</text>
              )}
            </g>
          )
        })}
      </svg>
      <div className={styles.tooltip} aria-live="polite">
        {hover !== null
          ? <>{rangeLabel(buckets[hover])}: <b>{lei(current[hover])}</b> · {previousLabel}: {lei(previous[hover])}</>
          : <>Tap a bar for its figure.</>}
      </div>
    </div>
  )
}

/** A bar with 4px rounded data end, square on the baseline. */
function barPath(x: number, baseY: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h)
  const t = baseY - h
  return `M${x},${baseY} V${t + r} Q${x},${t} ${x + r},${t} H${x + w - r} Q${x + w},${t} ${x + w},${t + r} V${baseY} Z`
}

function rangeLabel(b: Bucket): string {
  return b.from === b.to ? b.from : `${b.from} – ${b.to}`
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export interface BreakdownListProps {
  rows: BreakdownRow[]
  limit?: number
  onSelect?: (row: BreakdownRow) => void
  /** Show "n payments · avg" under each bar. */
  meta?: boolean
}

export function BreakdownList({ rows, limit = 5, onSelect, meta = true }: BreakdownListProps) {
  if (rows.length === 0) return <p className={styles.hint}>Nothing in this period.</p>
  const shown = rows.slice(0, limit)
  const rest = rows.slice(limit)
  const max = Math.max(...rows.map((r) => r.total), 1)
  const Row = onSelect ? 'button' : 'div'
  return (
    <div className={styles.rows}>
      {shown.map((r) => (
        <Row key={r.id} className={styles.row} {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(r) } : {})}>
          <span className={styles.rowName}>{r.name}</span>
          <span className={styles.rowValue}>{lei(r.total)} <span className={styles.panelSub}>{percent(r.share)}</span></span>
          <span className={styles.rowBar}><span className={styles.rowBarFill} style={{ width: `${(r.total / max) * 100}%` }} /></span>
          {meta && <span className={styles.rowMeta}>{r.count} {r.count === 1 ? 'payment' : 'payments'} · avg {lei(r.average)}</span>}
        </Row>
      ))}
      {rest.length > 0 && (
        <p className={styles.hint}>
          and {rest.length} more ({lei(rest.reduce((s, r) => s + r.total, 0))})
        </p>
      )}
    </div>
  )
}

export interface SplitPart {
  key: string
  label: string
  value: number
  color: string
}

/** A single stacked bar with a labelled key below: parts of one whole. */
export function SplitBar({ parts, total }: { parts: SplitPart[]; total: number }) {
  const visible = parts.filter((p) => p.value > 0)
  return (
    <div>
      <div className={styles.stack} role="img" aria-label={parts.map((p) => `${p.label} ${lei(p.value)}`).join(', ')}>
        {total > 0
          ? visible.map((p) => <span key={p.key} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${lei(p.value)}`} />)
          : <span style={{ width: '100%', background: 'var(--color-surface-2)' }} />}
      </div>
      <div className={styles.keyList}>
        {parts.map((p) => (
          <div key={p.key} className={styles.keyRow}>
            <span className={styles.swatch} style={{ background: p.color }} />
            <span>{p.label} <span className={styles.panelSub}>{total > 0 ? percent(p.value / total) : ''}</span></span>
            <span>{lei(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const SLOTS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export interface SharePart { id: string; name: string; value: number }

/**
 * One whole split into its largest parts: a tall segmented bar (≤ 5 named
 * parts, the rest folded into "Other"), shares printed where they fit, and a
 * key below. Colours go by place in this list, which is by size.
 */
export function ShareBar({ parts, onSelect, label, max = 5 }: { parts: SharePart[]; onSelect?: (id: string) => void; label: string; max?: number }) {
  const [hover, setHover] = useState<string | null>(null)
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0)
  if (total <= 0) return <p className={styles.hint}>Nothing in this period.</p>
  const sorted = [...parts].filter((p) => p.value > 0).sort((a, b) => b.value - a.value)
  const named = sorted.slice(0, sorted.length > max ? max : sorted.length)
  const rest = sorted.slice(named.length)
  const blocks = [
    ...named.map((p, i) => ({ ...p, color: SLOTS[i], other: false })),
    ...(rest.length ? [{ id: '__other', name: `${rest.length} other${rest.length === 1 ? '' : 's'}`, value: rest.reduce((s, p) => s + p.value, 0), color: 'var(--chart-other)', other: true }] : []),
  ]
  return (
    <div>
      <div className={styles.shareBar} role="img" aria-label={`${label}: ${blocks.map((b) => `${b.name} ${percent(b.value / total)}`).join(', ')}`}>
        {blocks.map((b) => {
          const share = b.value / total
          return (
            <span key={b.id} style={{ flexGrow: b.value, background: b.color, opacity: hover && hover !== b.id ? 0.45 : 1 }}
              onMouseEnter={() => setHover(b.id)} onMouseLeave={() => setHover(null)} title={`${b.name}: ${lei(b.value)} (${percent(share)})`}>
              {share >= 0.12 ? percent(share) : ''}
            </span>
          )
        })}
      </div>
      <div className={styles.shareKey}>
        {blocks.map((b) => {
          const Row = onSelect && !b.other ? 'button' : 'div'
          return (
          <Row key={b.id} className={styles.shareKeyRow} onMouseEnter={() => setHover(b.id)} onMouseLeave={() => setHover(null)}
            {...(Row === 'button' ? { type: 'button' as const, onClick: () => onSelect!(b.id) } : {})}>
            <span className={styles.swatch} style={{ background: b.color }} />
            <span className={styles.shareName}>{b.name}</span>
            <span className={styles.shareValue}>{lei(b.value)} <span className={styles.panelSub}>{percent(b.value / total)}</span></span>
          </Row>
          )
        })}
      </div>
    </div>
  )
}

export interface MoverRow { key: string; name: string; tag: string; change: number; current: number; previous: number }

/**
 * What moved most: bars either side of a zero line, rises in the series
 * green, drops in amber (the two poles; no hue at the midpoint). The figure
 * and the name are text, so the direction never rests on colour alone.
 */
export function MoversChart({ rows, onSelect, prevLabel }: { rows: MoverRow[]; onSelect?: (key: string) => void; prevLabel: string }) {
  if (!rows.length) return <p className={styles.hint}>Nothing moved against {prevLabel}.</p>
  const max = Math.max(...rows.map((r) => Math.abs(r.change)), 1)
  const Row = onSelect ? 'button' : 'div'
  return (
    <div className={styles.movers}>
      {rows.map((r) => {
        const w = `${(Math.abs(r.change) / max) * 100}%`
        const up = r.change > 0
        return (
          <Row key={r.key} className={styles.mover} {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(r.key) } : {})}
            title={`${r.name}: ${lei(r.current)} now, ${lei(r.previous)} ${prevLabel}`}>
            <span className={styles.moverName}>{r.name}<span className={styles.moverTag}>{r.tag}</span></span>
            <span className={styles.moverTrack} aria-hidden>
              <span className={styles.moverHalf}>{!up && <span className={styles.moverDown} style={{ width: w }} />}</span>
              <span className={styles.moverHalf}>{up && <span className={styles.moverUp} style={{ width: w }} />}</span>
            </span>
            <span className={`${styles.moverValue} ${up ? styles.up : styles.down}`}>{up ? '+' : '−'}{compact(Math.abs(r.change))}</span>
          </Row>
        )
      })}
    </div>
  )
}

/** Income and costs month by month, side by side, with what was kept in the readout. */
export function MonthlyPair({ months, income, costs }: { months: { label: string; from: string }[]; income: number[]; costs: number[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const H = 170
  const top = 12
  const bottom = 22
  const plotH = H - top - bottom
  const max = Math.max(1, ...income, ...costs)
  const n = months.length
  const slot = W / Math.max(1, n)
  const barW = Math.max(3, Math.min(26, slot * 0.32))
  const y = (v: number) => top + plotH - (v / max) * plotH
  const every = n > 14 ? Math.ceil(n / 8) : 1
  return (
    <div>
      <div className={styles.legend} aria-hidden>
        <span><span className={styles.swatch} style={{ background: 'var(--chart-1)' }} />Income</span>
        <span><span className={styles.swatch} style={{ background: 'var(--chart-3)' }} />Costs</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img"
        aria-label={`Income and costs by month: ${months.map((m, i) => `${m.label} ${lei(income[i])} in, ${lei(costs[i])} out`).join('; ')}`}>
        <line x1={0} x2={W} y1={y(max)} y2={y(max)} className={styles.gridLine} />
        <text x={W} y={y(max) - 3} textAnchor="end" className={styles.chartLabel}>{compact(max)}</text>
        <line x1={0} x2={W} y1={top + plotH} y2={top + plotH} className={styles.gridLine} />
        {months.map((m, i) => {
          const cx = slot * i + slot / 2
          return (
            <g key={m.from} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)} className={styles.barGroup}>
              <rect x={slot * i} y={top} width={slot} height={plotH + bottom} className={styles.barHit} />
              {income[i] > 0 && <path d={barPath(cx - barW - 1, top + plotH, barW, top + plotH - y(income[i]))} fill="var(--chart-1)" opacity={hover === null || hover === i ? 1 : 0.5} />}
              {costs[i] > 0 && <path d={barPath(cx + 1, top + plotH, barW, top + plotH - y(costs[i]))} fill="var(--chart-3)" opacity={hover === null || hover === i ? 1 : 0.5} />}
              {i % every === 0 && <text x={cx} y={H - 6} textAnchor="middle" className={styles.chartLabel}>{m.label}</text>}
            </g>
          )
        })}
      </svg>
      <div className={styles.tooltip} aria-live="polite">
        {hover !== null
          ? <>{months[hover].label}: <b>{lei(income[hover])}</b> in · {lei(costs[hover])} out · kept <b className={income[hover] - costs[hover] < 0 ? styles.down : undefined}>{lei(income[hover] - costs[hover])}</b></>
          : <>Tap a month for its figures.</>}
      </div>
    </div>
  )
}
