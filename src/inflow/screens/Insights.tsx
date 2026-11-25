/**
 * Insights: where the money is best (a heat map you can turn any way), and
 * the pain points and wins that stand out. Venue deals: each venue's
 * arrangement read session by session — what it left you, how full a room
 * has to be, the evenings that lost money — with a "fixed or share?" chart
 * to try the other kind of deal against your own numbers.
 */
import { useMemo, useState } from 'react'
import { useInflow, EMPTY_FILTER } from '../app/state'
import { usePeriodData } from '../app/usePeriod'
import { DealChart, HeatMapTable, InsightList } from '../components/insightsUi'
import { NumberInput, SelectInput } from '../components/fields'
import type { Venue } from '../domain/types'
import { DEAL, options } from '../domain/vocabulary'
import { ANY_SCOPE, DIMENSION_NOUN, inScope, NO_ENTITY, type Dimension } from '../lib/analytics'
import { shortDate } from '../lib/dates'
import { crossover, dealCurve, defaultAlternative, venueDeals, type VenueDeal } from '../lib/deals'
import { HEAT_MEASURE_LABEL, heatMap, insights, takeHome, type HeatAxis, type HeatMeasure } from '../lib/insights'
import { lei, percent } from '../lib/money'
import styles from '../styles/ui.module.css'

const FILTER_KEY: Record<Dimension, 'clientId' | 'sourceId' | 'venueId' | 'activity'> = { client: 'clientId', source: 'sourceId', venue: 'venueId', activity: 'activity' }

export function InsightsReport() {
  const { data, today, on, scope: rawScope } = useInflow()
  const scope = on('reportTools') ? rawScope : ANY_SCOPE
  const { range } = usePeriodData()
  const [rows, setRows] = useState<Dimension>('activity')
  const [cols, setCols] = useState<HeatAxis>('venue')
  const kept = on('deals') || on('costs')
  const [measure, setMeasure] = useState<HeatMeasure>(kept ? 'takePerSession' : 'perSession')
  const [all, setAll] = useState(false)
  const { setFilter } = useInflow()
  const scoped = useMemo(() => ({ ...data, records: data.records.filter((r) => inScope(r, scope)) }), [data, scope])
  const take = useMemo(() => takeHome(scoped, { deals: on('deals'), costs: on('costs') }), [scoped, on])
  const effMeasure: HeatMeasure = !kept && (measure === 'take' || measure === 'takePerSession') ? 'perSession' : measure
  const map = useMemo(() => heatMap(scoped, range, rows, cols, effMeasure, take, all ? 30 : 8, all ? 30 : 8), [scoped, range, rows, cols, effMeasure, take, all])
  const list = useMemo(() => insights(scoped, range, today, { deals: on('deals'), costs: on('costs'), expected: on('expected') }), [scoped, range, today, on])
  const axes: Dimension[] = ['activity', 'venue', 'client', 'source']
  const measures = (Object.keys(HEAT_MEASURE_LABEL) as HeatMeasure[]).filter((m) => kept || (m !== 'take' && m !== 'takePerSession'))

  const drill = (rowId: string, colId: string) => {
    const f = { ...EMPTY_FILTER, range: 'period' as const, [FILTER_KEY[rows]]: rowId }
    if (cols !== 'month') Object.assign(f, { [FILTER_KEY[cols]]: colId })
    setFilter(f)
    location.hash = '#/income'
  }

  return (
    <>
      <section className={styles.panel} aria-label="Pain points and wins">
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>What stands out · {range.label}</h2>
          <span className={styles.panelSub}>{list.filter((i) => i.kind === 'pain').length} pain points · {list.filter((i) => i.kind === 'win').length} wins</span>
        </div>
        <InsightList items={list} />
      </section>

      <section className={styles.panel} aria-label="Heat map">
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Where the money is best</h2>
          <button type="button" className={styles.linkButton} onClick={() => setAll((a) => !a)}>{all ? 'Top 8' : 'Show all'}</button>
        </div>
        <div className={styles.scope} style={{ marginBottom: 'var(--space-sm)' }}>
          <label>Rows
            <select value={rows} onChange={(e) => { const v = e.target.value as Dimension; setRows(v); if (cols === v) setCols(v === 'venue' ? 'activity' : 'venue') }}>
              {axes.map((a) => <option key={a} value={a}>{DIMENSION_NOUN[a]}</option>)}
            </select>
          </label>
          <label>Columns
            <select value={cols} onChange={(e) => setCols(e.target.value as HeatAxis)}>
              {axes.filter((a) => a !== rows).map((a) => <option key={a} value={a}>{DIMENSION_NOUN[a]}</option>)}
              <option value="month">Month</option>
            </select>
          </label>
          <label>Measure
            <select value={effMeasure} onChange={(e) => setMeasure(e.target.value as HeatMeasure)}>
              {measures.map((m) => <option key={m} value={m}>{HEAT_MEASURE_LABEL[m]}</option>)}
            </select>
          </label>
        </div>
        <HeatMapTable map={map} rowNoun={DIMENSION_NOUN[rows]} onCell={drill} />
        <p className={styles.hint} style={{ marginTop: 'var(--space-xs)' }}>
          {effMeasure === 'takePerSession' || effMeasure === 'take'
            ? `"Kept" is income less ${[on('deals') && 'the venue deal', on('costs') && 'direct costs linked to the same venue and day'].filter(Boolean).join(' and ')}. `
            : ''}
          Tap a cell to see its payments.
        </p>
      </section>
    </>
  )
}

