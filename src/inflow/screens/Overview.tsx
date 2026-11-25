/**
 * The 20-second screen: how much came in and how it's moving, what's worth
 * a look, where it came from, and what's still to come. Profit, tax detail and
 * unusual payments live in Reports and Income.
 */
import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, CalendarClock, CalendarPlus, Check, Copy, DoorOpen, HardDriveDownload, Plus, Info, Lightbulb, PieChart, Receipt, Sparkles, TrendingUp } from 'lucide-react'
import { SegmentedControl } from '../../ds'
import { DIM_FILTER, EMPTY_FILTER, useInflow } from '../app/state'
import { usePeriodData } from '../app/usePeriod'
import { TrendChart } from '../components/charts'
import { Donut } from '../components/Donut'
import { useCountUp } from '../components/useCountUp'
import {
  asExpected, breakdown, concentration, NO_ENTITY, outstanding, series, suggestExpected, sum, type Dimension,
} from '../lib/analytics'
import { daysBetween, shortDate, yearOf } from '../lib/dates'
import { delta, lei, money, percent } from '../lib/money'
import { alignedPrevious, buckets, type Bucket } from '../lib/period'
import { suggestReserve } from '../tax/estimate'
import { insights } from '../lib/insights'
import { InsightList } from '../components/insightsUi'
import { useInsightFeedback } from '../app/insightFeedback'
import type { IncomeRecord } from '../domain/types'
import { readJson, writeJson } from '../../shared/storage'
import { download, makeBackup } from '../store/backup'
import { LAST_BACKUP_KEY } from './Settings'
import { ALL_FEATURES } from '../store/settings'
import styles from '../styles/ui.module.css'

/** The reminder "Remind" copies: short, friendly, with what, how much and when. */
export function reminderText(r: Pick<IncomeRecord, 'description' | 'amount' | 'currency' | 'date'>, clientName: string, today: string): string {
  const hello = clientName ? `Hello ${clientName},` : 'Hello,'
  const when = r.date < today ? `which was due on ${shortDate(r.date, 0)}` : `due on ${shortDate(r.date, 0)}`
  return `${hello}\n\nA gentle reminder about the payment for ${r.description} (${money(r.amount, r.currency)}), ${when}. If it's already on its way, thank you, and please ignore this.\n\nAll the best`
}

function granularity(bs: Bucket[]): string {
  const widest = Math.max(...bs.map((b) => daysBetween(b.from, b.to) + 1))
  // What one bar holds, so a custom range's chart reads plainly: its bars are days, weeks or months of it.
  return widest === 1 ? 'one bar a day' : widest <= 7 ? 'one bar a week' : 'one bar a month'
}

const DISMISSED_KEY = 'inflow:suggest-dismissed'

const DIMS: { value: Dimension; label: string }[] = [
  { value: 'client', label: 'Clients' },
  { value: 'source', label: 'Sources' },
  { value: 'venue', label: 'Venues' },
  { value: 'activity', label: 'Activities' },
]


