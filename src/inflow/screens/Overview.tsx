/**
 * The 20-second screen: how much came in, from where, how it's moving, what
 * was kept after costs (optional), how much of it is taxable, what's been
 * withheld and what to put aside (optional).
 */
import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, CalendarClock, Check, Copy, DoorOpen, HardDriveDownload, Plus, Info, Lightbulb, PieChart, Receipt, Repeat, Scale, Sparkles, TrendingUp } from 'lucide-react'
import { SegmentedControl } from '../../ds'
import { EMPTY_FILTER, useInflow } from '../app/state'
import { usePeriodData } from '../app/usePeriod'
import { SplitBar, TrendChart } from '../components/charts'
import { Donut } from '../components/Donut'
import { useCountUp } from '../components/useCountUp'
import { Optional } from '../components/Optional'
import {
  breakdown, concentration, largeRecordIds, NO_ENTITY, outstanding, received, series, sum, type Dimension,
} from '../lib/analytics'
import { addDays, daysBetween, endOfMonth, shortDate, startOfMonth, startOfWeek, yearOf } from '../lib/dates'
import { delta, lei, money, percent } from '../lib/money'
import { alignedPrevious, buckets, type Bucket } from '../lib/period'
import { projectYear, suggestReserve } from '../tax/estimate'
import { breakEven, buildPnl } from '../lib/finance'
import { insights } from '../lib/insights'
import { InsightList } from '../components/insightsUi'
import { useInsightFeedback } from '../app/insightFeedback'
import type { IncomeRecord } from '../domain/types'
import { readJson, writeJson } from '../../shared/storage'
import { download, makeBackup } from '../store/backup'
import { LAST_BACKUP_KEY } from './Settings'
import styles from '../styles/ui.module.css'

/** The reminder "Remind" copies: short, friendly, with what, how much and when. */
export function reminderText(r: Pick<IncomeRecord, 'description' | 'amount' | 'currency' | 'date'>, clientName: string, today: string): string {
  const hello = clientName ? `Hello ${clientName},` : 'Hello,'
  const when = r.date < today ? `which was due on ${shortDate(r.date, 0)}` : `due on ${shortDate(r.date, 0)}`
  return `${hello}\n\nA gentle reminder about the payment for ${r.description} (${money(r.amount, r.currency)}), ${when}. If it's already on its way, thank you, and please ignore this.\n\nAll the best`
}

function granularity(bs: Bucket[]): string {
  const widest = Math.max(...bs.map((b) => daysBetween(b.from, b.to) + 1))
  return widest === 1 ? 'per day' : widest <= 7 ? 'per week' : 'per month'
}

const DIMS: { value: Dimension; label: string }[] = [
  { value: 'client', label: 'Clients' },
  { value: 'source', label: 'Sources' },
  { value: 'venue', label: 'Venues' },
  { value: 'activity', label: 'Activities' },
]

const FILTER_KEY: Record<Dimension, 'clientId' | 'sourceId' | 'venueId' | 'activity'> = { client: 'clientId', source: 'sourceId', venue: 'venueId', activity: 'activity' }

