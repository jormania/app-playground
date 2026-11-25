/**
 * Review: the period in review — a headline, the main movers, who carries
 * the income, then the pain points and wins and a heat map of where the
 * money is best. Venue deals: each venue's
 * arrangement read session by session — what it left you, how full a room
 * has to be, the evenings that lost money — with a "fixed or share?" chart
 * to try the other kind of deal against your own numbers.
 */
import { useEffect, useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import { useInflow, EMPTY_FILTER } from '../app/state'
import { usePeriodData } from '../app/usePeriod'
import { DealChart, HeatMapTable, InsightList } from '../components/insightsUi'
import { MoversChart, ShareBar } from '../components/charts'
import { leaveTrail } from '../app/trail'
import { buildPnl, monthColumns } from '../lib/finance'
import { movers, reviewSummary, reviewTitle, shakers } from '../lib/review'
import { NumberInput, SelectInput } from '../components/fields'
import type { Venue } from '../domain/types'
import { DEAL, options } from '../domain/vocabulary'
import { ANY_SCOPE, DIMENSION_NOUN, inScope, NO_ENTITY, sum, type Dimension, type Scope } from '../lib/analytics'
import type { CostRecord } from '../domain/types'
import { shortDate } from '../lib/dates'
import { crossover, dealCurve, defaultAlternative, venueDeals, type VenueDeal } from '../lib/deals'
import { HEAT_MEASURE_LABEL, heatMap, insights, takeHome, type HeatAxis, type HeatMeasure } from '../lib/insights'
import { compact, delta, lei, percent } from '../lib/money'
import styles from '../styles/ui.module.css'

/** A cost in scope (Reports' rule, kept here to avoid an import cycle). */
function costInScopeLite(c: CostRecord, s: Scope): boolean {
  if (s.sourceId) return false
  const m = (field: string | null, want: string) => !want || (want === NO_ENTITY ? !field : field === want)
  return m(c.clientId, s.clientId) && m(c.venueId, s.venueId) && m(c.activity, s.activity)
}

const FILTER_KEY: Record<Dimension, 'clientId' | 'sourceId' | 'venueId' | 'activity'> = { client: 'clientId', source: 'sourceId', venue: 'venueId', activity: 'activity' }

/** The Review's sections, in order: the index under the report tabs follows them. */
const REVIEW_SECTIONS = [
  { id: 'review-summary', label: 'Summary' },
  { id: 'review-movers', label: 'Movers' },
  { id: 'review-shakers', label: 'Who pays' },
  { id: 'review-act', label: 'Pain points', needs: 'insights' as const },
  { id: 'review-heat', label: 'Heat map', needs: 'insights' as const },
]

/**
 * Where you are on the Review: one chip per section, the one in view lit,
 * a tap scrolls there. The Long Listen's running order, as a strip.
 */
export function SectionIndex() {
  const { on } = useInflow()
  const items = REVIEW_SECTIONS.filter((x) => !x.needs || on(x.needs))
  const [active, setActive] = useState(items[0].id)
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const seen = new Map<string, boolean>()
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting)
      const first = items.find((x) => seen.get(x.id))
      if (first) setActive(first.id)
    }, { rootMargin: '-35% 0px -55% 0px' })
    const t = setTimeout(() => items.forEach((x) => { const el = document.getElementById(x.id); if (el) io.observe(el) }), 50)
    return () => { clearTimeout(t); io.disconnect() }
  }, [items.length]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={styles.subTabs} role="list" aria-label="On this page">
      {items.map((x) => (
        <button key={x.id} type="button" role="listitem" className={styles.subTab} aria-current={active === x.id ? 'true' : undefined}
          onClick={() => { setActive(x.id); document.getElementById(x.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>
          {x.label}
        </button>
      ))}
    </div>
  )
}

/**
 * The period in review, WhereItWent's order: the headline (Understand), what
 * moved and who carries the income, then what to act on and where to dig.
 */
export function ReviewReport() {
  const { data, today, on, scope: rawScope, setFilter, toast } = useInflow()
  const scope = on('reportTools') ? rawScope : ANY_SCOPE
  const { range, prev, cur, before } = usePeriodData()
  const curS = useMemo(() => cur.filter((r) => inScope(r, scope)), [cur, scope])
  const beforeS = useMemo(() => before.filter((r) => inScope(r, scope)), [before, scope])
  const scoped = useMemo(() => ({ ...data, records: data.records.filter((r) => inScope(r, scope)) }), [data, scope])
  const list = useMemo(() => (on('insights') ? insights(scoped, range, today, { deals: on('deals'), costs: on('costs'), expected: on('expected') }) : []), [scoped, range, today, on])
  const kept = useMemo(() => {
    if (!on('costs')) return null
    const pnl = buildPnl(scoped.records, data.costs.filter((c) => costInScopeLite(c, scope)), monthColumns(range))
    return pnl.lines.find((l) => l.key === 'net')!.total
  }, [on, scoped.records, data.costs, scope, range])
  const total = sum(curS)
  const prevTotal = sum(beforeS)
  const d = delta(total, prevTotal)
  const firstRecord = useMemo(() => data.records.reduce((m, r) => (r.status === 'received' && r.date < m ? r.date : m), '9999'), [data.records])
  const summary = reviewSummary({ data, cur: curS, before: beforeS, prevLabel: prev.label, kept, insights: list, periodLabel: range.label, prevFrom: prev.from, firstRecord })
  const moved = useMemo(() => movers(data, curS, beforeS), [data, curS, beforeS])
  const [dim, setDim] = useState<Dimension>('client')
  const parts = useMemo(() => shakers(data, curS, beforeS, dim).map((r) => ({ id: r.id, name: r.name, value: r.total })), [data, curS, beforeS, dim])
  const pains = list.filter((i) => i.kind === 'pain').length
  const wins = list.filter((i) => i.kind === 'win').length

  const open = (patch: Record<string, string>) => {
    setFilter({ ...EMPTY_FILTER, range: 'period', ...patch })
    leaveTrail('Review')
    location.hash = '#/income'
  }
  const copy = () => {
    const text = `${reviewTitle(range)}\n\n${summary}`
    void navigator.clipboard?.writeText(text).then(() => toast({ message: 'Summary copied', tone: 'success' }), () => toast('Could not copy'))
  }

  return (
    <>
      <section id="review-summary" className={`${styles.panel} ${styles.reviewHero} ${styles.anchored}`} aria-label="Summary">
        <div className={styles.eyebrow}>Understand</div>
        <h2 className={styles.reviewTitle}>{reviewTitle(range)}</h2>
        <p className={styles.reviewLede}>{summary}</p>
        <div className={styles.kpis}>
          <div><span className={styles.statLabel}>Came in</span><b>{lei(total)}</b></div>
          <div><span className={styles.statLabel}>vs {prev.label}</span><b className={d.direction === 'up' || d.direction === 'new' ? styles.up : d.direction === 'down' ? styles.down : undefined}>{d.text}</b></div>
          {kept !== null && <div><span className={styles.statLabel}>Kept</span><b className={kept < 0 ? styles.down : undefined}>{lei(kept)}</b></div>}
          <div><span className={styles.statLabel}>Payments</span><b>{curS.length}</b></div>
        </div>
        <button type="button" className={styles.linkButton} onClick={copy}><Copy size={12} aria-hidden /> Copy summary</button>
      </section>

      <section id="review-movers" className={`${styles.panel} ${styles.anchored}`} aria-label="Main movers">
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Main movers</h2>
          <span className={styles.panelSub}>vs {prev.label}</span>
        </div>
        <MoversChart prevLabel={prev.label}
          rows={moved.map((m) => ({ key: `${m.dim}:${m.id}`, name: m.name, tag: `${DIMENSION_NOUN[m.dim]} · ${compact(m.previous)} → ${compact(m.current)}`, change: m.change, current: m.current, previous: m.previous }))}
          onSelect={(k) => { const [dm, id] = k.split(':'); open({ [FILTER_KEY[dm as Dimension]]: id }) }} />
      </section>

      <section id="review-shakers" className={`${styles.panel} ${styles.anchored}`} aria-label="Who carries the income">
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Who carries the income</h2>
          <select className={styles.inlineSelect} value={dim} onChange={(e) => setDim(e.target.value as Dimension)} aria-label="Split by">
            {(['client', 'venue', 'activity', 'source'] as Dimension[]).map((x) => <option key={x} value={x}>by {DIMENSION_NOUN[x].toLowerCase()}</option>)}
          </select>
        </div>
        <ShareBar parts={parts} label={`Income by ${DIMENSION_NOUN[dim].toLowerCase()}`} onSelect={(id) => open({ [FILTER_KEY[dim]]: id })} />
      </section>

      {on('insights') && (
        <section id="review-act" className={`${styles.panel} ${styles.anchored}`} aria-label="Pain points and wins">
          <div className={styles.eyebrow}>Act</div>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Pain points and wins</h2>
            <span className={styles.panelSub}>{pains} to look at · {wins} going well</span>
          </div>
          <InsightList items={list} />
        </section>
      )}

      {on('insights') && <HeatSection />}
    </>
  )
}

function HeatSection() {
  const { data, on, scope: rawScope, setFilter } = useInflow()
  const scope = on('reportTools') ? rawScope : ANY_SCOPE
  const { range } = usePeriodData()
  const [rows, setRows] = useState<Dimension>('activity')
  const [cols, setCols] = useState<HeatAxis>('venue')
  const kept = on('deals') || on('costs')
  const [measure, setMeasure] = useState<HeatMeasure>(kept ? 'takePerSession' : 'perSession')
  const [all, setAll] = useState(false)
  const scoped = useMemo(() => ({ ...data, records: data.records.filter((r) => inScope(r, scope)) }), [data, scope])
  const take = useMemo(() => takeHome(scoped, { deals: on('deals'), costs: on('costs') }), [scoped, on])
  const effMeasure: HeatMeasure = !kept && (measure === 'take' || measure === 'takePerSession') ? 'perSession' : measure
  const map = useMemo(() => heatMap(scoped, range, rows, cols, effMeasure, take, all ? 30 : 8, all ? 30 : 8), [scoped, range, rows, cols, effMeasure, take, all])
  const axes: Dimension[] = ['activity', 'venue', 'client', 'source']
  const measures = (Object.keys(HEAT_MEASURE_LABEL) as HeatMeasure[]).filter((m) => kept || (m !== 'take' && m !== 'takePerSession'))
  const drill = (rowId: string, colId: string) => {
    const f = { ...EMPTY_FILTER, range: 'period' as const, [FILTER_KEY[rows]]: rowId }
    if (cols !== 'month') Object.assign(f, { [FILTER_KEY[cols]]: colId })
    setFilter(f)
    leaveTrail('Review')
    location.hash = '#/income'
  }
  return (
      <section id="review-heat" className={`${styles.panel} ${styles.anchored}`} aria-label="Heat map">
        <div className={styles.panelHead}>
          <div>
            <div className={styles.eyebrow}>Explore</div>
            <h2 className={styles.panelTitle}>Where the money is best</h2>
          </div>
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
