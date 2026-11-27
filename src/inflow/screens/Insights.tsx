/**
 * Review: the period in review — a headline, the main movers, who carries
 * the income, then the pain points and wins. Clients & work lives in
 * Earnings.tsx, venue deals in VenueDeals.tsx.
 */
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Copy, PiggyBank, Trophy, Wallet } from 'lucide-react'
import { useInflow, EMPTY_FILTER, DIM_FILTER } from '../app/state'
import { usePeriodData } from '../app/usePeriod'
import { InsightList } from '../components/insightsUi'
import { MoversChart } from '../components/charts'
import { Donut } from '../components/Donut'
import { leaveTrail } from '../app/trail'
import { buildPnl, monthColumns } from '../lib/finance'
import { movers, reviewHighlights, reviewSummary, reviewTitle, shakers, type HighlightKind } from '../lib/review'
import { DIMENSION_NOUN, type Dimension } from '../lib/analytics'
import type { FeatureKey } from '../domain/types'
import { insights } from '../lib/insights'
import { useInsightFeedback } from '../app/insightFeedback'
import styles from '../styles/ui.module.css'

const HIGHLIGHT_ICON: Record<HighlightKind, typeof Copy> = { in: Wallet, kept: PiggyBank, top: Trophy, up: ArrowUpRight, down: ArrowDownRight, look: AlertTriangle }


export interface IndexItem { id: string; label: string; needs?: FeatureKey }