export function Overview({ onOpen, onAddCost, onAdd }: { onOpen: (id: string) => void; onAddCost: () => void; onAdd?: () => void }) {
  const { data, settings, today, setFilter, saveRecord, toast, on, loadDemo } = useInflow()
  const { range, prev, prevWhole, cur, before, summary, prevSummary } = usePeriodData()
  const [dim, setDim] = useState<Dimension>('client')
  const go = (patch: Partial<typeof EMPTY_FILTER>) => { setFilter({ ...EMPTY_FILTER, range: 'period', ...patch }); location.hash = '#/income' }
  const costsForTax = useMemo(() => (settings.features.costs ? data.costs : []), [settings.features.costs, data.costs])

  const week = sum(received(data.records, { from: startOfWeek(today), to: addDays(startOfWeek(today), 6) }))
  const month = sum(received(data.records, { from: startOfMonth(today), to: endOfMonth(today) }))
  const d = delta(summary.total, prevSummary.total)
  const heroTotal = useCountUp(summary.total)

  const chart = useMemo(() => {
    const bs = buckets(range)
    const pb = alignedPrevious(bs, prevWhole)
    return { bs, current: series(data.records, bs), previous: series(data.records, pb) }
  }, [data.records, range, prevWhole])

  const rows = useMemo(() => breakdown(data, cur, before, dim), [data, cur, before, dim])
  const clientRows = useMemo(() => breakdown(data, cur, before, 'client'), [data, cur, before])
  const conc = concentration(clientRows)
  const showUnusual = on('unusual')
  const large = useMemo(() => (showUnusual ? largeRecordIds(data.records, settings.largeMultiple) : new Set<string>()), [showUnusual, data.records, settings.largeMultiple])
  const notable = cur.filter((r) => large.has(r.id))
  const owed = on('expected') ? outstanding(data.records, today) : { total: 0, count: 0, overdue: 0, records: [] }
  // Tax off: no projection is computed at all.
  const taxOn = on('tax')
  const projection = useMemo(() => (taxOn ? projectYear(settings.tax, data.records, yearOf(range.to > today ? today : range.to), today, 0, costsForTax) : null), [taxOn, settings.tax, data.records, range.to, today, costsForTax])
  const all = useMemo(() => (on('insights') ? insights(data, range, today, { deals: on('deals'), costs: on('costs'), expected: on('expected') }) : []), [on, data, range, today])
  const fb = useInsightFeedback()
  const top = fb.apply(all)
  const pnl = useMemo(() => (settings.features.costs ? buildPnl(data.records, data.costs, [{ from: range.from, to: range.to, label: '' }]) : null), [settings.features.costs, data, range])
  const pnlLine = (k: string) => pnl?.lines.find((l) => l.key === k)?.total ?? 0
  const be = useMemo(() => (settings.features.costs ? breakEven(data.records, data.costs, today) : null), [settings.features.costs, data, today])
  const costsDue = data.costs.filter((c) => c.status === 'due')

  // One tap when an expected payment lands: received today, with its tax reserve suggested.
  const markReceived = async (r: IncomeRecord) => {
    const others = data.records.filter((x) => x.id !== r.id)
    const next: IncomeRecord = { ...r, status: 'received', date: today }
    if (settings.features.tax && r.taxability === 'taxable' && r.taxReserve === null) {
      const s = suggestReserve(next, others, settings.tax, today, costsForTax)
      next.taxReserve = s.amount
      next.reserveSource = 'suggested'
      next.taxRules = s.rulesId
    }
    if (await saveRecord(next)) toast({ message: `Marked received: ${money(r.amount, r.currency)}`, tone: 'success' })
  }
  // A polite note for the client, ready to paste into a message or an email.
  const copyReminder = (r: IncomeRecord) => {
    const who = data.clients.find((c) => c.id === r.clientId)
    // A person is greeted by first name; a business without a name to greet.
    const text = reminderText(r, who?.kind === 'individual' ? who.name.split(' ')[0] : '', today)
    void navigator.clipboard?.writeText(text).then(
      () => toast({ message: 'Reminder copied: paste it into a message', tone: 'success' }),
      () => toast('Could not copy the reminder'),
    )
  }
  const target = settings.monthlyTarget
  const recurringTotal = sum(cur.filter((r) => r.recurring))
  const recurringShare = summary.total > 0 ? recurringTotal / summary.total : 0
  const currencies = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of cur) m.set(r.currency, (m.get(r.currency) ?? 0) + r.amountRon)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [cur])

  // A first run with nothing recorded: a few steps in, not a dashboard of zeros.
  if (data.records.length === 0) return <StartHere onAdd={onAdd} onAddCost={on('costs') ? onAddCost : undefined} onDemo={() => void loadDemo()} hasVenues={data.venues.length > 0} />

  return (
    <>
      <BackupNudge />
      <section className={`${styles.panel} ${styles.hero}`} aria-label="Income this period">
        <div>
          <div className={styles.heroLabel}>{range.label} · {shortDate(range.from)} – {shortDate(range.to, yearOf(today))}</div>
          <div className={styles.heroValue} data-testid="period-total">{lei(heroTotal)}</div>
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
            {target > 0 && on('targets') && (
              <>
                <div className={styles.progress} role="progressbar" aria-label="Monthly target" aria-valuenow={Math.round((month / target) * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className={styles.progressFill} style={{ width: `${Math.min(100, (month / target) * 100)}%` }} />
                </div>
                <div className={styles.statNote}>{percent(month / target)} of {lei(target)} target</div>
              </>
            )}
          </div>
          {taxOn ? (
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
          <h2 className={styles.panelTitle}><TrendingUp size={14} aria-hidden /> How it's moving</h2>
          <span className={styles.panelSub}>{granularity(chart.bs)}</span>
        </div>
        <TrendChart buckets={chart.bs} current={chart.current} previous={chart.previous} previousLabel={prevWhole.label} />
      </section>

      {top.length > 0 && (
        <section className={styles.panel} aria-label="Worth a look">
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}><Lightbulb size={14} aria-hidden /> Worth a look</h2>
            <a className={styles.linkButton} href="#/reports/insights">All insights</a>
          </div>
          <InsightList items={top} limit={3} feedback={fb}
            onHidden={(undo, what) => toast({ message: what, actionLabel: 'Undo', onAction: undo })} />
        </section>
      )}

      <div className={styles.grid2}>
        <section className={styles.panel} aria-label="Where it came from">
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}><PieChart size={14} aria-hidden /> Where it came from</h2>
          </div>
          <SegmentedControl size="sm" options={DIMS} value={dim} onChange={(v) => setDim(v as Dimension)} label="Break down by" />
          <div style={{ marginTop: 'var(--space-md)' }}>
            <Donut key={dim} parts={rows.map((r) => ({ id: r.id, name: r.name, value: r.total }))} caption={range.label.toLowerCase()}
              label={`Income by ${dim}`} onSelect={(id) => go({ [FILTER_KEY[dim]]: id })} />
          </div>
          {dim === 'client' && conc && conc.level !== 'healthy' && (
            <p className={styles.hint} style={{ marginTop: 'var(--space-sm)' }}>
              <Info size={12} aria-hidden /> {percent(conc.share)} of this period came from {conc.name}.
              {conc.level === 'high' ? ' That is a lot resting on one client.' : ' Worth keeping an eye on.'}
            </p>
          )}
        </section>

        {taxOn && projection ? (
        <section className={styles.panel} aria-label="Taxable or not">
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}><Receipt size={14} aria-hidden /> Taxable or not <Optional /></h2>
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
              {settings.tax.id === 'custom' ? 'Your own flat rate.'
                : projection.capped ? `Capped: on ${lei(projection.projected)} a year, fixed minimums would take ${percent(projection.rawRate)}. See the Tax report.`
                  : `At ${lei(projection.projected)} of taxable income for ${projection.year}. Estimate, not advice.`}
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
            <h2 className={styles.panelTitle}><Repeat size={14} aria-hidden /> Regular or one-off</h2>
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

        {pnl && (
          <section className={styles.panel} aria-label="What you kept">
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}><Scale size={14} aria-hidden /> What you kept</h2>
              <button type="button" className={styles.linkButton} onClick={() => { location.hash = '#/reports/pnl' }}>P&L</button>
            </div>
            {data.costs.length === 0 ? (
              <p className={styles.hint}>Add your costs to see profit, margins per venue and your break-even. <button type="button" className={styles.linkButton} onClick={onAddCost}>Add a cost</button></p>
            ) : (
              <div className={styles.lineList}>
                <div className={styles.line}><span>Income received</span><span>{lei(pnlLine('revenue'))}</span></div>
                <div className={styles.line}><span>− Direct costs</span><span>{lei(pnlLine('direct'))}</span></div>
                <div className={styles.line}><span>− Operating costs</span><span>{lei(pnlLine('operating'))}</span></div>
                <div className={styles.line}><span>− Depreciation, interest, tax paid</span><span>{lei(pnlLine('depreciation') + pnlLine('interest') + pnlLine('tax'))}</span></div>
                <div className={`${styles.line} ${styles.lineTotal}`}>
                  <span>Net profit</span>
                  <span className={pnlLine('net') < 0 ? styles.down : undefined}>{lei(pnlLine('net'))}{pnlLine('revenue') > 0 ? ` · ${percent(pnlLine('net') / pnlLine('revenue'))}` : ''}</span>
                </div>
                {be && (
                  <>
                    <div className={styles.line} style={{ marginTop: 'var(--space-sm)' }}><span>Break-even each month</span><span>{lei(be.revenueNeeded)}</span></div>
                    <div className={styles.progress} role="progressbar" aria-label="Break-even this month" aria-valuenow={Math.round(be.covered * 100)} aria-valuemin={0} aria-valuemax={100}>
                      <div className={styles.progressFill} style={{ width: `${Math.min(100, be.covered * 100)}%`, background: be.covered < 1 ? 'var(--color-warning)' : undefined }} />
                    </div>
                    <span className={styles.lineNote}>
                      {be.covered >= 1 ? 'This month is past break-even. ' : `This month is at ${percent(be.covered)} of it. `}
                      Fixed costs average {lei(be.fixedPerMonth)} a month, and {percent(be.grossRate)} of each leu is left after direct costs.
                    </span>
                  </>
                )}
                {costsDue.length > 0 && (
                  <span className={styles.lineNote}>
                    <button type="button" className={styles.linkButton} onClick={() => { location.hash = '#/costs' }}>{costsDue.length} {costsDue.length === 1 ? 'cost' : 'costs'} to pay ({lei(costsDue.reduce((a, c) => a + c.amountRon, 0))}) →</button>
                  </span>
                )}
              </div>
            )}
          </section>
        )}
        {owed.count > 0 && (
            <section className={styles.panel} aria-label="Expected payments">
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}><CalendarClock size={14} aria-hidden /> Expected</h2>
                <span className={styles.panelSub}>{lei(owed.total)}{owed.overdue ? ` · ${owed.overdue} overdue` : ''}</span>
              </div>
              <div className={styles.rows}>
                {owed.records.slice(0, 4).map((r) => (
                  <div key={r.id} className={styles.expectedRow}>
                    <button type="button" className={styles.row} onClick={() => onOpen(r.id)}>
                      <span className={styles.rowName}>{r.description}</span>
                      <span className={styles.rowValue}>{money(r.amount, r.currency)}</span>
                      <span className={styles.rowMeta} style={r.date < today ? { color: 'var(--color-warning)' } : undefined}>
                        {data.clients.find((c) => c.id === r.clientId)?.name ?? '—'} · {r.date < today ? `due ${shortDate(r.date)}, overdue` : `due ${shortDate(r.date)}`}
                      </span>
                    </button>
                    <div className={styles.expectedActions}>
                      <button type="button" className={styles.chip} onClick={() => void markReceived(r)} aria-label={`Mark ${r.description} received`}>
                        <Check size={12} aria-hidden /> Received
                      </button>
                      <button type="button" className={styles.chip} onClick={() => copyReminder(r)} aria-label={`Copy a reminder for ${r.description}`}>
                        <Copy size={12} aria-hidden /> Remind
                      </button>
                    </div>
                  </div>
                ))}
                {owed.count > 4 && <button type="button" className={styles.linkButton} onClick={() => go({ status: 'expected', range: 'all' })}>All {owed.count} expected →</button>}
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
    </>
  )
}

function StartHere({ onAdd, onAddCost, onDemo, hasVenues }: { onAdd?: () => void; onAddCost?: () => void; onDemo: () => void; hasVenues: boolean }) {
  const steps: { icon: typeof Check; title: string; note: string; action: string; run: () => void }[] = [
    { icon: Plus, title: 'Add your first payment', note: 'Amount and client; the rest is remembered next time.', action: 'Add income', run: () => onAdd?.() },
    { icon: DoorOpen, title: hasVenues ? 'Check your venues' : 'Add the rooms you work in', note: 'With their deal: a fee per session or a share.', action: 'Venues', run: () => { location.hash = '#/settings' } },
    ...(onAddCost ? [{ icon: Receipt, title: 'Record a cost', note: 'Room hire, software, the accountant.', action: 'Add cost', run: onAddCost }] : []),
    { icon: Sparkles, title: 'Not sure where to start?', note: 'Look round the demo practice; your data stays apart.', action: 'See the demo', run: onDemo },
  ]
  return (
    <section className={`${styles.panel} ${styles.startHere}`} aria-label="Start here">
      <div className={styles.eyebrow}>Start here</div>
      <h2 className={styles.reviewTitle}>Nothing recorded yet</h2>
      <ol className={styles.startSteps}>
        {steps.map((s, i) => (
          <li key={s.title}>
            <span className={styles.startNum}>{i + 1}</span>
            <span className={styles.startText}><b>{s.title}</b><span>{s.note}</span></span>
            <button type="button" className={styles.chip} onClick={s.run}><s.icon size={13} aria-hidden /> {s.action}</button>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * Your data on this device lives in this browser only. When a month has gone
 * by without a backup (or there has never been one), one line offers it.
 */
function BackupNudge() {
  const { data, settings, workspace, today, toast } = useInflow()
  const [last, setLast] = useState(() => readJson<string>(LAST_BACKUP_KEY, ''))
  if (workspace !== 'mine' || settings.mode !== 'device' || data.records.length < 5) return null
  if (last && daysBetween(last, today) < 30) return null
  const save = () => {
    download(`inflow-backup-${today}.json`, JSON.stringify(makeBackup(data, settings), null, 2), 'application/json')
    writeJson(LAST_BACKUP_KEY, today)
    setLast(today)
    toast({ message: 'Backup downloaded', tone: 'success' })
  }
  return (
    <div className={`${styles.banner} ${styles.bannerInfo}`} role="status">
      <span><HardDriveDownload size={14} aria-hidden /> {last ? `Last backup ${daysBetween(last, today)} days ago.` : 'No backup yet.'} Your data is only in this browser.</span>
      <button type="button" className={styles.linkButton} onClick={save}>Download backup</button>
    </div>
  )
}
