/**
 * Reports answer practical questions for the selected period: who pays most,
 * which venues and activities earn (and, with costs, what they keep), which
 * sources matter, the P&L and cash flow, and where tax stands.
 *
 * One filter bar narrows every report at once (client, source, venue,
 * activity), and every row drills down to the payments behind it.
 */
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Download, SlidersHorizontal, X } from 'lucide-react'
import { useInflow, EMPTY_FILTER, type IncomeFilter } from '../app/state'
import { usePeriodData } from '../app/usePeriod'
import { MonthlyPair, ShareBar, SplitBar, Sparkline } from '../components/charts'
import { Optional } from '../components/Optional'
import { ReportBuilder } from './ReportBuilder'
import { ReviewReport, SectionIndex } from './Insights'
import { DealsReport } from './VenueDeals'
import { EarningsReport } from './Earnings'
import type { CostRecord } from '../domain/types'
import { ACTIVITY, PROFILE, options } from '../domain/vocabulary'
import {
  ANY_SCOPE, breakdown, DIMENSION_NOUN, inScope, keyOf, NO_ENTITY, pivot, received, scopeIsSet, sum, summarise,
  type BreakdownRow, type Dimension, type Scope,
} from '../lib/analytics'
import { addMonths, endOfMonth, monthShort, startOfMonth, yearOf } from '../lib/dates'
import { buildCashFlow, buildPnl, margins, monthColumns } from '../lib/finance'
import { delta, lei, percent } from '../lib/money'
import { download, toCsv } from '../store/backup'
import { projectYear, taxableGross } from '../tax/estimate'
import { leaveTrail } from '../app/trail'
import styles from '../styles/ui.module.css'

/** What the way back from a drill-down is called: the report you were on. */
export function trailLabel(): string {
  const route = location.hash.split('/')[2] ?? ''
  const g = GROUPS.find((x) => (x.routes as string[]).includes(route))
  return g ? `${g.label.replace('*', '')}${SUB_LABEL[route as ReportTab] && g.routes.length > 1 ? ` · ${SUB_LABEL[route as ReportTab]}` : ''}` : 'Reports'
}

export const REPORT_TABS = ['insights', 'earnings', 'clients', 'venues', 'activities', 'sources', 'deals', 'pnl', 'cashflow', 'tax', 'print'] as const
export type ReportTab = (typeof REPORT_TABS)[number]

const DIM: Record<'clients' | 'venues' | 'activities' | 'sources', Dimension> = { clients: 'client', venues: 'venue', activities: 'activity', sources: 'source' }

/** The six reports, each owning one or more routes (old links keep working). */
interface Group { id: string; label: string; routes: ReportTab[] }
const GROUPS: Group[] = [
  { id: 'review', label: 'Review', routes: ['insights'] },
  { id: 'earnings', label: 'Clients & work', routes: ['earnings'] },
  { id: 'breakdown', label: 'Breakdown', routes: ['clients', 'venues', 'activities', 'sources'] },
  { id: 'deals', label: 'Venue deals', routes: ['deals'] },
  { id: 'profit', label: 'Profit', routes: ['pnl', 'cashflow'] },
  { id: 'tax', label: 'Tax*', routes: ['tax'] },
  { id: 'print', label: 'Print', routes: ['print'] },
]
const SUB_LABEL: Partial<Record<ReportTab, string>> = { clients: 'Clients', venues: 'Venues', activities: 'Activities', sources: 'Sources', pnl: 'P&L', cashflow: 'Cash flow' }

/** A cost in scope: costs carry venue, client and activity, but never a source. */
export function costInScope(c: CostRecord, s: Scope): boolean {
  if (s.sourceId) return false
  const m = (field: string | null, want: string) => !want || (want === NO_ENTITY ? !field : field === want)
  return m(c.clientId, s.clientId) && m(c.venueId, s.venueId) && m(c.activity, s.activity)
}

