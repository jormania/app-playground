/**
 * Hand-drawn SVG charts: small, themed by tokens, and nothing to download.
 * Forms follow the dataviz rules: one hue for magnitude (bars, breakdowns),
 * the previous period as a recessive ghost bar, thin marks with rounded data
 * ends, a legend for two series, a hover readout on every bar, and the
 * fixed three-hue order for taxability.
 */
import { useState, type ReactNode } from 'react'
import type { Bucket } from '../lib/period'
import { compact, delta, lei, percent } from '../lib/money'
import { monthLabel, shortDate, weekdayShort } from '../lib/dates'
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
  // The mouse previews a bar; a tap (or click) keeps it chosen until tapped again or cleared.
  const [hovered, setHovered] = useState<number | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const hover = hovered ?? picked
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
            <g key={b.from} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} onClick={() => setPicked((p) => (p === i ? null : i))} className={styles.barGroup}>
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
      <Readout buckets={buckets} current={current} previous={previous} previousLabel={previousLabel} index={hover} onClear={() => { setPicked(null); setHovered(null) }} />
    </div>
  )
}

export interface ReadoutFigure { label: string; value: number; swatch?: string; muted?: boolean; negative?: boolean }

/**
 * The figures under a bar chart, the same on every chart: their own space under a rule, a title
 * for what is shown (one bar, or the whole range), each figure labelled with its legend swatch,
 * side by side, and an optional line below.
 */
export function ChartReadout({ title, hint, onClear, clearLabel, figures, children }: {
  title: string; hint: string; onClear?: () => void; clearLabel: string; figures: ReadoutFigure[]; children?: ReactNode
}) {
  return (
    <div className={styles.readout} aria-live="polite">
      <div className={styles.readoutHead}>
        <span>{title}</span>
        {onClear ? <button type="button" className={styles.linkButton} onClick={onClear}>{clearLabel}</button> : <span className={styles.readoutHint}>{hint}</span>}
      </div>
      <div className={styles.readoutFigures} style={{ gridTemplateColumns: `repeat(${figures.length}, minmax(0, 1fr))` }}>
        {figures.map((f) => (
          <div key={f.label}>
            <span className={styles.statLabel}>{f.swatch && <span className={styles.swatch} style={{ background: f.swatch }} />}{f.label}</span>
            <span className={`${styles.readoutValue} ${f.muted ? styles.readoutPrev : ''} ${f.negative ? styles.down : ''}`}>{lei(f.value)}</span>
          </div>
        ))}
      </div>
      {children}
    </div>
  )
}

/**
 * The figures under the chart, with room of their own: what is chosen (a day, a week or the whole
 * period), then this period's figure and the previous period's beside it, each labelled, and for one
 * bar the change between them.
 */
function Readout({ buckets, current, previous, previousLabel, index, onClear }: {
  buckets: Bucket[]; current: number[]; previous: number[]; previousLabel: string; index: number | null; onClear: () => void
}) {
  const one = index !== null
  // What one bar is, from all of them: a week cut short at the month's edge is still a week.
  const unit = barUnit(buckets)
  const cur = one ? current[index] : current.reduce((a, b) => a + b, 0)
  const prev = one ? previous[index] : previous.reduce((a, b) => a + b, 0)
  const title = one ? bucketTitle(buckets[index], unit) : 'Whole period'
  const change = cur - prev
  const d = delta(cur, prev)
  return (
    <ChartReadout title={title} hint={`Tap a bar for one ${unit}`} clearLabel="Whole period" onClear={one ? onClear : undefined}
      figures={[
        { label: one ? 'This period' : 'So far', value: cur, swatch: 'var(--color-accent)' },
        { label: capitalise(previousLabel), value: prev, swatch: 'var(--chart-ghost)', muted: true },
      ]}>
      {one && (cur > 0 || prev > 0) && (
        <p className={styles.readoutChange}>
          {d.direction === 'new' ? `Nothing came in the same ${unit}, ${previousLabel}.`
            : change === 0 ? `The same as the same ${unit}, ${previousLabel}.`
              : <><span className={`${styles.delta} ${change > 0 ? styles.up : styles.down}`}>{change > 0 ? '+' : '−'}{lei(Math.abs(change))} ({d.text})</span> on the same {unit}, {previousLabel}</>}
        </p>
      )}
    </ChartReadout>
  )
}

const daysIn = (b: Bucket) => Math.round((Date.parse(b.to) - Date.parse(b.from)) / 86_400_000) + 1

/** What one bar stands for, from the longest bar: a day, a week, a month or a stretch. */
function barUnit(buckets: Bucket[]): 'day' | 'week' | 'month' | 'stretch' {
  const longest = Math.max(1, ...buckets.map(daysIn))
  return longest === 1 ? 'day' : longest === 7 ? 'week' : longest >= 28 ? 'month' : 'stretch'
}

