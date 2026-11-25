/**
 * Reports answer practical questions for the selected period: the review,
 * what clients and kinds of work leave you, venue deals, profit and cash
 * flow, and where tax stands. The period is the only filter; rows drill down
 * to the payments behind them.
 */
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { useInflow, EMPTY_FILTER, type IncomeFilter } from '../app/state'
import { usePeriodData } from '../app/usePeriod'
import { MonthlyPair, SplitBar } from '../components/charts'
import { Optional } from '../components/Optional'
import { ReportBuilder } from './ReportBuilder'
import { ReviewReport, SectionIndex } from './Insights'
import { DealsReport } from './VenueDeals'
import { EarningsReport } from './Earnings'
import { PROFILE } from '../domain/vocabulary'
import { sum, type Dimension } from '../lib/analytics'
import { daysBetween, yearOf } from '../lib/dates'
import { breakEven, buildCashFlow, buildPnl, monthColumns } from '../lib/finance'
import { lei, percent, round2 } from '../lib/money'
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

/** Old Breakdown links (#/reports/venues…) open Clients & work on that view. */
const DIM: Partial<Record<ReportTab, Dimension>> = { clients: 'client', venues: 'venue', activities: 'activity', sources: 'source' }

/** The six reports, each owning one or more routes (old links keep working). */
interface Group { id: string; label: string; routes: ReportTab[] }
const GROUPS: Group[] = [
  { id: 'review', label: 'Review', routes: ['insights'] },
  { id: 'earnings', label: 'Clients & work', routes: ['earnings', 'clients', 'venues', 'activities', 'sources'] },
  { id: 'deals', label: 'Venue deals', routes: ['deals'] },
  { id: 'profit', label: 'Profit', routes: ['pnl', 'cashflow'] },
  { id: 'tax', label: 'Tax*', routes: ['tax'] },
  { id: 'print', label: 'Print', routes: ['print'] },
]
const SUB_LABEL: Partial<Record<ReportTab, string>> = { pnl: 'P&L', cashflow: 'Cash flow' }

export function Reports({ tab, anchor = '', onAddCost }: { tab: ReportTab; anchor?: string; onAddCost: () => void }) {
  const { on } = useInflow()
  // A link to a section (#/reports/insights/act) lands on it once the report is drawn: the next frame, not a guessed delay.
  useEffect(() => {
    if (!anchor) return
    const id = `${tab === 'insights' ? 'review' : tab}-${anchor}`
    const f = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }))
    return () => cancelAnimationFrame(f)
  }, [tab, anchor])
  // Each optional report appears only while its feature is on.
  const groups = GROUPS.filter((g) => (g.id !== 'deals' || on('deals')) && (g.id !== 'profit' || on('costs')) && (g.id !== 'tax' || on('tax')) && (g.id !== 'print' || on('printable')))
  const current = groups.find((g) => g.routes.includes(tab)) ?? groups[0]
  // A report switched off (or a bare #/reports) falls back to the first one offered.
  const shown: ReportTab = current.routes.includes(tab) ? tab : current.routes[0]
  const subs = current.routes.filter((r) => SUB_LABEL[r])
  return (
    <>
      <nav className={styles.reportNav} aria-label="Reports">
        <div className={styles.reportTabs}>
          {groups.map((g) => (
            <a key={g.id} href={`#/reports/${g.routes[0]}`} className={styles.reportTab} aria-current={g === current ? 'page' : undefined}>{g.label}</a>
          ))}
        </div>
        {subs.length > 1 && (
          <div className={styles.subTabs}>
            {subs.map((r) => (
              <a key={r} href={`#/reports/${r}`} className={styles.subTab} aria-current={r === shown ? 'page' : undefined}>{SUB_LABEL[r]}</a>
            ))}
          </div>
        )}
        {shown === 'insights' && <SectionIndex />}
      </nav>
      <div key={current.id} className={`${styles.screen} ${styles.screenIn}`}>
        {shown === 'tax' ? <TaxReport />
          : shown === 'print' ? <ReportBuilder />
            : shown === 'pnl' ? <PnlReport onAddCost={onAddCost} />
              : shown === 'cashflow' ? <CashFlowReport />
                : shown === 'insights' ? <ReviewReport />
                  : shown === 'deals' ? <DealsReport />
                    : <EarningsReport initial={DIM[shown]} />}
      </div>
      {on('tax') && shown === 'tax' && <p className={styles.hint}>* Tax is optional; switch it off in Settings → Features to see only the money flow.</p>}
    </>
  )
}

/** Open the payments behind a figure, leaving the way back to this report. */
function useDrill() {
  const { setFilter } = useInflow()
  return (patch: Partial<IncomeFilter>) => {
    setFilter({ ...EMPTY_FILTER, ...patch })
    leaveTrail(trailLabel())
    location.hash = '#/income'
  }
}

function PnlReport({ onAddCost }: { onAddCost: () => void }) {
  const { data, today, period } = useInflow()
  const { range } = usePeriodData()
  const [details, setDetails] = useState(false)
  const columns = useMemo(() => monthColumns(range), [range])
  const pnl = useMemo(() => buildPnl(data.records, data.costs, columns), [data, columns])
  // The income a month needs to cover its fixed costs, scaled to the selected period, and where the period stands.
  const be = useMemo(() => breakEven(data.records, data.costs, today), [data, today])
  const t = (k: string) => pnl.lines.find((l) => l.key === k)!.total
  const rev = t('revenue')
  const days = daysBetween(range.from, range.to) + 1
  const [beScale, beLabel] = period.preset === 'month' || period.preset === 'last_month' ? [1, 'Break-even a month']
    : period.preset === 'year' ? [12, 'Break-even a year']
      : period.preset === 'week' ? [7 / 30.44, 'Break-even a week']
        : [days / 30.44, `Break-even for ${days} days`]
  const beNeed = be ? round2(be.revenueNeeded * beScale) : 0
  const beCovered = beNeed > 0 ? rev / beNeed : 0
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
        {be && (
          <div className={styles.stat}>
            <div className={styles.statLabel}>{beLabel}</div>
            <div className={styles.statValue}>{lei(beNeed)}</div>
            <div className={styles.progress} role="progressbar" aria-label="Break-even in this period" aria-valuenow={Math.round(beCovered * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className={styles.progressFill} style={{ width: `${Math.min(100, beCovered * 100)}%`, background: beCovered < 1 ? 'var(--color-warning)' : undefined }} />
            </div>
            <div className={styles.statNote}>{beCovered >= 1 ? 'covered in this period' : `${percent(beCovered)} covered${range.to >= today ? ' so far' : ''}`}</div>
          </div>
        )}
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
          <li>Cash basis: income when received, costs when paid.</li>
          <li>Equipment, loan repayments and drawings are in Cash flow, not here.</li>
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
        <li>The whole business, unfiltered.</li>
        <li>No depreciation (not cash); equipment shows when bought.</li>
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

