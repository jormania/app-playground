/**
 * Review: the period in review — a headline, the main movers, who carries
 * the income, then the pain points and wins and a heat map of where the
 * money is best. Venue deals: each venue's
 * arrangement read session by session — what it left you, how full a room
 * has to be, the evenings that lost money — with a "fixed or share?" chart
 * to try the other kind of deal against your own numbers.
 */
import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Copy, DoorOpen, Grid3x3, Scale, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { useInflow, EMPTY_FILTER } from '../app/state'
import { usePeriodData } from '../app/usePeriod'
import { DealChart, HeatMapTable, InsightList, SeatStrip, SessionBars, VerdictBoard, VerdictPill } from '../components/insightsUi'
import { MoversChart } from '../components/charts'
import { Donut } from '../components/Donut'
import { leaveTrail } from '../app/trail'
import { buildPnl, monthColumns } from '../lib/finance'
import { movers, reviewSummary, reviewTitle, shakers } from '../lib/review'
import { NumberInput, SelectInput } from '../components/fields'
import type { Venue } from '../domain/types'
import { DEAL, options } from '../domain/vocabulary'
import { ANY_SCOPE, DIMENSION_NOUN, inScope, NO_ENTITY, sum, type Dimension, type Scope } from '../lib/analytics'
import type { CostRecord, FeatureKey } from '../domain/types'
import { shortDate } from '../lib/dates'
import { crossover, dealCurve, dealTypes, defaultAlternative, people, venueDeals, verdict, type VenueDeal } from '../lib/deals'
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

export interface IndexItem { id: string; label: string; needs?: FeatureKey }

/** The Review's sections, in order: the index under the report tabs follows them. */
export const REVIEW_SECTIONS: IndexItem[] = [
  { id: 'review-summary', label: 'Summary' },
  { id: 'review-movers', label: 'Movers' },
  { id: 'review-shakers', label: 'Who pays' },
  { id: 'review-act', label: 'Pain points', needs: 'insights' },
  { id: 'review-heat', label: 'Work × place', needs: 'insights' },
]

