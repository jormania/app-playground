/**
 * The pieces of the Insights and Venue deals reports: the heat map, the
 * "fixed or share?" chart and the list of pain points and wins.
 */
import { AlertTriangle, Lightbulb, TrendingUp } from 'lucide-react'
import type { HeatMap, Insight } from '../lib/insights'
import type { DealCurvePoint } from '../lib/deals'
import { compact, lei } from '../lib/money'
import styles from '../styles/ui.module.css'

/** A cell's fill: deeper green for more, amber for below zero; text stays ink. */
function fill(value: number, max: number, min: number): string {
  if (value < 0) {
    const t = min < 0 ? Math.min(1, value / min) : 1
    return `color-mix(in srgb, var(--chart-3) ${Math.round(18 + t * 47)}%, var(--color-surface))`
  }
  const t = max > 0 ? value / max : 0
  return `color-mix(in srgb, var(--chart-1) ${Math.round(8 + t * 62)}%, var(--color-surface))`
}

export function HeatMapTable({ map, rowNoun, onCell }: { map: HeatMap; rowNoun: string; onCell?: (rowId: string, colId: string) => void }) {
  if (!map.rows.length) return <p className={styles.hint}>Nothing in this period.</p>
  return (
    <>
      <div className={styles.tableWrap}>
        <table className={`${styles.statement} ${styles.heat}`}>
          <thead>
            <tr><th>{rowNoun}</th>{map.cols.map((c) => <th key={c.id} title={c.name}>{c.name}</th>)}</tr>
          </thead>
          <tbody>
            {map.rows.map((r, i) => (
              <tr key={r.id}>
                <td title={r.name}>{r.name}</td>
                {map.cols.map((c, j) => {
                  const cell = map.cells[i][j]
                  return cell ? (
                    <td key={c.id} style={{ background: fill(cell.value, map.max, map.min) }}
                      title={`${r.name} · ${c.name}: ${lei(cell.value)} (${cell.count} ${cell.count === 1 ? 'session' : 'sessions'})`}
                      className={onCell ? styles.heatClick : undefined} onClick={onCell ? () => onCell(r.id, c.id) : undefined}>
                      {compact(cell.value)}
                    </td>
                  ) : <td key={c.id} className={styles.heatEmpty}>·</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.legend} style={{ marginTop: 'var(--space-xs)' }}>
        <span><span className={styles.swatch} style={{ background: fill(map.max * 0.15, map.max, map.min) }} /><span className={styles.swatch} style={{ background: fill(map.max, map.max, map.min), marginLeft: -4 }} />more is deeper</span>
        {map.min < 0 && <span><span className={styles.swatch} style={{ background: fill(map.min, map.max, map.min) }} />lost money</span>}
        <span>· nothing there</span>
      </div>
    </>
  )
}

export function InsightList({ items, limit }: { items: Insight[]; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items
  if (!shown.length) return <p className={styles.hint}>Nothing stands out in this period. Try a longer one, like Year.</p>
  return (
    <ul className={styles.insights}>
      {shown.map((i) => (
        <li key={i.id} className={`${styles.insight} ${styles[`insight_${i.kind}`]}`}>
          <span className={styles.insightIcon} aria-hidden>
            {i.kind === 'pain' ? <AlertTriangle size={16} /> : i.kind === 'win' ? <TrendingUp size={16} /> : <Lightbulb size={16} />}
          </span>
          <span>
            <span className={styles.insightKind}>{i.kind === 'pain' ? 'Pain point' : i.kind === 'win' ? 'Working well' : 'Worth knowing'}</span>
            <b className={styles.insightTitle}>{i.title}</b>
            <span className={styles.insightDetail}>{i.detail}</span>
            {i.link && <a className={styles.linkButton} href={i.link.hash}>{i.link.label} →</a>}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function DealChart({ points, avg, currentLabel, altLabel }: { points: DealCurvePoint[]; avg: number | null; currentLabel: string; altLabel: string }) {
  const W = 560
  const H = 200
  const L = 44
  const B = 26
  const T = 10
  const xs = points.map((p) => p.attendees)
  const ys = points.flatMap((p) => [p.current, p.alternative])
  const ymin = Math.min(0, ...ys)
  const ymax = Math.max(1, ...ys)
  const xmax = Math.max(1, ...xs)
  const x = (n: number) => L + (n / xmax) * (W - L - 8)
  const y = (v: number) => T + (1 - (v - ymin) / (ymax - ymin)) * (H - T - B)
  const path = (k: 'current' | 'alternative') => points.map((p, i) => `${i ? 'L' : 'M'}${x(p.attendees).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ')
  const step = xmax > 12 ? Math.ceil(xmax / 8) : 1
  return (
    <div>
      <div className={styles.legend} aria-hidden>
        <span><span className={styles.swatch} style={{ background: 'var(--chart-1)' }} />{currentLabel}</span>
        <span><span className={styles.swatch} style={{ background: 'var(--chart-2)' }} />{altLabel}</span>
        {avg !== null && <span>┆ your average</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img"
        aria-label={`What one session leaves you by number of people: ${currentLabel} against ${altLabel}`}>
        <line x1={L} x2={W} y1={y(0)} y2={y(0)} className={styles.gridLine} />
        <text x={L - 6} y={y(0) + 4} textAnchor="end" className={styles.chartLabel}>0</text>
        <text x={L - 6} y={y(ymax) + 4} textAnchor="end" className={styles.chartLabel}>{compact(ymax)}</text>
        {ymin < 0 && <text x={L - 6} y={y(ymin) + 4} textAnchor="end" className={styles.chartLabel}>{compact(ymin)}</text>}
        {points.filter((p) => p.attendees % step === 0).map((p) => (
          <text key={p.attendees} x={x(p.attendees)} y={H - 8} textAnchor="middle" className={styles.chartLabel}>{p.attendees}</text>
        ))}
        {avg !== null && <line x1={x(avg)} x2={x(avg)} y1={T} y2={H - B} stroke="var(--color-faint)" strokeDasharray="3 4" />}
        <path d={path('alternative')} fill="none" stroke="var(--chart-2)" strokeWidth={2} strokeLinejoin="round" />
        <path d={path('current')} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinejoin="round" />
      </svg>
      <div className={styles.tooltip} style={{ textAlign: 'center' }}>people at the session</div>
    </div>
  )
}