/** The Review's sections, in order: the index under the report tabs follows them. */
export const REVIEW_SECTIONS: IndexItem[] = [
  { id: 'review-summary', label: 'Summary' },
  { id: 'review-movers', label: 'Movers' },
  { id: 'review-shakers', label: 'Who pays' },
  { id: 'review-act', label: 'Pain points', needs: 'insights' },
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
    // The sections render in the same commit as this strip: one frame and they are in the DOM.
    const f = requestAnimationFrame(() => ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el) }))
    return () => { cancelAnimationFrame(f); io.disconnect() }
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
  const { books: data, today, on, setFilter, toast } = useInflow()
  const { range, prev, cur, before } = usePeriodData()
  const fb = useInsightFeedback()
  const list = useMemo(() => (on('insights') ? insights(data, range, today, { deals: on('deals'), costs: on('costs'), expected: on('expected'), tax: on('tax') }) : []), [data, range, today, on])
  const kept = useMemo(() => {
    if (!on('costs')) return null
    const pnl = buildPnl(data.records, data.costs, monthColumns(range))
    return pnl.lines.find((l) => l.key === 'net')!.total
  }, [on, data.records, data.costs, range])
  const firstRecord = useMemo(() => data.records.reduce((m, r) => (r.status === 'received' && r.date < m ? r.date : m), '9999'), [data.records])
  const input = { data, cur: cur, before: before, prevLabel: prev.label, kept, insights: fb.apply(list), periodLabel: range.label, prevFrom: prev.from, firstRecord }
  // Rows on screen; the same facts as a sentence for Copy summary.
  const summary = reviewSummary(input)
  const highlights = reviewHighlights(input)
  const moved = useMemo(() => movers(data, cur, before), [data, cur, before])
  const [dim, setDim] = useState<Dimension>('client')
  const parts = useMemo(() => shakers(data, cur, before, dim).map((r) => ({ id: r.id, name: r.name, value: r.total })), [data, cur, before, dim])
  const visible = fb.apply(list)
  const pains = visible.filter((i) => i.kind === 'pain').length
  const wins = visible.filter((i) => i.kind === 'win').length

  const open = (patch: Record<string, string>) => {
    setFilter({ ...EMPTY_FILTER, ...patch })
    leaveTrail('Review')
    location.hash = '#/income'
  }
  const copy = () => {
    const text = `${reviewTitle(range)}\n\n${summary}`
    void navigator.clipboard?.writeText(text).then(() => toast({ message: 'Summary copied', tone: 'success' }), () => toast('Could not copy'))
  }

  // Data, but nothing received in this period: say so, rather than a review of zeros (audit C-04).
  if (cur.length === 0 && !data.records.some((r) => r.status === 'received' && r.date >= range.from && r.date <= range.to)) {
    return (
      <section id="review-summary" className={styles.panel} aria-label="Summary">
        <h2 className={styles.reviewTitle}>{reviewTitle(range)}</h2>
        <p className={styles.emptyNote}>Nothing received in this period.</p>
        <div style={{ textAlign: 'center' }}><WiderPeriod what="" /></div>
      </section>
    )
  }

  return (
    <>
      <section id="review-summary" className={`${styles.panel} ${styles.reviewHero} ${styles.anchored}`} aria-label="Summary">
        <div className={styles.eyebrow}>Understand</div>
        <h2 className={styles.reviewTitle}>{reviewTitle(range)}</h2>
        <ul className={styles.highlights}>
          {highlights.map((h) => {
            const Icon = HIGHLIGHT_ICON[h.kind]
            const body = (
              <>
                <span className={`${styles.hlIcon} ${styles[`hl_${h.tone}`]}`} aria-hidden><Icon size={18} /></span>
                <span className={styles.hlLabel}>{h.label}</span>
                <b className={styles.hlValue}>{h.value}</b>
                <span className={styles.hlNote}>{h.note}</span>
              </>
            )
            return (
              <li key={h.kind}>
                {h.kind === 'look'
                  ? <button type="button" className={styles.hlRow} onClick={() => document.getElementById('review-act')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{body}</button>
                  : <div className={styles.hlRow}>{body}</div>}
              </li>
            )
          })}
        </ul>
        <div className={styles.hlFoot}>
          <span className={styles.panelSub}>{cur.length} {cur.length === 1 ? 'payment' : 'payments'} · {range.label}</span>
          {cur.length > 0 && <button type="button" className={styles.linkButton} onClick={copy}><Copy size={12} aria-hidden /> Copy summary</button>}
        </div>
      </section>

      <section id="review-movers" className={`${styles.panel} ${styles.anchored}`} aria-label="Main movers">
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Main movers</h2>
          <span className={styles.panelSub}>vs {prev.label}</span>
        </div>
        <MoversChart prevLabel={prev.label}
          rows={moved.map((m) => ({ key: `${m.dim}:${m.id}`, name: m.name, tag: DIMENSION_NOUN[m.dim], change: m.change, current: m.current, previous: m.previous }))}
          onSelect={(k) => { const [dm, id] = k.split(':'); open({ [DIM_FILTER[dm as Dimension]]: id }) }} />
      </section>

      <section id="review-shakers" className={`${styles.panel} ${styles.anchored}`} aria-label="Who carries the income">
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Who carries the income</h2>
          <select className={styles.inlineSelect} value={dim} onChange={(e) => setDim(e.target.value as Dimension)} aria-label="Split by">
            {(['client', 'venue', 'activity', 'source'] as Dimension[]).map((x) => <option key={x} value={x}>by {DIMENSION_NOUN[x].toLowerCase()}</option>)}
          </select>
        </div>
        <Donut key={dim} parts={parts} caption={range.label.toLowerCase()} label={`Income by ${DIMENSION_NOUN[dim].toLowerCase()}`} onSelect={(id) => open({ [DIM_FILTER[dim]]: id })} />
      </section>

      {on('insights') && (
        <section id="review-act" className={`${styles.panel} ${styles.anchored}`} aria-label="Pain points and wins">
          <div className={styles.eyebrow}>Act</div>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Pain points and wins</h2>
            <span className={styles.panelSub}>{pains} to look at · {wins} going well</span>
          </div>
          <InsightList items={list} feedback={fb}
            onHidden={(undo, what) => toast({ message: what, actionLabel: 'Undo', onAction: undo })} />
        </section>
      )}

    </>
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