export function DealsReport() {
  const { data, scope: rawScope, on } = useInflow()
  const scope = on('reportTools') ? rawScope : ANY_SCOPE
  const { range } = usePeriodData()
  const records = useMemo(() => data.records.filter((r) => inScope(r, { ...scope, venueId: '' })), [data.records, scope])
  const deals = useMemo(() => venueDeals(data.venues, records, range).filter((d) => !scope.venueId || scope.venueId === NO_ENTITY || d.venue.id === scope.venueId), [data.venues, records, range, scope.venueId])
  const withDeal = deals.filter((d) => d.venue.deal !== 'none')
  const free = deals.filter((d) => d.venue.deal === 'none')

  if (!deals.length) {
    return (
      <section className={styles.panel}>
        <p className={styles.hint}>No sessions at a venue in this period. Set each venue's deal (fixed fee, revenue share…) in Settings → Clients, sources & venues, and record how many people came on group sessions.</p>
      </section>
    )
  }
  return (
    <>
      {withDeal.map((d) => <DealCard key={d.venue.id} d={d} />)}
      {free.length > 0 && (
        <section className={styles.panel}>
          <div className={styles.panelHead}><h2 className={styles.panelTitle}>No venue cost</h2><span className={styles.panelSub}>online, client sites, paid by an agency</span></div>
          <div className={styles.lineList}>
            {free.map((d) => (
              <div key={d.venue.id} className={styles.line}>
                <span>{d.venue.name} <span className={styles.panelSub}>· {d.sessions.length} {d.sessions.length === 1 ? 'session' : 'sessions'}</span></span>
                <span>{lei(d.revenue)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      <p className={styles.hint}>Read from each venue's deal terms, set in Settings → Clients, sources & venues. Each payment at a venue counts as one session.</p>
    </>
  )
}

function DealCard({ d }: { d: VenueDeal }) {
  const v = d.venue
  const [alt, setAlt] = useState<Pick<Venue, 'deal' | 'feePerSession' | 'sharePct' | 'monthlyFee'>>(() => defaultAlternative(d))
  const [showLosing, setShowLosing] = useState(false)
  const price = d.revenuePerHead
  const maxPeople = Math.max(6, Math.ceil((Math.max(...d.sessions.map((s) => s.attendees ?? 0), d.breakEvenAttendees ?? 0, 0)) * 1.4))
  const points = price ? dealCurve(price, v, alt, maxPeople) : []
  const cross = points.length ? crossover(points) : null
  const termText = (t: Pick<Venue, 'deal' | 'feePerSession' | 'sharePct' | 'monthlyFee'>) =>
    t.deal === 'fixed' ? `${lei(t.feePerSession)} per session`
      : t.deal === 'share' ? `${percent(t.sharePct)} of takings`
        : t.deal === 'hybrid' ? `${lei(t.feePerSession)} + ${percent(t.sharePct)}`
          : t.deal === 'monthly' ? `${lei(t.monthlyFee)} a month` : 'no venue cost'
  const better = (n: number) => {
    const p = points[Math.min(points.length - 1, Math.max(0, Math.round(n)))]
    return p ? p.current - p.alternative : 0
  }
  const atAvg = d.avgAttendees !== null && points.length ? better(d.avgAttendees) : null

  return (
    <section className={styles.panel} aria-label={`Deal at ${v.name}`}>
      <div className={styles.dealHead}>
        <h2 className={styles.panelTitle}>{v.name}</h2>
        <span className={styles.dealTag}>{DEAL[v.deal]} · {termText(v)}</span>
      </div>
      <div className={styles.dealStats}>
        <div><b>{lei(d.takeHome)}</b><span>kept from {lei(d.revenue)}</span></div>
        <div><b>{lei(d.takePerSession)}</b><span>kept per session ({d.sessions.length})</span></div>
        <div><b>{d.avgAttendees ?? '—'}</b><span>people per session{d.revenuePerHead ? ` · ${lei(d.revenuePerHead)} a head` : ''}</span></div>
        <div><b>{d.breakEvenAttendees ?? (d.effectiveShare !== null ? percent(d.effectiveShare) : '—')}</b><span>{d.breakEvenAttendees ? 'people to cover the room' : 'of takings to the venue'}</span></div>
      </div>
      {d.losing.length > 0 && (
        <div className={`${styles.banner}`} style={{ marginBottom: 'var(--space-sm)' }}>
          <span>{d.losing.length} {d.losing.length === 1 ? 'session' : 'sessions'} lost {lei(d.lost)} after the room.</span>
          <button type="button" className={styles.linkButton} onClick={() => setShowLosing((s) => !s)}>{showLosing ? 'Hide' : 'Which'}</button>
        </div>
      )}
      {showLosing && (
        <div className={styles.lineList} style={{ marginBottom: 'var(--space-sm)' }}>
          {d.losing.map((s) => (
            <div key={s.id} className={styles.line}>
              <span>{shortDate(s.date)} · {s.description}{s.attendees !== null ? ` · ${s.attendees} ${s.attendees === 1 ? 'person' : 'people'}` : ''}</span>
              <span className={styles.down}>{lei(s.takeHome)}</span>
            </div>
          ))}
        </div>
      )}
      {price ? (
        <>
          <DealChart points={points} avg={d.avgAttendees} currentLabel={`Now: ${termText(v)}`} altLabel={`What if: ${termText(alt)}`} />
          <div className={styles.whatIf}>
            <SelectInput label="What if the deal were" value={alt.deal} onChange={(x) => setAlt({ ...alt, deal: x as Venue['deal'] })}>
              {options(DEAL).filter((o) => o.value !== 'monthly' && o.value !== 'none').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectInput>
            {alt.deal === 'share'
              ? <NumberInput label="Share (%)" value={alt.sharePct} scale={100} onCommit={(n) => setAlt({ ...alt, sharePct: Math.min(1, n ?? 0) })} />
              : <NumberInput label="Fee per session (lei)" value={alt.feePerSession} onCommit={(n) => setAlt({ ...alt, feePerSession: n ?? 0 })} />}
            {alt.deal === 'hybrid' && <NumberInput label="Plus share (%)" value={alt.sharePct} scale={100} onCommit={(n) => setAlt({ ...alt, sharePct: Math.min(1, n ?? 0) })} />}
          </div>
          <p className={styles.verdict}>
            {cross !== null
              ? <>The two deals leave you the same at about <b>{cross} people</b>. {better(0) < 0
                ? <>Below that the what-if is safer; above it, your current deal pays more.</>
                : <>Below that your current deal is safer; above it, the what-if pays more.</>}</>
              : <>At every turnout up to {maxPeople} people, {better(maxPeople / 2) >= 0 ? 'your current deal' : 'the what-if'} leaves you more.</>}
            {atAvg !== null && d.avgAttendees !== null && <> At your average of {d.avgAttendees}, the current deal is <b className={atAvg >= 0 ? styles.up : styles.down}>{atAvg >= 0 ? `${lei(atAvg)} better` : `${lei(-atAvg)} worse`}</b> per session.</>}
          </p>
        </>
      ) : (
        <p className={styles.hint}>Record how many people came on sessions here to see how full a room has to be, and to compare deals.</p>
      )}
    </section>
  )
}
