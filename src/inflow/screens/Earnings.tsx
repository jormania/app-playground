/**
 * Clients & work: which clients and types of work earn you the most.
 *
 * A summary (income, costs, kept) for the selected period, one toggle
 * (client or work type), and a list ranked by what you kept. Each row shows
 * the total kept and the sessions behind it, the average a session, and a
 * bar splitting the income into costs and kept; tap it for the breakdown,
 * the range from lowest to highest session and the venues involved.
 */
import { useMemo, useState } from 'react'
import { SegmentedControl } from '../../ds'
import { readJson, writeJson } from '../../shared/storage'
import { useInflow } from '../app/state'
import { usePeriodData } from '../app/usePeriod'
import { ANY_SCOPE, inScope } from '../lib/analytics'
import { earnings, type EarningsBy, type EarningsRow } from '../lib/earnings'
import { lei } from '../lib/money'
import { WiderPeriod } from './Insights'
import styles from '../styles/ui.module.css'

const KEY = 'inflow:earnings-by'
const SHOWN = 10

export function EarningsReport() {
  const { data, on, scope: rawScope } = useInflow()
  const scope = on('reportTools') ? rawScope : ANY_SCOPE
  const { range } = usePeriodData()
  const [by, setBy] = useState<EarningsBy>(() => readJson<EarningsBy>(KEY, 'client'))
  const [all, setAll] = useState(false)
  const scoped = useMemo(() => ({ ...data, records: data.records.filter((r) => inScope(r, scope)) }), [data, scope])
  const e = useMemo(() => earnings(scoped, range, by, { deals: on('deals'), costs: on('costs') }), [scoped, range, by, on])
  const maxIncome = Math.max(1, ...e.rows.map((r) => r.income))
  const rows = all ? e.rows : e.rows.slice(0, SHOWN)

  return (
    <>
      <section className={styles.panel} aria-label="Earnings in total">
        <div className={styles.earnTotals}>
          <div><span className={styles.earnLabel}><i className={styles.keyIncome} />Income</span><b>{lei(e.totals.income)}</b></div>
          <div><span className={styles.earnLabel}><i className={styles.keyCosts} />Costs</span><b>{lei(e.totals.costs)}</b></div>
          <div><span className={styles.earnLabel}><i className={styles.keyKept} />You kept</span><b className={styles.earnKept}>{lei(e.totals.kept)}</b></div>
        </div>
        <p className={styles.hint} style={{ margin: 'var(--space-xs) 0 0' }}>{e.totals.sessions} {e.totals.sessions === 1 ? 'session' : 'sessions'} · {range.label}</p>
      </section>

      <SegmentedControl label="Show" value={by} onChange={(v) => { setBy(v as EarningsBy); writeJson(KEY, v) }}
        options={[{ value: 'client', label: 'By client' }, { value: 'activity', label: 'By work type' }]} />

      {e.rows.length === 0 ? (
        <section className={styles.panel}>
          <p className={styles.emptyNote}>Nothing received in this period.</p>
          <div style={{ textAlign: 'center' }}><WiderPeriod what="" /></div>
        </section>
      ) : (
        <section className={styles.panel} aria-label={by === 'client' ? 'Clients, most kept first' : 'Work types, most kept first'}>
          <ol className={styles.earnList}>
            {rows.map((r, i) => <EarnRow key={r.id} r={r} rank={i + 1} maxIncome={maxIncome} />)}
          </ol>
          {e.rows.length > SHOWN && (
            <button type="button" className={styles.earnMore} onClick={() => setAll((a) => !a)}>
              {all ? `Show the top ${SHOWN}` : `Show all ${e.rows.length}`}
            </button>
          )}
        </section>
      )}
    </>
  )
}

function EarnRow({ r, rank, maxIncome }: { r: EarningsRow; rank: number; maxIncome: number }) {
  const costs = r.venueFees + r.directCosts
  const keptW = r.income > 0 ? (Math.max(0, r.kept) / maxIncome) * 100 : 0
  const costW = r.income > 0 ? (Math.min(costs, r.income) / maxIncome) * 100 : 0
  return (
    <li className={styles.earnItem}>
      <details>
        <summary className={styles.earnSummary}>
          <span className={styles.earnRank}>{rank}</span>
          <span className={styles.earnName}>{r.name}</span>
          <b className={`${styles.earnValue} ${r.kept < 0 ? styles.down : styles.earnKept}`}>{lei(r.kept)}</b>
          <span className={styles.earnMeta}>{r.sessions} {r.sessions === 1 ? 'session' : 'sessions'} · {lei(r.keptPerSession)} a session</span>
          <span className={styles.earnBar} aria-hidden>
            <span className={styles.earnBarKept} style={{ width: `${keptW}%` }} />
            <span className={styles.earnBarCosts} style={{ width: `${costW}%` }} />
          </span>
        </summary>
        <div className={styles.earnDetail}>
          <dl className={styles.earnFigures}>
            <div><dt><i className={styles.keyIncome} />Income</dt><dd>{lei(r.income)}</dd></div>
            <div><dt><i className={styles.keyCosts} />Venue fees</dt><dd>{r.venueFees ? `− ${lei(r.venueFees)}` : '–'}</dd></div>
            <div><dt><i className={styles.keyCosts} />Direct costs</dt><dd>{r.directCosts ? `− ${lei(r.directCosts)}` : '–'}</dd></div>
            <div className={styles.earnFigureKept}><dt><i className={styles.keyKept} />You kept</dt><dd>{lei(r.kept)}</dd></div>
          </dl>
          <p className={styles.earnLine}>
            {lei(r.keptPerSession)} a session on average
            {r.sessions > 1 && Math.round(r.lowest) !== Math.round(r.highest) && <> · from {lei(r.lowest)} to {lei(r.highest)}</>}
          </p>
          {r.venues.length > 0 && !(r.venues.length === 1 && r.venues[0].id.startsWith('__')) && (
            <ul className={styles.earnVenues}>
              {r.venues.map((v) => (
                <li key={v.id}>
                  <span>{v.name}</span>
                  <span>{v.sessions} × · {lei(v.kept)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </li>
  )
}