/** "Mon 23 Nov" for a day; "Week of 23 Nov", "November 2026" or "23 – 29 Nov" otherwise. */
function bucketTitle(b: Bucket, unit: ReturnType<typeof barUnit>): string {
  if (unit === 'day') return `${weekdayShort(b.from)} ${shortDate(b.from)}`
  if (unit === 'week') return `Week of ${shortDate(b.from)}${b.from === b.to ? '' : ` – ${shortDate(b.to)}`}`
  if (unit === 'month') return monthLabel(b.from)
  if (b.from === b.to) return shortDate(b.from)
  return b.from.slice(5, 7) === b.to.slice(5, 7) ? `${Number(b.from.slice(8, 10))} – ${shortDate(b.to)}` : `${shortDate(b.from)} – ${shortDate(b.to)}`
}

/** A bar with 4px rounded data end, square on the baseline. */
function barPath(x: number, baseY: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h)
  const t = baseY - h
  return `M${x},${baseY} V${t + r} Q${x},${t} ${x + r},${t} H${x + w - r} Q${x + w},${t} ${x + w},${t + r} V${baseY} Z`
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

export interface MoverRow {
  key: string
  name: string
  /** What it is: "Client", "Venue", "Activity". */
  tag: string
  change: number
  current: number
  previous: number
}

/**
 * What moved most, read at a glance: grouped into what fell and what rose (the bigger movement
 * first), each row its name in full (wrapping, never cut), the change beside it, what it is with
 * before → now under it, and a thin bar the width of the change across the row. Rises are green,
 * drops amber; the sign and the heading say the direction too, never colour alone.
 */
export function MoversChart({ rows, onSelect, prevLabel }: { rows: MoverRow[]; onSelect?: (key: string) => void; prevLabel: string }) {
  if (!rows.length) return <p className={styles.hint}>Nothing moved against {prevLabel}.</p>
  const max = Math.max(...rows.map((r) => Math.abs(r.change)), 1)
  const Row = onSelect ? 'button' : 'div'
  const fell = rows.filter((r) => r.change < 0).sort((a, b) => a.change - b.change)
  const rose = rows.filter((r) => r.change > 0).sort((a, b) => b.change - a.change)
  const groups = [{ id: 'fell', title: 'Fell', rows: fell }, { id: 'rose', title: 'Rose', rows: rose }]
    .filter((g) => g.rows.length)
    .sort((a, b) => Math.abs(b.rows[0].change) - Math.abs(a.rows[0].change))
  return (
    <div className={styles.movers}>
      {groups.map((g) => (
        <div key={g.id} className={styles.moverGroup} role="group" aria-label={g.title}>
          <h3 className={styles.moverGroupTitle}>{g.title}</h3>
          {g.rows.map((r) => {
            const up = r.change > 0
            return (
              <Row key={r.key} className={styles.mover} {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(r.key) } : {})}
                title={`${r.name}: ${lei(r.current)} now, ${lei(r.previous)} ${prevLabel}`}>
                <span className={styles.moverName}>{r.name}</span>
                <span className={`${styles.moverValue} ${up ? styles.up : styles.down}`}>{up ? '+' : '−'}{compact(Math.abs(r.change))}</span>
                <span className={styles.moverMeta}>{r.tag} · {compact(r.previous)} → {compact(r.current)}</span>
                <span className={styles.moverTrack} aria-hidden>
                  <span className={up ? styles.moverUp : styles.moverDown} style={{ width: `${(Math.abs(r.change) / max) * 100}%` }} />
                </span>
              </Row>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** Income and costs month by month, side by side, with what was kept in the readout. */
export function MonthlyPair({ months, income, costs }: { months: { label: string; from: string }[]; income: number[]; costs: number[] }) {
  // As on the trend chart: the mouse previews a month; a tap keeps it chosen.
  const [hovered, setHovered] = useState<number | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const hover = hovered ?? picked
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
            <g key={m.from} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} onClick={() => setPicked((p) => (p === i ? null : i))} className={styles.barGroup}>
              <rect x={slot * i} y={top} width={slot} height={plotH + bottom} className={styles.barHit} />
              {income[i] > 0 && <path d={barPath(cx - barW - 1, top + plotH, barW, top + plotH - y(income[i]))} fill="var(--chart-1)" opacity={hover === null || hover === i ? 1 : 0.5} />}
              {costs[i] > 0 && <path d={barPath(cx + 1, top + plotH, barW, top + plotH - y(costs[i]))} fill="var(--chart-3)" opacity={hover === null || hover === i ? 1 : 0.5} />}
              {i % every === 0 && <text x={cx} y={H - 6} textAnchor="middle" className={styles.chartLabel}>{m.label}</text>}
            </g>
          )
        })}
      </svg>
      {(() => {
        const one = hover !== null
        const inn = one ? income[hover] : income.reduce((a, b) => a + b, 0)
        const out = one ? costs[hover] : costs.reduce((a, b) => a + b, 0)
        return (
          <ChartReadout title={one ? monthLabel(months[hover].from) : n > 1 ? `${monthLabel(months[0].from)} – ${monthLabel(months[n - 1].from)}` : 'Whole period'}
            hint="Tap a month for its figures" clearLabel="All months" onClear={one ? () => { setPicked(null); setHovered(null) } : undefined}
            figures={[
              { label: 'Income', value: inn, swatch: 'var(--chart-1)' },
              { label: 'Costs', value: out, swatch: 'var(--chart-3)' },
              { label: 'Kept', value: inn - out, negative: inn - out < 0 },
            ]} />
        )
      })()}
    </div>
  )
}