export function Reports({ tab, anchor = '', onAddCost }: { tab: ReportTab; anchor?: string; onTab?: (t: ReportTab) => void; onAddCost: () => void }) {
  // A link to a section (#/reports/insights/act) lands on it once the report is drawn.
  useEffect(() => {
    if (!anchor) return
    const id = `${tab === 'insights' ? 'review' : tab}-${anchor}`
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 120)
    return () => clearTimeout(t)
  }, [tab, anchor])
  const { on } = useInflow()
  // Each optional report appears only while its feature is on.
  const groups = GROUPS.filter((g) => (g.id !== 'deals' || on('deals')) && (g.id !== 'profit' || on('costs')) && (g.id !== 'tax' || on('tax')) && (g.id !== 'print' || on('printable')))
  const current = groups.find((g) => g.routes.includes(tab)) ?? groups[0]
  // A report switched off (or a bare #/reports) falls back to the first one offered.
  const shown: ReportTab = current.routes.includes(tab) ? tab : current.routes[0]
  const scoped = on('reportTools') && shown !== 'print' && shown !== 'cashflow' && shown !== 'tax' && shown !== 'earnings'
  const [filters, setFilters] = useState(false)
  const { scope } = useInflow()
  return (
    <>
      <nav className={styles.reportNav} aria-label="Reports">
        <div className={styles.reportTabs} ref={(el) => { el?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' }) }}>
          {groups.map((g) => (
            <a key={g.id} href={`#/reports/${g.routes[0]}`} className={styles.reportTab} aria-current={g === current ? 'page' : undefined}>{g.label}</a>
          ))}
          {scoped && (
            <button type="button" className={`${styles.reportTab} ${styles.filterToggle} ${scopeIsSet(scope) ? styles.filterOn : ''}`}
              aria-expanded={filters} onClick={() => setFilters((f) => !f)}>
              <SlidersHorizontal size={14} aria-hidden /> Filter{scopeIsSet(scope) ? ' ·' : ''}
            </button>
          )}
        </div>
        {current.routes.length > 1 && (
          <div className={styles.subTabs}>
            {current.routes.map((r) => (
              <a key={r} href={`#/reports/${r}`} className={styles.subTab} aria-current={r === shown ? 'page' : undefined}>{SUB_LABEL[r]}</a>
            ))}
          </div>
        )}
        {shown === 'insights' && <SectionIndex />}
      </nav>
      {scoped && (filters || scopeIsSet(scope)) && <ScopeBar />}
      <div key={shown} className={`${styles.screen} ${styles.screenIn}`}>
        {shown === 'tax' ? <TaxReport />
          : shown === 'print' ? <ReportBuilder />
            : shown === 'pnl' ? <PnlReport onAddCost={onAddCost} />
              : shown === 'cashflow' ? <CashFlowReport />
                : shown === 'insights' ? <ReviewReport />
                  : shown === 'earnings' ? <EarningsReport />
                  : shown === 'deals' ? <DealsReport />
                    : <DimensionReport dim={DIM[shown]} />}
      </div>
      {on('tax') && shown === 'tax' && <p className={styles.hint}>* Tax is optional; switch it off in Settings → Features to see only the money flow.</p>}
    </>
  )
}

/** The filter every report shares. */
export function ScopeBar() {
  const { data, scope, setScope } = useInflow()
  const sorted = <T extends { name: string }>(l: T[]) => [...l].sort((a, b) => a.name.localeCompare(b.name))
  const field = (key: keyof Scope, label: string, opts: { value: string; label: string }[], none: string) => (
    <label>
      {label}
      <select value={scope[key]} className={scope[key] ? styles.scopeOn : undefined} onChange={(e) => setScope({ ...scope, [key]: e.target.value })}>
        <option value="">All</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        <option value={NO_ENTITY}>{none}</option>
      </select>
    </label>
  )
  return (
    <section className={styles.panel} aria-label="Filter reports">
      <div className={styles.scope}>
        {field('clientId', 'Client', sorted(data.clients).map((c) => ({ value: c.id, label: c.name })), 'No client')}
        {field('venueId', 'Venue', sorted(data.venues).map((v) => ({ value: v.id, label: v.name })), 'No venue')}
        {field('activity', 'Activity', options(ACTIVITY), 'No activity')}
        {field('sourceId', 'Source', sorted(data.sources).map((s) => ({ value: s.id, label: s.name })), 'No source')}
      </div>
      {scopeIsSet(scope) && (
        <div className={styles.chips} style={{ marginTop: 'var(--space-xs)' }}>
          <button type="button" className={styles.chip} onClick={() => setScope(ANY_SCOPE)}><X size={12} aria-hidden /> Clear filters</button>
          <span className={styles.panelSub}>These filters apply to every report.</span>
        </div>
      )}
    </section>
  )
}

function useDrill() {
  const { setFilter, scope: rawScope, on } = useInflow()
  const scope = on('reportTools') ? rawScope : ANY_SCOPE
  return (patch: Partial<IncomeFilter>) => {
    setFilter({ ...EMPTY_FILTER, range: 'period', clientId: scope.clientId, sourceId: scope.sourceId, venueId: scope.venueId, activity: scope.activity, ...patch })
    leaveTrail(trailLabel())
    location.hash = '#/income'
  }
}

const FILTER_KEY: Record<Dimension, keyof IncomeFilter> = { client: 'clientId', source: 'sourceId', venue: 'venueId', activity: 'activity' }

function DimensionReport({ dim }: { dim: Dimension }) {
  const { data, today, scope: rawScope, on } = useInflow()
  // With report tools off the filter bar is gone, and so is its effect.
  const scope = on('reportTools') ? rawScope : ANY_SCOPE
  const { range, prev, cur, before } = usePeriodData()
  const drill = useDrill()
  const [splitBy, setSplitBy] = useState<Dimension | ''>('')
  const curS = useMemo(() => cur.filter((r) => inScope(r, scope)), [cur, scope])
  const beforeS = useMemo(() => before.filter((r) => inScope(r, scope)), [before, scope])
  const total = summarise(curS).total
  const rows = useMemo(() => breakdown(data, curS, beforeS, dim), [data, curS, beforeS, dim])
  const costs = on('costs') && dim !== 'source'
  const marginRows = useMemo(
    () => (costs ? margins(data, curS, data.costs.filter((c) => costInScope(c, scope)), range, dim) : []),
    [costs, data, curS, scope, range, dim],
  )
  const marginOf = (id: string) => marginRows.find((m) => m.id === id)
  const piv = useMemo(() => (splitBy ? pivot(data, curS, dim, splitBy) : null), [data, curS, dim, splitBy])

  // Six-month history per row.
  const months = useMemo(() => {
    const end = range.to > today ? today : range.to
    return Array.from({ length: 6 }, (_, i) => startOfMonth(addMonths(startOfMonth(end), i - 5)))
  }, [range.to, today])
  const history = (row: BreakdownRow) => months.map((m) => sum(received(data.records, { from: m, to: endOfMonth(m) })
    .filter((r) => inScope(r, scope) && keyOf(r, dim) === row.id)))

  const noun = DIMENSION_NOUN[dim]
  const countNoun = dim === 'venue' || dim === 'activity' ? 'Engagements' : 'Payments'
  const exportCsv = () => download(
    `inflow-${dim}-${range.from}-${range.to}.csv`,
    toCsv([noun, 'Total RON', 'Share', countNoun, 'Average RON', `Previous (${prev.from}–${prev.to}) RON`, ...(costs ? ['Linked costs RON', 'Margin RON', 'Margin %'] : [])],
      rows.map((r) => {
        const m = marginOf(r.id)
        return [r.name, r.total, (r.share * 100).toFixed(1) + '%', r.count, r.average, r.previous,
          ...(costs ? [m?.costs ?? 0, m?.margin ?? r.total, m?.marginRate === null || !m ? '' : (m.marginRate * 100).toFixed(1) + '%'] : [])]
      })),
    'text/csv',
  )
  const go = (id: string) => drill({ [FILTER_KEY[dim]]: id })

  return (
    <>
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Income by {noun.toLowerCase()} · {range.label}</h2>
          <span className={styles.panelSub}>{lei(total)} from {rows.length} · vs {prev.label}</span>
        </div>
        {rows.length === 0 ? <p className={styles.hint}>No income in this period{scopeIsSet(scope) ? ' for these filters' : ''}.</p> : (
          <>
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <ShareBar parts={rows.map((r) => ({ id: r.id, name: r.name, value: r.total }))} label={`Income by ${noun.toLowerCase()}`} onSelect={go} />
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{noun}</th>
                  <th>Total</th>
                  <th>Share</th>
                  <th className={styles.hideNarrow}>{countNoun}</th>
                  <th className={styles.hideNarrow}>Average</th>
                  {costs && <th>Margin</th>}
                  <th className={costs ? styles.hideNarrow : undefined}>Change</th>
                  <th className={styles.hideNarrow}>6 months</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = delta(r.total, r.previous)
                  const m = marginOf(r.id)
                  return (
                    <tr key={r.id} className={styles.clickable} onClick={() => go(r.id)}
                      tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') go(r.id) }}>
                      <td>{r.name}<div className={styles.panelSub}>{r.count} · avg {lei(r.average)}{m && m.costs > 0 ? ` · costs ${lei(m.costs)}` : ''}</div></td>
                      <td>{lei(r.total)}</td>
                      <td>{percent(r.share)}</td>
                      <td className={styles.hideNarrow}>{r.count}</td>
                      <td className={styles.hideNarrow}>{lei(r.average)}</td>
                      {costs && <td title={m ? `${lei(m.revenue)} − ${lei(m.costs)} linked costs` : undefined}>{m && m.costs > 0 ? <>{lei(m.margin)}<div className={styles.panelSub}>{m.marginRate === null ? '' : percent(m.marginRate)}</div></> : <span className={styles.panelSub}>no costs</span>}</td>}
                      <td className={costs ? styles.hideNarrow : undefined}><span className={d.direction === 'up' || d.direction === 'new' ? styles.up : d.direction === 'down' ? styles.down : styles.flat}>{d.text}</span></td>
                      <td className={styles.hideNarrow}><Sparkline values={history(r)} label={`${r.name}, ${months.map((mm, i) => `${monthShort(mm)} ${lei(history(r)[i])}`).join(', ')}`} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
        {rows.length > 0 && (
          <p className={styles.hint} style={{ marginTop: 'var(--space-sm)', display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span>Tap a row to see its payments.{costs ? ' Margin = income less the costs linked to it.' : ''}</span>
            <button type="button" className={styles.linkButton} onClick={exportCsv}><Download size={12} aria-hidden /> CSV</button>
          </p>
        )}
      </section>

      {rows.length > 0 && on('reportTools') && (
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>{noun} × …</h2>
            <label className={styles.panelSub} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              Split by
              <select value={splitBy} onChange={(e) => setSplitBy(e.target.value as Dimension | '')} style={{ font: 'inherit' }} aria-label="Split by">
                <option value="">—</option>
                {(['client', 'venue', 'activity', 'source'] as Dimension[]).filter((d) => d !== dim).map((d) => <option key={d} value={d}>{DIMENSION_NOUN[d]}</option>)}
              </select>
            </label>
          </div>
          {piv && piv.cols.length > 2 && <p className={styles.hint} style={{ marginTop: 0 }}>Swipe the table sideways for more columns.</p>}
          {!piv ? <p className={styles.hint}>Cross one dimension with another, e.g. which activities pay at each venue.</p> : (
            <div className={styles.tableWrap}>
              <table className={styles.statement}>
                <thead><tr><th>{noun}</th>{piv.cols.map((c) => <th key={c.id}>{c.name}</th>)}<th>Total</th></tr></thead>
                <tbody>
                  {piv.rows.map((r) => (
                    <tr key={r.id} className={styles.clickable} onClick={() => go(r.id)}>
                      <td title={r.name}>{r.name}</td>
                      {r.cells.map((v, i) => <td key={i}>{v ? lei(v) : <span className={styles.panelSub}>·</span>}</td>)}
                      <td className={styles.totalCol}>{lei(r.total)}</td>
                    </tr>
                  ))}
                  <tr className={styles.sub}><td>Total</td>{piv.colTotals.map((v, i) => <td key={i}>{lei(v)}</td>)}<td className={styles.totalCol}>{lei(total)}</td></tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  )
}

function PnlReport({ onAddCost }: { onAddCost: () => void }) {
  const { data, scope: rawScope, today, on } = useInflow()
  const scope = on('reportTools') ? rawScope : ANY_SCOPE
  const { range } = usePeriodData()
  const [details, setDetails] = useState(false)
  const scoped = scopeIsSet(scope)
  const columns = useMemo(() => monthColumns(range), [range])
  const pnl = useMemo(() => buildPnl(
    data.records.filter((r) => inScope(r, scope)),
    data.costs.filter((c) => costInScope(c, scope)),
    columns,
  ), [data, scope, columns])
  const t = (k: string) => pnl.lines.find((l) => l.key === k)!.total
  const rev = t('revenue')
  const costTotal = rev - t('net')
  const due = data.costs.filter((c) => c.status === 'due' && c.date <= range.to)
  const exportCsv = () => download(`inflow-pnl-${range.from}-${range.to}.csv`, toCsv(
    ['Line', ...columns.map((c) => c.label), 'Total', '% of revenue'],
    pnl.lines.filter((l) => details || l.kind !== 'detail').map((l) => [l.label, ...l.values, l.total, rev ? ((l.total / rev) * 100).toFixed(1) + '%' : '']),
  ), 'text/csv')

  return (
    <>
      <div className={styles.cards3}>
        <div className={styles.stat}><div className={styles.statLabel}>Revenue</div><div className={styles.statValue}>{lei(rev)}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>Gross margin</div><div className={styles.statValue}>{lei(t('gross'))}</div><div className={styles.statNote}>{rev ? percent(t('gross') / rev) : '—'} of revenue</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>Costs</div><div className={styles.statValue}>{lei(costTotal)}</div><div className={styles.statNote}>incl. tax paid</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>Net profit</div><div className={`${styles.statValue} ${t('net') < 0 ? styles.down : ''}`}>{lei(t('net'))}</div><div className={styles.statNote}>{rev ? percent(t('net') / rev) : '—'} margin</div></div>
      </div>
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Profit & loss · {range.label}</h2>
          <span style={{ display: 'flex', gap: 'var(--space-md)' }}>
            <button type="button" className={styles.linkButton} onClick={() => setDetails((d) => !d)}>{details ? 'Hide categories' : 'Show categories'}</button>
            <button type="button" className={styles.linkButton} onClick={exportCsv}><Download size={12} aria-hidden /> CSV</button>
          </span>
        </div>
        {columns.length > 1 && (
          <MonthlyPair months={columns.map((c) => ({ label: c.label, from: c.from }))}
            income={pnl.lines.find((l) => l.key === 'revenue')!.values}
            costs={pnl.lines.find((l) => l.key === 'revenue')!.values.map((v, i) => Math.round(v - pnl.lines.find((l) => l.key === 'net')!.values[i]))} />
        )}
        {data.costs.length === 0 ? (
          <p className={styles.hint}>No costs yet, so this is revenue only. <button type="button" className={styles.linkButton} onClick={onAddCost}>Add a cost</button></p>
        ) : null}
        <div className={styles.tableWrap}>
          <table className={styles.statement}>
            {/* Total and % sit beside the labels, so a phone sees the period's answer before scrolling the months. */}
            <thead><tr><th></th><th>{columns.length > 1 ? 'Total' : columns[0]?.label}</th><th>%</th>{columns.length > 1 && columns.map((c) => <th key={c.from}>{c.label}</th>)}</tr></thead>
            <tbody>
              {pnl.lines.filter((l) => details || l.kind !== 'detail').map((l) => (
                <tr key={l.key} className={l.kind === 'subtotal' || l.kind === 'revenue' ? styles.sub : l.kind === 'detail' ? styles.detail : undefined}>
                  <td title={l.label}>{l.kind === 'cost' ? `− ${l.label}` : l.label}</td>
                  <td className={`${columns.length > 1 ? styles.totalCol : ''} ${l.total < 0 ? styles.neg : ''}`}>{fmt(l.total)}</td>
                  <td>{rev && l.kind !== 'detail' ? percent(l.total / rev) : ''}</td>
                  {columns.length > 1 && l.values.map((v, i) => <td key={i} className={v < 0 ? styles.neg : undefined}>{fmt(v)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className={styles.notes}>
          <li>Cash basis: income when received, costs when paid. Equipment purchases, loan repayments and drawings are cash movements, not P&L costs; see Cash flow.</li>
          {scoped && <li>Filtered: only costs linked to these filters are counted, so unlinked overheads (rent, software…) are left out. Clear the filters for the whole business.</li>}
          {due.length > 0 && <li>{due.length} {due.length === 1 ? 'cost is' : 'costs are'} due and not counted until paid ({lei(due.reduce((s, c) => s + c.amountRon, 0))}).</li>}
          {range.to > today && <li>The period runs to {range.to}; figures are to date.</li>}
        </ul>
      </section>
    </>
  )
}

function fmt(v: number) {
  if (v === 0) return '–'
  return lei(v).replace(' lei', '')
}

function CashFlowReport() {
  const { data, settings } = useInflow()
  const { range } = usePeriodData()
  const columns = useMemo(() => monthColumns(range), [range])
  const cf = useMemo(() => buildCashFlow(data.records, data.costs, columns, settings.openingCash, settings.openingCashDate), [data, columns, settings.openingCash, settings.openingCashDate])
  const exportCsv = () => download(`inflow-cashflow-${range.from}-${range.to}.csv`, toCsv(
    ['Line', ...columns.map((c) => c.label)], cf.rows.map((r) => [r.label, ...r.values]),
  ), 'text/csv')
  const end = cf.closing[cf.closing.length - 1] ?? 0
  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Cash flow · {range.label}</h2>
        <button type="button" className={styles.linkButton} onClick={exportCsv}><Download size={12} aria-hidden /> CSV</button>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.statement}>
          <thead><tr><th></th>{columns.map((c) => <th key={c.from}>{c.label}</th>)}</tr></thead>
          <tbody>
            {cf.rows.map((r) => (
              <tr key={r.key} className={r.kind === 'subtotal' || r.kind === 'balance' ? styles.sub : undefined}>
                <td>{r.kind === 'out' ? `− ${r.label}` : r.kind === 'in' ? `+ ${r.label}` : r.label}</td>
                {r.values.map((v, i) => <td key={i} className={v < 0 ? styles.neg : undefined}>{fmt(v)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className={styles.notes}>
        <li>{cf.relative
          ? 'No opening balance set, so balances start from zero. Set your cash on a date in Settings → Costs for real balances.'
          : `From ${lei(settings.openingCash)} in cash on ${settings.openingCashDate}. Ends the period at ${lei(end)}.`}</li>
        <li>The whole business, unfiltered. Depreciation is not cash and is left out; equipment shows when bought. Loans received and money you put in are not recorded.</li>
      </ul>
    </section>
  )
}

function TaxReport() {
  const { data, settings, today } = useInflow()
  const { range, summary } = usePeriodData()
  const drill = useDrill()
  const year = yearOf(range.to > today ? today : range.to)
  const costs = useMemo(() => (settings.features.costs ? data.costs : []), [settings.features.costs, data.costs])
  const p = useMemo(() => projectYear(settings.tax, data.records, year, today, 0, costs), [settings.tax, data.records, year, today, costs])
  const ytdWithheld = sum(data.records.filter((r) => r.status === 'received' && yearOf(r.date) === year), (r) => r.taxWithheld)
  const ytdReserved = sum(data.records.filter((r) => r.status === 'received' && yearOf(r.date) === year), (r) => r.taxReserve ?? 0)
  const yearGross = taxableGross(data.records, year)
  // What the year so far would owe at the effective rate, less what's withheld and already set aside.
  const owedSoFar = Math.round(yearGross * p.rate)
  const gap = Math.round(owedSoFar - ytdWithheld - ytdReserved)
  const turnover = sum(data.records.filter((r) => r.status === 'received' && yearOf(r.date) === year && r.taxability !== 'non_taxable'))
  const vatShare = turnover / p.estimate.rules.vatThresholdRon
  const how = p.method === 'expected' ? 'your expected annual income' : p.method === 'actual' ? 'the year\'s actual income' : 'the year so far, annualised'

  const exportCsv = () => download(
    `inflow-tax-${range.from}-${range.to}.csv`,
    toCsv(['Measure', 'RON'], [
      ['Period', `${range.from} – ${range.to}`], ['Taxable income', summary.taxable], ['Non-taxable income', summary.nonTaxable],
      ['Needs review', summary.review], ['Taxable, tax withheld at source', summary.withheld], ['Taxable, self-declared', summary.selfDeclared],
      ['Tax withheld or paid', summary.taxWithheld], ['Set aside (stored reserves)', summary.reserve],
      [`${year} projected taxable income`, Math.round(p.projected)],
      ...p.estimate.lines.map((l) => [`${year} ${l.label}`, l.amount] as [string, number]),
      [`${year} estimated total`, p.estimate.total], [`${year} effective rate`, (p.rate * 100).toFixed(1) + '%'],
    ]),
    'text/csv',
  )

  return (
    <>
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Tax · {range.label} <Optional /></h2>
          <button type="button" className={styles.linkButton} onClick={exportCsv}><Download size={12} aria-hidden /> CSV</button>
        </div>
        <SplitBar total={summary.total} parts={[
          { key: 'taxable', label: 'Taxable', value: summary.taxable, color: 'var(--chart-1)' },
          { key: 'non', label: 'Non-taxable', value: summary.nonTaxable, color: 'var(--chart-2)' },
          { key: 'review', label: 'Needs review', value: summary.review, color: 'var(--chart-3)' },
        ]} />
        <div className={styles.lineList} style={{ marginTop: 'var(--space-md)' }}>
          <button type="button" className={`${styles.row} ${styles.line}`} onClick={() => drill({ taxability: 'taxable' })}>
            <span>Taxable, tax withheld at source</span><span>{lei(summary.withheld)}</span>
          </button>
          <button type="button" className={`${styles.row} ${styles.line}`} onClick={() => drill({ taxability: 'taxable' })}>
            <span>Taxable, to declare yourself</span><span>{lei(summary.selfDeclared)}</span>
          </button>
          <button type="button" className={`${styles.row} ${styles.line}`} onClick={() => drill({ taxability: 'non_taxable' })}>
            <span>Non-taxable</span><span>{lei(summary.nonTaxable)}</span>
          </button>
          <button type="button" className={`${styles.row} ${styles.line}`} onClick={() => drill({ taxability: 'review' })}>
            <span>Needs review</span><span>{lei(summary.review)}</span>
          </button>
          <div className={`${styles.line} ${styles.lineTotal}`}><span>Tax withheld or paid</span><span>{lei(summary.taxWithheld)}</span></div>
          <div className={styles.line}><span>Set aside on these payments</span><span>{lei(summary.reserve)}</span></div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>{year} estimate · {PROFILE[settings.tax.id]}</h2>
          <span className={styles.panelSub}>rules {p.estimate.rules.id}{p.estimate.provisional ? ' (provisional)' : ''}</span>
        </div>
        <div className={styles.lineList}>
          <div className={styles.line}><span>Taxable income so far</span><span>{lei(p.ytd)}</span></div>
          <div className={styles.line}><span>Read at, for the full year</span><span>{lei(p.projected)}</span></div>
          <span className={styles.lineNote}>From {how}.{(settings.tax.id === 'pfa_real' || settings.tax.id === 'srl_micro') && p.estimate.expenses > 0 ? ` Less ${lei(p.estimate.expenses)} of expenses.` : ''}</span>
          {p.estimate.lines.map((l) => (
            <Fragment key={l.key}>
              <div className={styles.line}>
                <span>{l.label}{l.rate !== null && l.base !== null ? <span className={styles.panelSub}> · {percent(l.rate)} of {lei(l.base)}</span> : null}</span>
                <span>{lei(l.amount)}</span>
              </div>
              {l.note && <span className={styles.lineNote}>{l.note}</span>}
            </Fragment>
          ))}
          <div className={`${styles.line} ${styles.lineTotal}`}><span>Estimated for {year}</span><span>{lei(p.estimate.total)}</span></div>
          <div className={styles.line}><span>Effective rate</span><span>{percent(p.rate, 1)}</span></div>
        </div>
        <div className={styles.lineList} style={{ marginTop: 'var(--space-md)' }}>
          <div className={styles.line}><span>Owed on income so far, at that rate</span><span>{lei(owedSoFar)}</span></div>
          <div className={styles.line}><span>Withheld or paid this year</span><span>− {lei(ytdWithheld)}</span></div>
          <div className={styles.line}><span>Already set aside this year</span><span>− {lei(ytdReserved)}</span></div>
          <div className={`${styles.line} ${styles.lineTotal}`}>
            <span>{gap > 0 ? 'Still to set aside' : 'Ahead of your reserve by'}</span><span>{lei(Math.abs(gap))}</span>
          </div>
        </div>
        <ul className={styles.notes}>
          {p.estimate.notes.map((n) => <li key={n}>{n}</li>)}
          <li>An estimate to plan with, not tax advice. Your accountant and the Declarația unică have the final word.</li>
        </ul>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>VAT threshold · {year}</h2>
          <span className={styles.panelSub}>{settings.tax.vatRegistered ? 'VAT-registered' : 'small-business exemption'}</span>
        </div>
        <div className={styles.progress} role="progressbar" aria-label="Share of the VAT threshold" aria-valuenow={Math.round(vatShare * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className={styles.progressFill} style={{ width: `${Math.min(100, vatShare * 100)}%`, background: vatShare > 0.85 ? 'var(--color-warning)' : undefined }} />
        </div>
        <p className={styles.hint} style={{ marginTop: 'var(--space-xs)' }}>
          {lei(turnover)} of {lei(p.estimate.rules.vatThresholdRon)} ({percent(vatShare)}). Above the threshold you must register for VAT (art. 316).
          Counts all income not marked non-taxable; the legal turnover test has its own exclusions.
        </p>
      </section>
    </>
  )
}

