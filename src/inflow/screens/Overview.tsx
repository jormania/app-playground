/**
 * The 20-second screen: how much came in, from where, how much of it is
 * taxable, what's been withheld, what to put aside, and how it's moving.
 */
import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, CalendarClock, Info, Sparkles } from 'lucide-react'
import { SegmentedControl } from '../../ds'
import { useInflow } from '../app/state'
import { usePeriodData } from '../app/usePeriod'
import { BreakdownList, SplitBar, TrendChart } from '../components/charts'
import { Optional } from '../components/Optional'
import {
  breakdown, concentration, largeRecordIds, NO_ENTITY, outstanding, received, series, sum, type Dimension,
} from '../lib/analytics'
import { addDays, daysBetween, endOfMonth, shortDate, startOfMonth, startOfWeek, yearOf } from '../lib/dates'
import { delta, lei, money, percent } from '../lib/money'
import { alignedPrevious, buckets, type Bucket } from '../lib/period'
import { projectYear } from '../tax/estimate'
import styles from '../styles/ui.module.css'

function granularity(bs: Bucket[]): string {
  const widest = Math.max(...bs.map((b) => daysBetween(b.from, b.to) + 1))
  return widest === 1 ? 'per day' : widest <= 7 ? 'per week' : 'per month'
}

const DIMS: { value: Dimension; label: string }[] = [
  { value: 'client', label: 'Clients' },
  { value: 'source', label: 'Sources' },
  { value: 'venue', label: 'Venues' },
]

