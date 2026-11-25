/**
 * The pieces of the Insights and Venue deals reports: the heat map, the
 * "fixed or share?" chart and the list of pain points and wins.
 */
import { AlertTriangle, Check, Clock, Eye, Lightbulb, TrendingUp } from 'lucide-react'
import { people, type Verdict, type VerdictLevel } from '../lib/deals'
import { shortDate } from '../lib/dates'
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
        {Math.abs(y(0) - y(ymin)) > 12 || ymin === 0 ? <text x={L - 6} y={y(0) + 4} textAnchor="end" className={styles.chartLabel}>0</text> : null}
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

const VERDICT_WORD: Record<VerdictLevel, string> = { keep: 'Keep', watch: 'Watch', rethink: 'Rethink', early: 'Too early' }
const VERDICT_ICON: Record<VerdictLevel, typeof Check> = { keep: Check, watch: Eye, rethink: AlertTriangle, early: Clock }

/** A verdict as a word with an icon: never colour alone. */
export function VerdictPill({ level }: { level: VerdictLevel }) {
  const Icon = VERDICT_ICON[level]
  return <span className={`${styles.verdictPill} ${styles[`v_${level}`]}`}><Icon size={12} aria-hidden />{VERDICT_WORD[level]}</span>
}

export interface BoardRow { id: string; name: string; deal: string; takePerSession: number; sessions: number; verdict: Verdict }

/**
 * Every venue on one scale: what a session there leaves you, best first,
 * with the call and its reason. Bars below zero run amber, to the left.
 */
export function VerdictBoard({ rows, onSelect }: { rows: BoardRow[]; onSelect: (id: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.takePerSession)))
  const anyNeg = rows.some((r) => r.takePerSession < 0)
  return (
    <div className={styles.board}>
      {rows.map((r) => {
        const w = `${(Math.abs(r.takePerSession) / max) * (anyNeg ? 50 : 100)}%`
        return (
          <button key={r.id} type="button" className={styles.boardRow} onClick={() => onSelect(r.id)}>
            <span className={styles.boardName}>{r.name}<span className={styles.moverTag}>{r.deal} · {r.sessions} {r.sessions === 1 ? 'session' : 'sessions'}</span></span>
            <VerdictPill level={r.verdict.level} />
            <span className={styles.boardTrack} aria-hidden style={anyNeg ? { justifyContent: 'center' } : undefined}>
              {anyNeg ? (
                <>
                  <span className={styles.moverHalf}>{r.takePerSession < 0 && <span className={styles.moverDown} style={{ width: `calc(${w} * 2)` }} />}</span>
                  <span className={styles.moverHalf}>{r.takePerSession >= 0 && <span className={styles.moverUp} style={{ width: `calc(${w} * 2)` }} />}</span>
                </>
              ) : <span className={styles.moverUp} style={{ width: w }} />}
            </span>
            <span className={`${styles.boardValue} ${r.takePerSession < 0 ? styles.down : ''}`}>{lei(r.takePerSession)}<span className={styles.moverTag}>a session</span></span>
            <span className={styles.boardReason}>{r.verdict.reason}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * How full a room must be: one seat per person. The first seats pay the room
 * (amber outline), the rest are yours (green); a marker sits at your usual
 * turnout.
 */
export function SeatStrip({ breakEven, avg, most }: { breakEven: number; avg: number | null; most: number }) {
  const seats = Math.min(24, Math.max(breakEven + 2, Math.ceil(most), Math.ceil(avg ?? 0) + 1))
  const avgAt = avg === null ? null : Math.min(seats, avg)
  return (
    <div className={styles.seats} role="img"
      aria-label={`The first ${people(breakEven)} pay the room; ${avg === null ? 'no head counts yet' : `you average ${people(avg)}`}.`}>
      <div className={styles.seatRow}>
        {Array.from({ length: seats }, (_, i) => (
          <span key={i} className={i < breakEven ? styles.seatRoom : styles.seatYours} />
        ))}
      </div>
      {avgAt !== null && (
        <div className={styles.seatMarker} style={{ left: `calc(${(avgAt / seats) * 100}% - 1px)` }}>
          <span>▲</span><em>you average {avg}</em>
        </div>
      )}
    </div>
  )
}

/** Each session as a bar of what it left after the room, oldest first; losses hang below the line. */
export function SessionBars({ sessions, scale }: { sessions: { id: string; date: string; takeHome: number; attendees: number | null; description: string }[]; scale: number }) {
  const H = 44
  const mid = H / 2
  const w = 100 / Math.max(1, sessions.length)
  return (
    <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className={styles.sessionBars} role="img"
      aria-label={sessions.map((s) => `${s.date}: ${lei(s.takeHome)}`).join(', ')}>
      <line x1="0" x2="100" y1={mid} y2={mid} stroke="var(--color-border-2)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
      {sessions.map((s, i) => {
        const h = Math.max(1, (Math.abs(s.takeHome) / Math.max(1, scale)) * (mid - 2))
        const neg = s.takeHome < 0
        return (
          <rect key={s.id} x={i * w + w * 0.18} width={w * 0.64} y={neg ? mid : mid - h} height={h}
            fill={neg ? 'var(--chart-3)' : 'var(--chart-1)'}>
            <title>{`${shortDate(s.date)} · ${s.description}${s.attendees !== null ? ` · ${people(s.attendees)}` : ''}: ${lei(s.takeHome)} after the room`}</title>
          </rect>
        )
      })}
    </svg>
  )
}