export function Overview({ onOpen, onAddCost, onAdd }: { onOpen: (id: string) => void; onAddCost: () => void; onAdd?: () => void }) {
  const { data, settings, today, setFilter, saveRecord, toast, on, loadDemo, period } = useInflow()
  const { range, prev, prevWhole, cur, before, summary, prevSummary } = usePeriodData()
  const [dim, setDim] = useState<Dimension>('client')
  const go = (patch: Partial<typeof EMPTY_FILTER>) => { setFilter({ ...EMPTY_FILTER, ...patch }); location.hash = '#/income' }
  const costsForTax = useMemo(() => (settings.features.costs ? data.costs : []), [settings.features.costs, data.costs])

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
  const owed = on('expected') ? outstanding(data.records, today) : { total: 0, count: 0, overdue: 0, records: [] }
  // Next month's payment from a recurring client, offered once nothing is expected from them yet.
  const [dismissed, setDismissed] = useState(() => new Set(readJson<string[]>(DISMISSED_KEY, [])))
  const suggested = useMemo(() => (on('expected') ? suggestExpected(data.records, today, dismissed) : []), [on, data.records, today, dismissed])
  const dismiss = (key: string) => {
    const next = new Set(dismissed).add(key)
    setDismissed(next)
    // Only the recent ones matter: a key carries its date, and old dates never come back.
    writeJson(DISMISSED_KEY, [...next].slice(-40))
  }
  const addSuggested = async (s: (typeof suggested)[number]) => {
    // The last amount is a guess for a payout that varies: Edit opens it straight away.
    const saved = await saveRecord(asExpected(s))
    if (saved) toast({ message: `Expected on ${shortDate(s.date)}: ${money(s.from.amount, s.from.currency)}`, tone: 'success', actionLabel: 'Edit', onAction: () => onOpen(saved.id) })
  }
  const all = useMemo(() => (on('insights') ? insights(data, range, today, { deals: on('deals'), costs: on('costs'), expected: on('expected'), tax: on('tax') }) : []), [on, data, range, today])
  const fb = useInsightFeedback()
  const top = fb.apply(all)

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
  // The monthly target, for periods it fits: a month, or a year as twelve of them. A week or a custom range has none.
  const target = settings.monthlyTarget
  const targetFor = target <= 0 ? 0 : period.preset === 'month' || period.preset === 'last_month' ? target : period.preset === 'year' ? target * 12 : 0
  const recurringTotal = sum(cur.filter((r) => r.recurring))
  const recurringShare = summary.total > 0 ? recurringTotal / summary.total : 0

  // A first run with nothing recorded: a few steps in, not a dashboard of zeros.
  if (data.records.length === 0) return <><SimpleStartNotice /><StartHere onAdd={onAdd} onAddCost={on('costs') ? onAddCost : undefined} onDemo={() => void loadDemo()} hasVenues={data.venues.length > 0} /></>

  return (
    <>
      <SimpleStartNotice />
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
        {targetFor > 0 && (
          <div className={styles.heroTarget}>
            <div className={styles.progress} role="progressbar" aria-label="Target" aria-valuenow={Math.round((summary.total / targetFor) * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className={styles.progressFill} style={{ width: `${Math.min(100, (summary.total / targetFor) * 100)}%` }} />
            </div>
            <span className={styles.statNote}>{percent(summary.total / targetFor)} of {lei(targetFor)} {period.preset === 'year' ? 'yearly target (12 × monthly)' : 'monthly target'}</span>
          </div>
        )}
        <div className={styles.stats}>
          {on('tax') ? (
            <>
              <div className={styles.stat}>
                <div className={styles.statLabel}>Set aside for tax</div>
                <div className={styles.statValue}>{lei(summary.reserve)}</div>
                <div className={styles.statNote}>{summary.taxWithheld > 0 ? `+ ${lei(summary.taxWithheld)} withheld` : 'nothing withheld'}</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statLabel}>Estimated net</div>
                <div className={styles.statValue}>{lei(summary.net)}</div>
                <div className={styles.statNote}>after reserve and withheld tax</div>
              </div>
            </>
          ) : (
            <>
              <div className={styles.stat}>
                <div className={styles.statLabel}>Average payment</div>
                <div className={styles.statValue}>{lei(summary.count ? summary.total / summary.count : 0)}</div>
                <div className={styles.statNote}>per payment</div>
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
              label={`Income by ${dim}`} onSelect={(id) => go({ [DIM_FILTER[dim]]: id })} />
          </div>
          {dim === 'client' && conc && conc.level !== 'healthy' && (
            <p className={styles.hint} style={{ marginTop: 'var(--space-sm)' }}>
              <Info size={12} aria-hidden /> {percent(conc.share)} of this period came from {conc.name}.
              {conc.level === 'high' ? ' That is a lot resting on one client.' : ' Worth keeping an eye on.'}
            </p>
          )}
        </section>

        {(owed.count > 0 || suggested.length > 0) && (
            <section className={styles.panel} aria-label="Expected payments">
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}><CalendarClock size={14} aria-hidden /> Expected</h2>
                {owed.count > 0 && <span className={styles.panelSub}>{lei(owed.total)}{owed.overdue ? ` · ${owed.overdue} overdue` : ''}</span>}
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
                {owed.count > 4 && <button type="button" className={styles.linkButton} onClick={() => go({ status: 'expected' })}>All {owed.count} expected →</button>}
              </div>
              {suggested.length > 0 && (
                <div className={styles.rows} aria-label="Suggested from recurring payments">
                  <p className={styles.hint} style={{ margin: 'var(--space-sm) 0 0' }}>Recurring clients with nothing expected yet:</p>
                  {suggested.slice(0, 3).map((x) => {
                    const who = data.clients.find((c) => c.id === x.from.clientId)?.name ?? x.from.description
                    return (
                      <div key={x.key} className={styles.expectedRow}>
                        <div className={`${styles.row} ${styles.suggestRow}`}>
                          <span className={styles.rowName}>{who}</span>
                          <span className={styles.rowValue}>{money(x.from.amount, x.from.currency)}</span>
                          <span className={styles.rowMeta}>{x.from.description} · around {shortDate(x.date)}</span>
                        </div>
                        <div className={styles.expectedActions}>
                          <button type="button" className={styles.chip} onClick={() => void addSuggested(x)} aria-label={`Expect ${who} on ${shortDate(x.date)}`}>
                            <CalendarPlus size={12} aria-hidden /> Expect it
                          </button>
                          <button type="button" className={styles.chip} onClick={() => dismiss(x.key)} aria-label={`Not this time for ${who}`}>
                            Not this time
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )}
      </div>
    </>
  )
}

function StartHere({ onAdd, onAddCost, onDemo, hasVenues }: { onAdd?: () => void; onAddCost?: () => void; onDemo: () => void; hasVenues: boolean }) {
  const steps: { icon: typeof Check; title: string; note: string; action: string; run: () => void }[] = [
    { icon: Plus, title: 'Add a payment', note: 'The rest is remembered next time.', action: 'Add income', run: () => onAdd?.() },
    { icon: DoorOpen, title: hasVenues ? 'Check your rooms' : 'Add your rooms', note: 'With their fee or share.', action: 'Venues', run: () => { location.hash = '#/settings' } },
    ...(onAddCost ? [{ icon: Receipt, title: 'Record a cost', note: 'Room hire, software, the accountant.', action: 'Add cost', run: onAddCost }] : []),
    { icon: Sparkles, title: 'Or try the demo', note: 'Your data stays apart.', action: 'See the demo', run: onDemo },
  ]
  return (
    <section className={`${styles.panel} ${styles.startHere}`} aria-label="Start here">
      <h2 className={styles.reviewTitle}>Start here</h2>
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

/**
 * A new user starts simple. Say so once, plainly, with the two ways on:
 * everything at once, or choosing in Settings → Features. Gone once dismissed
 * or once any feature is switched.
 */
function SimpleStartNotice() {
  const { settings, updateSettings } = useInflow()
  if (!settings.simpleStartNotice) return null
  return (
    <section className={`${styles.panel} ${styles.simpleNotice}`} aria-label="Simple start">
      <div className={styles.simpleHead}>
        <span className={styles.hlIcon + ' ' + styles.hl_neutral} aria-hidden><Sparkles size={18} /></span>
        <div>
          <b>You're on a simple start</b>
          <span>Income, where it comes from, insights and expected payments. Costs, tax, venue deals, currencies and printing are off until you want them.</span>
        </div>
      </div>
      <div className={styles.buttonRow}>
        <button type="button" className={styles.chip} onClick={() => updateSettings({ features: ALL_FEATURES, simpleStartNotice: false })}>Turn everything on</button>
        <a className={styles.chip} href="#/settings" onClick={() => updateSettings({ simpleStartNotice: false })}>Choose features</a>
        <button type="button" className={styles.chip} onClick={() => updateSettings({ simpleStartNotice: false })}>Got it</button>
      </div>
    </section>
  )
}