export const DEAL_SECTIONS: IndexItem[] = [
  { id: 'deals-verdict', label: 'Keep or rethink' },
  { id: 'deals-breakeven', label: 'Break-even' },
  { id: 'deals-sessions', label: 'Every session' },
  { id: 'deals-types', label: 'Fixed or share' },
  { id: 'deals-venues', label: 'Venue by venue' },
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

type Terms = Pick<Venue, 'deal' | 'feePerSession' | 'sharePct' | 'monthlyFee'>

function termText(t: Terms): string {
  return t.deal === 'fixed' ? `${lei(t.feePerSession)} a session`
    : t.deal === 'share' ? `${percent(t.sharePct)} of takings`
      : t.deal === 'hybrid' ? `${lei(t.feePerSession)} + ${percent(t.sharePct)}`
        : t.deal === 'monthly' ? `${lei(t.monthlyFee)} a month` : 'no venue cost'
}

/** A short period holds too few sessions to judge a venue: offer the year. */
function WiderPeriod({ what }: { what: string }) {
  const { period, setPeriod } = useInflow()
  if (period.preset === 'year') return null
  return (
    <p className={styles.hint} style={{ margin: 0 }}>
      {what} <button type="button" className={styles.linkButton} onClick={() => setPeriod({ preset: 'year' })}>See the whole year</button>
    </p>
  )
}

const DEAL_ADVICE: Record<Venue['deal'], string> = {
  fixed: 'You carry the risk: an empty evening still costs the fee, a full one is mostly yours. Worth it once turnout reliably clears the break-even with room to spare.',
  share: 'The venue carries the risk with you: it never costs more than it earns, but a full room pays the venue more too. The safer deal while you build an audience.',
  hybrid: 'A smaller fee plus a share: some risk, some upside, for both of you.',
  monthly: 'Rent you pay whatever happens: cheap per session when you use the room often, expensive when you don\'t.',
  none: 'Online, a client\'s office, or a venue that pays you: nothing to cover.',
}

/**
 * Venue deals, laid out to answer one question — which rooms to keep and
 * which to rethink — in five parts: the verdicts, how full each room must
 * be, every session after the room, the kinds of deal side by side, and
 * each venue in detail with a "what if" deal.
 */
export function DealsReport() {
  const { data, scope: rawScope, on } = useInflow()
  const scope = on('reportTools') ? rawScope : ANY_SCOPE
  const { range } = usePeriodData()
  const records = useMemo(() => data.records.filter((r) => inScope(r, { ...scope, venueId: '' })), [data.records, scope])
  const deals = useMemo(() => venueDeals(data.venues, records, range).filter((d) => !scope.venueId || scope.venueId === NO_ENTITY || d.venue.id === scope.venueId), [data.venues, records, range, scope.venueId])
  const withDeal = useMemo(() => deals.filter((d) => d.venue.deal !== 'none').sort((a, b) => b.takePerSession - a.takePerSession), [deals])
  const free = deals.filter((d) => d.venue.deal === 'none')
  const [open, setOpen] = useState<string | null>(null)

  if (!deals.length) {
    return (
      <section className={styles.panel}>
        <p className={styles.empty} style={{ padding: 'var(--space-lg) 0' }}>No sessions at a venue in this period.</p>
        <p className={styles.hint}>Set each venue's deal (fixed fee, revenue share…) in Settings → Clients, sources & venues, and record how many people came on group sessions.</p>
        <WiderPeriod what="A longer period may have some." />
      </section>
    )
  }
  const few = withDeal.every((d) => d.sessions.length < 3)
  const fixed = withDeal.filter((d) => d.breakEvenAttendees && d.breakEvenAttendees > 0)
  const shared = withDeal.filter((d) => d.venue.deal === 'share')
  const scale = Math.max(1, ...withDeal.flatMap((d) => d.sessions.map((x) => Math.abs(x.takeHome))))
  const types = dealTypes(withDeal)
  const maxType = Math.max(1, ...types.map((t) => Math.abs(t.takePerSession)))
  const jump = (id: string) => { setOpen(id); setTimeout(() => document.getElementById(`venue-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30) }
  const counts = withDeal.reduce((m, d) => { const l = verdict(d).level; m[l] = (m[l] ?? 0) + 1; return m }, {} as Record<string, number>)

  return (
    <>
      <section id="deals-verdict" className={`${styles.panel} ${styles.anchored}`} aria-label="Keep, watch or rethink">
        <div className={styles.eyebrow}>Decide</div>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}><DoorOpen size={14} aria-hidden /> Keep, watch or rethink</h2>
          <span className={styles.panelSub}>{[counts.keep && `${counts.keep} keep`, counts.watch && `${counts.watch} watch`, counts.rethink && `${counts.rethink} rethink`].filter(Boolean).join(' · ')}</span>
        </div>
        <p className={styles.hint} style={{ marginTop: 0 }}>Every room on one scale: what a session there leaves you after the venue's cut, best first. Tap one for the detail.</p>
        {withDeal.length ? (
          <VerdictBoard onSelect={jump} rows={withDeal.map((d) => ({ id: d.venue.id, name: d.venue.name, deal: `${DEAL[d.venue.deal]} ${termText(d.venue)}`, takePerSession: d.takePerSession, sessions: d.sessions.length, verdict: verdict(d) }))} />
        ) : <p className={styles.hint}>None of the venues used in this period has a deal set.</p>}
        {few && <WiderPeriod what="Fewer than three sessions per venue in this period: too early to judge." />}
      </section>

      <section id="deals-breakeven" className={`${styles.panel} ${styles.anchored}`} aria-label="How full each room must be">
        <div className={styles.eyebrow}>Understand</div>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}><Users size={14} aria-hidden /> How full each room must be</h2>
        </div>
        <p className={styles.hint} style={{ marginTop: 0 }}>
          One seat per person. <span className={styles.seatKeyRoom} /> seats pay the room; <span className={styles.seatKeyYours} /> seats are yours. ▲ marks your usual turnout.
        </p>
        {fixed.length === 0 && <p className={styles.hint}>No fixed-fee rooms with head counts in this period.</p>}
        <div className={styles.breakList}>
          {fixed.map((d) => {
            const most = Math.max(0, ...d.sessions.map((x) => x.attendees ?? 0))
            const cushion = d.avgAttendees !== null ? Math.round((d.avgAttendees - d.breakEvenAttendees!) * 10) / 10 : null
            return (
              <div key={d.venue.id} className={styles.breakRow}>
                <div className={styles.breakHead}>
                  <b>{d.venue.name}</b>
                  <span className={styles.panelSub}>{termText(d.venue)} · {d.revenuePerHead ? `${lei(d.revenuePerHead)} a head` : ''}</span>
                </div>
                {d.breakEvenAttendees === 1
                  ? <p className={styles.hint} style={{ margin: 0 }}>One person already covers the room: at {lei(d.revenuePerHead ?? 0)} a head, the {lei(d.venue.feePerSession)} fee is never at risk.</p>
                  : <>
                    <SeatStrip breakEven={d.breakEvenAttendees!} avg={d.avgAttendees} most={most} />
                    <p className={styles.breakText}>
                      Needs <b>{people(d.breakEvenAttendees!)}</b> to cover the room.
                      {cushion !== null && (cushion >= 0
                        ? <> You average {d.avgAttendees}: <b className={cushion < d.breakEvenAttendees! * 0.3 ? styles.down : styles.up}>{cushion} {cushion === 1 ? 'person' : 'people'} of cushion</b>.</>
                        : <> You average {d.avgAttendees}: <b className={styles.down}>short by {-cushion}</b>.</>)}
                      {d.losing.length > 0 && <> {d.losing.length} of {d.sessions.length} sessions fell short.</>}
                    </p>
                  </>}
              </div>
            )
          })}
          {shared.map((d) => (
            <div key={d.venue.id} className={styles.breakRow}>
              <div className={styles.breakHead}><b>{d.venue.name}</b><span className={styles.panelSub}>{termText(d.venue)}</span></div>
              <p className={styles.hint} style={{ margin: 0 }}>No break-even: the venue takes {percent(d.venue.sharePct)} of whatever comes in, so a quiet session costs little and never loses money{d.avgAttendees !== null ? `. You average ${people(d.avgAttendees)}` : ''}.</p>
            </div>
          ))}
        </div>
      </section>

      <section id="deals-sessions" className={`${styles.panel} ${styles.anchored}`} aria-label="Every session, after the room">
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}><BarChart3 size={14} aria-hidden /> Every session, after the room</h2>
          <span className={styles.panelSub}>oldest → newest</span>
        </div>
        <p className={styles.hint} style={{ marginTop: 0 }}>One bar per session: what it left you once the venue was paid. Bars under the line lost money. Same scale for every room.</p>
        <div className={styles.sessionList}>
          {withDeal.map((d) => (
            <div key={d.venue.id} className={styles.sessionRow}>
              <div className={styles.breakHead}>
                <b>{d.venue.name}</b>
                <span className={styles.panelSub}>{d.sessions.length} · {d.losing.length ? <span className={styles.down}>{d.losing.length} lost money</span> : 'none lost money'}</span>
              </div>
              <SessionBars sessions={d.sessions} scale={scale} />
            </div>
          ))}
        </div>
      </section>

      <section id="deals-types" className={`${styles.panel} ${styles.anchored}`} aria-label="Fixed fee or a share">
        <div className={styles.eyebrow}>Choose</div>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}><Scale size={14} aria-hidden /> Fixed fee or a share?</h2>
        </div>
        <p className={styles.hint} style={{ marginTop: 0 }}>Each kind of deal, across the venues that use it: what a session left you, what the venues took, and how often it went wrong.</p>
        <div className={styles.typeList}>
          {types.map((t) => (
            <div key={t.deal} className={styles.typeRow}>
              <div className={styles.breakHead}>
                <b>{DEAL[t.deal]}</b>
                <span className={styles.panelSub}>{t.venues} {t.venues === 1 ? 'venue' : 'venues'} · {t.sessions} sessions</span>
              </div>
              <div className={styles.typeBar}><span className={t.takePerSession < 0 ? styles.moverDown : styles.moverUp} style={{ width: `${(Math.abs(t.takePerSession) / maxType) * 100}%` }} /></div>
              <div className={styles.typeFacts}>
                <span><b>{lei(t.takePerSession)}</b> kept a session</span>
                <span><b>{percent(t.share)}</b> to the venue</span>
                <span><b className={t.losing ? styles.down : undefined}>{t.losing}</b> lost money</span>
              </div>
              <p className={styles.hint} style={{ margin: 0 }}>{DEAL_ADVICE[t.deal]}</p>
            </div>
          ))}
        </div>
        {types.length > 1 && <p className={styles.hint} style={{ marginBottom: 0 }}>Different rooms host different work, so these averages compare more than the deal. Before switching a venue, try its other deal below: same sessions, same turnout, the other terms.</p>}
      </section>

      <section id="deals-venues" className={`${styles.anchored}`} aria-label="Venue by venue" style={{ display: 'grid', gap: 'var(--space-md)' }}>
        <div className={styles.eyebrow} style={{ marginBottom: 0 }}>Venue by venue</div>
        {withDeal.map((d) => <DealCard key={d.venue.id} d={d} open={open === d.venue.id || verdict(d).level === 'rethink'} />)}
        {free.length > 0 && (
          <section className={styles.panel}>
            <div className={styles.panelHead}><h2 className={styles.panelTitle}>No venue cost</h2><span className={styles.panelSub}>online, client sites, paid by an agency</span></div>
            <div className={styles.lineList}>
              {free.map((d) => (
                <div key={d.venue.id} className={styles.line}>
                  <span>{d.venue.name} <span className={styles.panelSub}>· {d.sessions.length} {d.sessions.length === 1 ? 'session' : 'sessions'} · {lei(d.takePerSession)} each</span></span>
                  <span>{lei(d.revenue)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
        <p className={styles.hint} style={{ margin: 0 }}>Read from each venue's deal terms, set in Settings → Clients, sources & venues. Each payment at a venue counts as one session.</p>
      </section>
    </>
  )
}

function DealCard({ d, open }: { d: VenueDeal; open: boolean }) {
  const v = d.venue
  const [alt, setAlt] = useState<Terms>(() => defaultAlternative(d))
  const [showLosing, setShowLosing] = useState(false)
  const price = d.revenuePerHead
  const maxPeople = Math.max(6, Math.ceil((Math.max(...d.sessions.map((s) => s.attendees ?? 0), d.breakEvenAttendees ?? 0, 0)) * 1.4))
  const points = price ? dealCurve(price, v, alt, maxPeople) : []
  const cross = points.length ? crossover(points) : null
  const better = (n: number) => {
    const p = points[Math.min(points.length - 1, Math.max(0, Math.round(n)))]
    return p ? p.current - p.alternative : 0
  }
  const atAvg = d.avgAttendees !== null && points.length ? better(d.avgAttendees) : null
  const vd = verdict(d)

  return (
    <details id={`venue-${v.id}`} className={`${styles.panel} ${styles.twisty} ${styles.anchored}`} open={open} aria-label={`Deal at ${v.name}`}>
      <summary>
        <span className={styles.panelTitle}><span className={styles.twistyArrow} aria-hidden>▶</span>{v.name}</span>
        <VerdictPill level={vd.level} />
      </summary>
      <div className={styles.twistyBody}>
        <p className={styles.hint} style={{ marginTop: 0 }}><span className={styles.dealTag}>{DEAL[v.deal]} · {termText(v)}</span> {vd.reason}</p>
        <div className={styles.dealStats}>
          <div><b>{lei(d.takeHome)}</b><span>kept, from {lei(d.revenue)}</span></div>
          <div><b>{lei(d.takePerSession)}</b><span>kept a session ({d.sessions.length})</span></div>
          <div><b>{d.avgAttendees ?? '—'}</b><span>{d.avgAttendees === 1 ? 'person' : 'people'} a session{d.revenuePerHead ? ` · ${lei(d.revenuePerHead)} a head` : ''}</span></div>
          <div><b>{d.breakEvenAttendees ?? (d.effectiveShare !== null ? percent(d.effectiveShare) : '—')}</b><span>{d.breakEvenAttendees ? `${d.breakEvenAttendees === 1 ? 'person covers' : 'people cover'} the room` : 'of takings to the venue'}</span></div>
        </div>
        {d.losing.length > 0 && (
          <div className={styles.banner} style={{ marginBottom: 'var(--space-sm)' }}>
            <span>{d.losing.length} {d.losing.length === 1 ? 'session' : 'sessions'} lost {lei(d.lost)} after the room.</span>
            <button type="button" className={styles.linkButton} onClick={() => setShowLosing((x) => !x)}>{showLosing ? 'Hide' : 'Which'}</button>
          </div>
        )}
        {showLosing && (
          <div className={styles.lineList} style={{ marginBottom: 'var(--space-sm)' }}>
            {d.losing.map((x) => (
              <div key={x.id} className={styles.line}>
                <span>{shortDate(x.date)} · {x.description}{x.attendees !== null ? ` · ${people(x.attendees)}` : ''}</span>
                <span className={styles.down}>{lei(x.takeHome)}</span>
              </div>
            ))}
          </div>
        )}
        {price ? (
          <>
            <h3 className={styles.subHead}>Try another deal</h3>
            <div className={styles.whatIf}>
              <SelectInput label="What if the deal were" value={alt.deal} onChange={(x) => setAlt({ ...alt, deal: x as Venue['deal'] })}>
                {options(DEAL).filter((o) => o.value !== 'monthly' && o.value !== 'none').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectInput>
              {alt.deal === 'share'
                ? <NumberInput label="Share (%)" value={alt.sharePct} scale={100} onCommit={(n) => setAlt({ ...alt, sharePct: Math.min(1, n ?? 0) })} />
                : <NumberInput label="Fee per session (lei)" value={alt.feePerSession} onCommit={(n) => setAlt({ ...alt, feePerSession: n ?? 0 })} />}
              {alt.deal === 'hybrid' && <NumberInput label="Plus share (%)" value={alt.sharePct} scale={100} onCommit={(n) => setAlt({ ...alt, sharePct: Math.min(1, n ?? 0) })} />}
            </div>
            <DealChart points={points} avg={d.avgAttendees} currentLabel={`Now: ${termText(v)}`} altLabel={`What if: ${termText(alt)}`} />
            <p className={styles.verdict}>
              {cross !== null && cross >= 1
                ? <>The two deals leave you the same at about <b>{people(cross)}</b>. {better(0) < 0
                  ? <>Below that the what-if is safer; above it, your current deal pays more.</>
                  : <>Below that your current deal is safer; above it, the what-if pays more.</>}</>
                : <>From the first person on, <b>{better(Math.max(1, maxPeople / 2)) >= 0 ? 'your current deal' : 'the what-if'}</b> leaves you more.</>}
              {atAvg !== null && d.avgAttendees !== null && Math.abs(atAvg) >= 1 && <> At your usual {people(d.avgAttendees)}, the current deal is <b className={atAvg >= 0 ? styles.up : styles.down}>{atAvg >= 0 ? `${lei(atAvg)} better` : `${lei(-atAvg)} worse`}</b> a session.</>}
            </p>
          </>
        ) : (
          <p className={styles.hint}>Record how many people came on sessions here to see how full the room must be, and to try another deal.</p>
        )}
      </div>
    </details>
  )
}
