/**
 * The pieces of the Review: the heat map and the list of pain points and wins.
 */
import { AlertTriangle, Lightbulb, TrendingUp } from 'lucide-react'
import type { HeatMap, Insight } from '../lib/insights'
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