export function Overview({ onOpen }: { onOpen: (id: string) => void }) {
  const { data, settings, today, setFilter, filter } = useInflow()
  const { range, prev, prevWhole, cur, before, summary, prevSummary } = usePeriodData()
  const [dim, setDim] = useState<Dimension>('client')
  const go = (patch: Partial<typeof filter>) => { setFilter({ ...filter, query: '', clientId: '', sourceId: '', venueId: '', taxability: '', status: '', range: 'period', ...patch }); location.hash = '#/income' }

  const week = sum(received(data.records, { from: startOfWeek(today), to: addDays(startOfWeek(today), 6) }))
  const month = sum(received(data.records, { from: startOfMonth(today), to: endOfMonth(today) }))
  const d = delta(summary.total, prevSummary.total)

  const chart = useMemo(() => {
    const bs = buckets(range)
    const pb = alignedPrevious(bs, prevWhole)
    return { bs, current: series(data.records, bs), previous: series(data.records, pb) }
  }, [data.records, range, prevWhole])

  const rows = useMemo(() => breakdown(data, cur, before, dim), [data, cur, before, dim])
  const clientRows = useMemo(() => breakdown(data, cur, before, 'client'), [data, cur, before])
  const conc = concentration(clientRows)
  const large = useMemo(() => largeRecordIds(data.records, settings.largeMultiple), [data.records, settings.largeMultiple])
  const notable = cur.filter((r) => large.has(r.id))
  const owed = outstanding(data.records, today)
  const projection = useMemo(() => projectYear(settings.tax, data.records, yearOf(range.to > today ? today : range.to), today), [settings.tax, data.records, range.to, today])
  const target = settings.monthlyTarget
  const recurringTotal = sum(cur.filter((r) => r.recurring))
  const recurringShare = summary.total > 0 ? recurringTotal / summary.total : 0
  const currencies = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of cur) m.set(r.currency, (m.get(r.currency) ?? 0) + r.amountRon)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [cur])

  return (
    <>
      <section className={`${styles.panel} ${styles.hero}`} aria-label="Income this period">
        <div>
          <div className={styles.heroLabel}>{range.label} · {shortDate(range.from)} – {shortDate(range.to, yearOf(today))}</div>
          <div className={styles.heroValue} data-testid="period-total">{lei(summary.total)}</div>
          <div className={styles.heroMeta}>
            <span className={`${styles.delta} ${d.direction === 'up' || d.direction === 'new' ? styles.up : d.direction === 'down' ? styles.down : styles.flat}`}>
              {d.direction === 'up' && <ArrowUpRight size={16} aria-hidden />}
              {d.direction === 'down' && <ArrowDownRight size={16} aria-hidden />}
              {d.text}
            </span>
            <span>vs {prev.label}{prev.to !== prevWhole.to ? ' to date' : ''} ({lei(prevSummary.total)})</span>
            <span>{summary.count} {summary.count === 1 ? 'payment' : 'payments'}</span>
          </div>
        </div>
        <div className={styles.stats}>
          <div className={styles.stat}><div className={styles.statLabel}>This week</div><div className={styles.statValue}>{lei(week)}</div></div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>This month</div>
            <div className={styles.statValue}>{lei(month)}</div>
            {target > 0 && (
              <>
                <div className={styles.progress} role="progressbar" aria-label="Monthly target" aria-valuenow={Math.round((month / target) * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className={styles.progressFill} style={{ width: `${Math.min(100, (month / target) * 100)}%` }} />
                </div>
                <div className={styles.statNote}>{percent(month / target)} of {lei(target)} target</div>
              </>
            )}
          </div>
          {settings.trackTax ? (
            <>
              <div className={styles.stat}>
                <div className={styles.statLabel}>Set aside for tax <Optional /></div>
                <div className={styles.statValue}>{lei(summary.reserve)}</div>
                <div className={styles.statNote}>{summary.taxWithheld > 0 ? `+ ${lei(summary.taxWithheld)} withheld` : 'nothing withheld'}</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statLabel}>Estimated net <Optional /></div>
                <div className={styles.statValue}>{lei(summary.net)}</div>
                <div className={styles.statNote}>after reserve and withheld tax</div>
              </div>
            </>
          ) : (
            <>
              <div className={styles.stat}>
                <div className={styles.statLabel}>Average payment</div>
                <div className={styles.statValue}>{lei(summary.count ? summary.total / summary.count : 0)}</div>
                <div className={styles.statNote}>{summary.count} in {range.label.toLowerCase()}</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statLabel}>Clients paid</div>
                <div className={styles.statValue}>{clientRows.filter((r) => r.id !== NO_ENTITY).length}</div>
                <div className={styles.statNote}>{recurringShare > 0 ? `${percent(recurringShare)} recurring` : 'all one-off'}</div>
              </div>
            </>
          )}
        </div>
      </section>

      <section className={styles.panel} aria-label="Trend">
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>How it's moving</h2>
          <span className={styles.panelSub}>{granularity(chart.bs)}</span>
        </div>
        <TrendChart buckets={chart.bs} current={chart.current} previous={chart.previous} previousLabel={prevWhole.label} />
      </section>

      <div className={styles.grid2}>
        <section className={styles.panel} aria-label="Where it came from">
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Where it came from</h2>
          </div>
          <SegmentedControl size="sm" options={DIMS} value={dim} onChange={(v) => setDim(v as Dimension)} label="Break down by" />
          <div style={{ marginTop: 'var(--space-sm)' }}>
            <BreakdownList rows={rows} onSelect={(r) => go({ [`${dim}Id`]: r.id })} />
          </div>
          {dim === 'client' && conc && conc.level !== 'healthy' && (
            <p className={styles.hint} style={{ marginTop: 'var(--space-sm)' }}>
              <Info size={12} aria-hidden /> {percent(conc.share)} of this period came from {conc.name}.
              {conc.level === 'high' ? ' That is a lot resting on one client.' : ' Worth keeping an eye on.'}
            </p>
          )}
        </section>

        {settings.trackTax ? (
        <section className={styles.panel} aria-label="Taxable or not">
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Taxable or not <Optional /></h2>
            <button type="button" className={styles.linkButton} onClick={() => { location.hash = '#/reports/tax' }}>Tax report</button>
          </div>
          <SplitBar total={summary.total} parts={[
            { key: 'taxable', label: 'Taxable', value: summary.taxable, color: 'var(--chart-1)' },
            { key: 'non', label: 'Non-taxable', value: summary.nonTaxable, color: 'var(--chart-2)' },
            { key: 'review', label: 'Needs review', value: summary.review, color: 'var(--chart-3)' },
          ]} />
          <div className={styles.lineList} style={{ marginTop: 'var(--space-md)' }}>
            <div className={styles.line}><span>Tax withheld or paid</span><span>{lei(summary.taxWithheld)}</span></div>
            <div className={styles.line}><span>Set aside (stored on payments)</span><span>{lei(summary.reserve)}</span></div>
            <div className={styles.line}>
              <span>{projection.year} effective rate{projection.estimate.provisional ? ' (provisional)' : ''}</span>
              <span>{percent(projection.rate, 1)}</span>
            </div>
            <span className={styles.lineNote}>
              {settings.tax.id === 'custom' ? 'Your own flat rate.' : `At ${lei(projection.projected)} of taxable income for ${projection.year}. Estimate, not advice.`}
            </span>
          </div>
          {summary.review > 0 && (
            <p className={styles.hint} style={{ marginTop: 'var(--space-sm)' }}>
              <button type="button" className={styles.linkButton} onClick={() => go({ taxability: 'review' })}>{lei(summary.review)} needs a decision →</button>
            </p>
          )}
        </section>
        ) : (
        <section className={styles.panel} aria-label="Regular or one-off">
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Regular or one-off</h2>
            <span className={styles.panelSub}>{currencies.length > 1 ? `${currencies.length} currencies` : 'one currency'}</span>
          </div>
          <SplitBar total={summary.total} parts={[
            { key: 'recurring', label: 'Recurring', value: recurringTotal, color: 'var(--chart-1)' },
            { key: 'oneoff', label: 'One-off', value: Math.max(0, summary.total - recurringTotal), color: 'var(--chart-2)' },
          ]} />
          <div className={styles.lineList} style={{ marginTop: 'var(--space-md)' }}>
            {currencies.map(([cur, v]) => (
              <div key={cur} className={styles.line}><span>Paid in {cur}</span><span>{lei(v)}</span></div>
            ))}
          </div>
        </section>
        )}
      </div>

      {(owed.count > 0 || notable.length > 0) && (
        <div className={styles.grid2}>
          {owed.count > 0 && (
            <section className={styles.panel} aria-label="Expected payments">
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}><CalendarClock size={14} aria-hidden /> Expected</h2>
                <span className={styles.panelSub}>{lei(owed.total)}{owed.overdue ? ` · ${owed.overdue} overdue` : ''}</span>
              </div>
              <div className={styles.rows}>
                {owed.records.slice(0, 4).map((r) => (
                  <button key={r.id} type="button" className={styles.row} onClick={() => onOpen(r.id)}>
                    <span className={styles.rowName}>{r.description}</span>
                    <span className={styles.rowValue}>{money(r.amount, r.currency)}</span>
                    <span className={styles.rowMeta} style={r.date < today ? { color: 'var(--color-warning)' } : undefined}>
                      {data.clients.find((c) => c.id === r.clientId)?.name ?? '—'} · {r.date < today ? `due ${shortDate(r.date)}, overdue` : `due ${shortDate(r.date)}`}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {notable.length > 0 && (
            <section className={styles.panel} aria-label="Unusually large">
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}><Sparkles size={14} aria-hidden /> Out of the ordinary</h2>
                <span className={styles.panelSub}>{settings.largeMultiple}× your typical payment or more</span>
              </div>
              <div className={styles.rows}>
                {notable.slice(0, 4).map((r) => (
                  <button key={r.id} type="button" className={styles.row} onClick={() => onOpen(r.id)}>
                    <span className={styles.rowName}>{r.description}</span>
                    <span className={styles.rowValue}>{lei(r.amountRon)}</span>
                    <span className={styles.rowMeta}>{shortDate(r.date)} · {data.clients.find((c) => c.id === r.clientId)?.name ?? '—'}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  )
}
