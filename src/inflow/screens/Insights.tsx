/**
 * Review: the period in review — a headline, the main movers, who carries
 * the income, then the pain points and wins and a grid of which work pays
 * best where. Venue deals live in VenueDeals.tsx.
 */
import { useEffect, useMemo, useState } from 'react'
import { Copy, Grid3x3, TrendingDown, TrendingUp } from 'lucide-react'
import { useInflow, EMPTY_FILTER } from '../app/state'
import { usePeriodData } from '../app/usePeriod'
import { HeatMapTable, InsightList } from '../components/insightsUi'
import { MoversChart } from '../components/charts'
import { Donut } from '../components/Donut'
import { leaveTrail } from '../app/trail'
import { buildPnl, monthColumns } from '../lib/finance'
import { movers, reviewSummary, reviewTitle, shakers } from '../lib/review'
import { ANY_SCOPE, DIMENSION_NOUN, inScope, NO_ENTITY, sum, type Dimension, type Scope } from '../lib/analytics'
import type { CostRecord, FeatureKey } from '../domain/types'
import { HEAT_MEASURE_LABEL, heatMap, insights, takeHome, type HeatAxis, type HeatMeasure } from '../lib/insights'
import { compact, delta, lei } from '../lib/money'
import styles from '../styles/ui.module.css'

/** A cost in scope (Reports' rule, kept here to avoid an import cycle). */
function costInScopeLite(c: CostRecord, s: Scope): boolean {
  if (s.sourceId) return false
  const m = (field: string | null, want: string) => !want || (want === NO_ENTITY ? !field : field === want)
  return m(c.clientId, s.clientId) && m(c.venueId, s.venueId) && m(c.activity, s.activity)
}

const FILTER_KEY: Record<Dimension, 'clientId' | 'sourceId' | 'venueId' | 'activity'> = { client: 'clientId', source: 'sourceId', venue: 'venueId', activity: 'activity' }

export interface IndexItem { id: string; label: string; needs?: FeatureKey }

/** The Review's sections, in order: the index under the report tabs follows them. */
export const REVIEW_SECTIONS: IndexItem[] = [
  { id: 'review-summary', label: 'Summary' },
  { id: 'review-movers', label: 'Movers' },
  { id: 'review-shakers', label: 'Who pays' },
  { id: 'review-act', label: 'Pain points', needs: 'insights' },
  { id: 'review-heat', label: 'Work × place', needs: 'insights' },
]

/**
 * Where you are on a long report: one chip per section, the one in view lit,
 * a tap scrolls there. The Long Listen's running order, as a strip.
 */
export function SectionIndex({ items: all = REVIEW_SECTIONS }: { items?: IndexItem[] }) {
  const { on } = useInflow()
  const items = all.filter((x) => !x.needs || on(x.needs))
  const [active, setActive] = useState(items[0].id)
  const key = items.map((x) => x.id).join()
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const seen = new Map<string, boolean>()
    const ids = key.split(',')
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting)
      const first = ids.find((id) => seen.get(id))
      if (first) setActive(first)
    }, { rootMargin: '-35% 0px -55% 0px' })
    const t = setTimeout(() => ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el) }), 50)
    return () => { clearTimeout(t); io.disconnect() }
  }, [key])
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
        <p className={`${styles.reviewLede} ${styles.dropCap}`}>{summary}</p>
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
        <Donut key={dim} parts={parts} caption={range.label.toLowerCase()} label={`Income by ${DIMENSION_NOUN[dim].toLowerCase()}`} onSelect={(id) => open({ [FILTER_KEY[dim]]: id })} />
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

/** Ready-made questions for the grid; "Customise" holds the rest. */
const HEAT_QUESTIONS: { id: string; label: string; rows: Dimension; cols: HeatAxis }[] = [
  { id: 'work-place', label: 'Which work pays best where', rows: 'activity', cols: 'venue' },
  { id: 'client-month', label: 'Who pays, month by month', rows: 'client', cols: 'month' },
  { id: 'work-month', label: 'Which work, when', rows: 'activity', cols: 'month' },
  { id: 'place-month', label: 'Which room, when', rows: 'venue', cols: 'month' },
]

