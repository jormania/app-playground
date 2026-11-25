/**
 * Reports answer practical questions for the selected period: who pays most,
 * which venues earn, which sources matter, and where tax stands. Every row
 * drills down to the payments behind it.
 */
import { Fragment, useMemo } from 'react'
import { Download } from 'lucide-react'
import { SegmentedControl } from '../../ds'
import { useInflow, EMPTY_FILTER, type IncomeFilter } from '../app/state'
import { usePeriodData } from '../app/usePeriod'
import { SplitBar, Sparkline } from '../components/charts'
import { Optional } from '../components/Optional'
import { ReportBuilder } from './ReportBuilder'
import { PROFILE } from '../domain/vocabulary'
import { breakdown, received, sum, type BreakdownRow, type Dimension } from '../lib/analytics'
import { addMonths, endOfMonth, monthShort, startOfMonth, yearOf } from '../lib/dates'
import { delta, lei, percent } from '../lib/money'
import { download, toCsv } from '../store/backup'
import { projectYear, taxableGross } from '../tax/estimate'
import styles from '../styles/ui.module.css'

export type ReportTab = 'clients' | 'venues' | 'sources' | 'tax' | 'print'

const TABS = [
  { value: 'clients', label: 'Clients' },
  { value: 'venues', label: 'Venues' },
  { value: 'sources', label: 'Sources' },
]
const TAX_TAB = { value: 'tax', label: 'Tax*' }
const PRINT_TAB = { value: 'print', label: 'Printable' }

const DIM: Record<Exclude<ReportTab, 'tax' | 'print'>, Dimension> = { clients: 'client', venues: 'venue', sources: 'source' }

export function Reports({ tab, onTab }: { tab: ReportTab; onTab: (t: ReportTab) => void }) {
  const { settings } = useInflow()
  // Tax is optional: with tracking off, its tab isn't offered at all.
  const shown: ReportTab = tab === 'tax' && !settings.trackTax ? 'clients' : tab
  return (
    <>
      <SegmentedControl wrap options={[...TABS, ...(settings.trackTax ? [TAX_TAB] : []), PRINT_TAB]} value={shown} onChange={(v) => onTab(v as ReportTab)} label="Report" />
      {settings.trackTax && <p className={styles.hint}>* Tax is optional; switch it off in Settings to see only the money flow.</p>}
      {shown === 'tax' ? <TaxReport /> : shown === 'print' ? <ReportBuilder /> : <DimensionReport dim={DIM[shown]} />}
    </>
  )
}

function useDrill() {
  const { setFilter } = useInflow()
  return (patch: Partial<IncomeFilter>) => {
    setFilter({ ...EMPTY_FILTER, range: 'period', ...patch })
    location.hash = '#/income'
  }
}

function DimensionReport({ dim }: { dim: Dimension }) {
  const { data, today } = useInflow()
  const { range, prev, cur, before, summary } = usePeriodData()
  const drill = useDrill()
  const rows = useMemo(() => breakdown(data, cur, before, dim), [data, cur, before, dim])

  // Six-month history per row, for venues' trend column.
  const months = useMemo(() => {
    const end = range.to > today ? today : range.to
    return Array.from({ length: 6 }, (_, i) => startOfMonth(addMonths(startOfMonth(end), i - 5)))
  }, [range.to, today])
  const history = (row: BreakdownRow) => months.map((m) => sum(received(data.records, { from: m, to: endOfMonth(m) })
    .filter((r) => (dim === 'client' ? r.clientId : dim === 'source' ? r.sourceId : r.venueId) === (row.id === '__none__' ? null : row.id))))

  const noun = dim === 'client' ? 'Client' : dim === 'source' ? 'Source' : 'Venue'
  const countNoun = dim === 'venue' ? 'Engagements' : 'Payments'
  const exportCsv = () => download(
    `inflow-${dim}s-${range.from}-${range.to}.csv`,
    toCsv([noun, 'Total RON', 'Share', countNoun, 'Average RON', `Previous (${prev.from}–${prev.to}) RON`],
      rows.map((r) => [r.name, r.total, (r.share * 100).toFixed(1) + '%', r.count, r.average, r.previous])),
    'text/csv',
  )

  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Income by {dim} · {range.label}</h2>
        <span className={styles.panelSub}>{lei(summary.total)} from {rows.length} · vs {prev.label}</span>
      </div>
      {rows.length === 0 ? <p className={styles.hint}>No income in this period.</p> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{noun}</th>
                <th>Total</th>
                <th>Share</th>
                <th className={styles.hideNarrow}>{countNoun}</th>
                <th className={styles.hideNarrow}>Average</th>
                <th>{dim === 'venue' ? '6 months' : 'Change'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const d = delta(r.total, r.previous)
                return (
                  <tr key={r.id} className={styles.clickable} onClick={() => drill({ [`${dim}Id`]: r.id })}
                    tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') drill({ [`${dim}Id`]: r.id }) }}>
                    <td>{r.name}<div className={styles.panelSub}>{r.count} · avg {lei(r.average)}</div></td>
                    <td>{lei(r.total)}</td>
                    <td>{percent(r.share)}</td>
                    <td className={styles.hideNarrow}>{r.count}</td>
                    <td className={styles.hideNarrow}>{lei(r.average)}</td>
                    <td>
                      {dim === 'venue'
                        ? <Sparkline values={history(r)} label={`${r.name}, ${months.map((m) => `${monthShort(m)} ${lei(history(r)[months.indexOf(m)])}`).join(', ')}`} />
                        : <span className={d.direction === 'up' || d.direction === 'new' ? styles.up : d.direction === 'down' ? styles.down : styles.flat}>{d.text}</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 0 && (
        <p className={styles.hint} style={{ marginTop: 'var(--space-sm)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>Tap a row to see its payments.</span>
          <button type="button" className={styles.linkButton} onClick={exportCsv}><Download size={12} aria-hidden /> CSV</button>
        </p>
      )}
    </section>
  )
}

function TaxReport() {
  const { data, settings, today } = useInflow()
  const { range, summary } = usePeriodData()
  const drill = useDrill()
  const year = yearOf(range.to > today ? today : range.to)
  const p = useMemo(() => projectYear(settings.tax, data.records, year, today), [settings.tax, data.records, year, today])
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
          <span className={styles.lineNote}>From {how}.{settings.tax.id === 'pfa_real' && p.estimate.expenses > 0 ? ` Less ${lei(p.estimate.expenses)} of expenses.` : ''}</span>
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
