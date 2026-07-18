import { useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from 'recharts'
import { useLexicon } from '../lib/lexiconContext.jsx'
import { tapestryStats, LOOSE_SKEIN } from '../lib/model.js'
import styles from './Tapestry.module.css'

const WEEK_OPTIONS = [4, 8, 12]
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function mondayLabel(monday) {
  return monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// The Tapestry — a descriptive history over Day + Done, read across every thread
// regardless of the week on screen. Never scored, never streaked (Journal of
// Delights' ethos): just the cloth you've woven, laid out to look at.
export default function Tapestry({ threads }) {
  const { t } = useLexicon()
  const [weeks, setWeeks] = useState(8)
  const stats = useMemo(() => tapestryStats(threads, { weeks }), [threads, weeks])

  const chartData = stats.rows.map(row => {
    const woven = row.days.reduce((s, c) => s + c.woven, 0)
    const total = row.days.reduce((s, c) => s + c.total, 0)
    return { label: mondayLabel(row.monday), woven, total }
  })
  const chartMax = Math.max(1, ...chartData.map(d => d.woven))
  const hottest = stats.hottestSkein
    ? (stats.hottestSkein.skein === LOOSE_SKEIN ? t('loose') : stats.hottestSkein.skein)
    : '—'

  return (
    <div className={styles.view}>
      <div className={styles.head}>
        <h2 className={styles.title}>{t('Tapestry')}</h2>
        <div className={styles.range}>
          {WEEK_OPTIONS.map(w => (
            <button
              key={w}
              type="button"
              className={`${styles.rangeBtn} ${weeks === w ? styles.rangeOn : ''}`}
              aria-pressed={weeks === w}
              onClick={() => setWeeks(w)}
            >{w}w</button>
          ))}
        </div>
      </div>

      <div className={styles.tiles}>
        <Tile value={`${Math.round(stats.completionRate * 100)}%`} label={`${t('woven')} rate`} />
        <Tile value={`${stats.woven}/${stats.total}`} label={`${t('threads')} ${t('woven')}`} />
        <Tile value={hottest} label={`hottest ${t('skein')}`} wide />
        <Tile value={stats.busiestWeekday ? stats.busiestWeekday.label : '—'} label="busiest day" />
        <Tile value={stats.unwovenPast} label={t('pastDebt')} danger={stats.unwovenPast > 0} wide />
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>{t('threads')} {t('woven')}, by week</h3>
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'var(--color-faint)' }}
                axisLine={{ stroke: 'var(--color-border)' }}
                tickLine={false}
                interval={weeks > 8 ? 1 : 0}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-glow)' }}
                contentStyle={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-2)',
                  borderRadius: 8,
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  color: 'var(--color-ink)',
                }}
                labelStyle={{ color: 'var(--color-muted)' }}
                formatter={(v, _n, p) => [`${v} of ${p.payload.total} woven`, p.payload.label]}
              />
              <Bar dataKey="woven" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.woven >= chartMax ? 'var(--color-accent-hover)' : 'var(--color-accent)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>{t('clothWoven')}</h3>
        <div className={styles.heatmap}>
          <div className={styles.hmHeadRow}>
            <span className={styles.hmWeekLabel} />
            {DOW.map((d, i) => <span key={i} className={styles.hmDow}>{d}</span>)}
          </div>
          {stats.rows.map(row => (
            <div key={row.weekStartKey} className={styles.hmRow}>
              <span className={styles.hmWeekLabel}>{mondayLabel(row.monday)}</span>
              {row.days.map(cell => {
                const intensity = stats.maxWoven ? cell.woven / stats.maxWoven : 0
                const open = cell.total - cell.woven
                return (
                  <span
                    key={cell.key}
                    className={styles.hmCell}
                    style={{ background: cell.woven ? `color-mix(in srgb, var(--color-accent) ${20 + Math.round(intensity * 70)}%, transparent)` : undefined }}
                    title={`${cell.key}: ${cell.woven} woven${open ? `, ${open} open` : ''}`}
                  >
                    {open > 0 && <span className={styles.hmOpen} aria-hidden="true" />}
                  </span>
                )
              })}
            </div>
          ))}
        </div>
        <p className={styles.legend}>
          <span className={styles.legendSwatch} /> {t('woven')} · <span className={`${styles.legendSwatch} ${styles.legendOpen}`} /> {t('stillOpen')}
        </p>
      </div>

      {stats.total === 0 && (
        <p className={styles.empty}>{t('tapestryEmpty')}</p>
      )}
    </div>
  )
}

function Tile({ value, label, wide, danger }) {
  return (
    <div className={`${styles.tile} ${wide ? styles.tileWide : ''} ${danger ? styles.tileDanger : ''}`}>
      <span className={styles.tileValue}>{value}</span>
      <span className={styles.tileLabel}>{label}</span>
    </div>
  )
}