const MEASURE_PHRASE: Record<HeatMeasure, string> = {
  income: 'all the income',
  perSession: 'what one session brought in',
  take: 'all you kept after the room and direct costs',
  takePerSession: 'what one session left you after the room and direct costs',
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
  const colNoun = cols === 'month' ? 'month' : DIMENSION_NOUN[cols].toLowerCase()
  const rowNoun = DIMENSION_NOUN[rows].toLowerCase()
  const thin = map.rows.length < 2 || map.cols.length < 2
  const question = HEAT_QUESTIONS.find((q) => q.rows === rows && q.cols === cols)

  // The squares worth naming: best and weakest, with at least two sessions behind them where there are enough.
  const cells = map.rows.flatMap((r, i) => map.cols.map((c, j) => ({ r, c, cell: map.cells[i][j] })))
    .filter((x): x is { r: typeof x.r; c: typeof x.c; cell: NonNullable<typeof x.cell> } => !!x.cell)
  const solid = cells.filter((x) => x.cell.count >= 2).length >= 4 ? cells.filter((x) => x.cell.count >= 2) : cells
  const ranked = [...solid].sort((a, b) => b.cell.value - a.cell.value)
  const best = ranked.slice(0, 3)
  const worst = ranked.length > 4 ? ranked.slice(-3).reverse() : []
  const perUnit = effMeasure === 'perSession' || effMeasure === 'takePerSession' ? ' a session' : ''
  const where = (x: (typeof cells)[number]) => cols === 'month' ? `${x.r.name} in ${x.c.name}` : `${x.r.name} at ${x.c.name}`

  return (
    <section id="review-heat" className={`${styles.panel} ${styles.anchored}`} aria-label="Heat map">
      <div className={styles.eyebrow}>Explore</div>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}><Grid3x3 size={14} aria-hidden /> Which work pays best, and where</h2>
        <button type="button" className={styles.linkButton} onClick={() => setAll((x) => !x)}>{all ? 'Top 8' : 'Show all'}</button>
      </div>
      <p className={styles.hint} style={{ marginTop: 0 }}>
        A grid of everything you do against everywhere (or whenever) you do it. Each square is <b>{MEASURE_PHRASE[effMeasure]}</b>, for one {rowNoun} at one {colNoun}. Deeper green is better; amber lost money; a dot means you haven't done it there. Do more of the deep squares, and rethink the pale and amber ones.
      </p>
      <div className={styles.chips} role="group" aria-label="Question">
        {HEAT_QUESTIONS.map((q) => (
          <button key={q.id} type="button" className={`${styles.chip} ${question?.id === q.id ? styles.chipOn : ''}`}
            onClick={() => { setRows(q.rows); setCols(q.cols) }}>{q.label}</button>
        ))}
      </div>
      <details className={`${styles.featureMore}`} style={{ margin: 'var(--space-xs) 0 var(--space-sm)' }}>
        <summary><span className={styles.twistyArrow} aria-hidden>▶</span>Customise the grid</summary>
        <div className={styles.scope} style={{ marginTop: 'var(--space-xs)' }}>
          <label>Down the side
            <select value={rows} onChange={(e) => { const v = e.target.value as Dimension; setRows(v); if (cols === v) setCols(v === 'venue' ? 'activity' : 'venue') }}>
              {axes.map((x) => <option key={x} value={x}>{DIMENSION_NOUN[x]}</option>)}
            </select>
          </label>
          <label>Across the top
            <select value={cols} onChange={(e) => setCols(e.target.value as HeatAxis)}>
              {axes.filter((x) => x !== rows).map((x) => <option key={x} value={x}>{DIMENSION_NOUN[x]}</option>)}
              <option value="month">Month</option>
            </select>
          </label>
          <label>Each square shows
            <select value={effMeasure} onChange={(e) => setMeasure(e.target.value as HeatMeasure)}>
              {measures.map((m) => <option key={m} value={m}>{HEAT_MEASURE_LABEL[m]}</option>)}
            </select>
          </label>
        </div>
      </details>
      {thin ? (
        <div className={styles.heatThin}>
          <Grid3x3 size={22} aria-hidden />
          <p>
            {map.rows.length === 0 ? 'Nothing to map in this period.'
              : `Too little to compare in this period: ${map.rows.length} ${rowNoun}${map.rows.length === 1 ? '' : 's'} at ${map.cols.length} ${colNoun}${map.cols.length === 1 ? '' : 's'}. The grid needs at least two of each.`}
          </p>
          <WiderPeriod what="" />
        </div>
      ) : <HeatMapTable map={map} rowNoun={DIMENSION_NOUN[rows]} onCell={drill} />}
      {!thin && best.length > 0 && (
        <div className={styles.heatCalls}>
          <div>
            <div className={styles.heatCallHead}><TrendingUp size={14} aria-hidden /> Strongest</div>
            {best.map((x) => (
              <button key={`${x.r.id}-${x.c.id}`} type="button" className={styles.heatCall} onClick={() => drill(x.r.id, x.c.id)}>
                <span>{where(x)}</span><b>{lei(x.cell.value)}{perUnit}</b><em>{x.cell.count} {x.cell.count === 1 ? 'session' : 'sessions'}</em>
              </button>
            ))}
          </div>
          {worst.length > 0 && (
            <div>
              <div className={styles.heatCallHead}><TrendingDown size={14} aria-hidden /> Weakest</div>
              {worst.map((x) => (
                <button key={`${x.r.id}-${x.c.id}`} type="button" className={styles.heatCall} onClick={() => drill(x.r.id, x.c.id)}>
                  <span>{where(x)}</span><b className={x.cell.value < 0 ? styles.down : undefined}>{lei(x.cell.value)}{perUnit}</b><em>{x.cell.count} {x.cell.count === 1 ? 'session' : 'sessions'}</em>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <p className={styles.hint} style={{ marginBottom: 0 }}>
        {effMeasure === 'takePerSession' || effMeasure === 'take'
          ? `"Kept" is income less ${[on('deals') && "the venue's deal", on('costs') && 'direct costs linked to the same venue and day'].filter(Boolean).join(' and ')}. `
          : ''}
        Tap a square or a line to see its payments.
      </p>
    </section>
  )
}

/** A short period holds too few sessions to judge a venue: offer the year. */
export function WiderPeriod({ what }: { what: string }) {
  const { period, setPeriod } = useInflow()
  if (period.preset === 'year') return null
  return (
    <p className={styles.hint} style={{ margin: 0 }}>
      {what} <button type="button" className={styles.linkButton} onClick={() => setPeriod({ preset: 'year' })}>See the whole year</button>
    </p>
  )
}
