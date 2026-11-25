/**
 * Every payment, newest first, grouped by month. Search reads description,
 * notes and the client, source and venue names; the filters are the same ones
 * a report row drills down into.
 */
import { useMemo, useState } from 'react'
import { AlertTriangle, Download, Repeat, X } from 'lucide-react'
import { Button } from '../../ds'
import { useInflow, EMPTY_FILTER, type IncomeFilter } from '../app/state'
import { usePeriodData } from '../app/usePeriod'
import { SelectInput } from '../components/fields'
import type { IncomeRecord, InflowData } from '../domain/types'
import { ACTIVITY, TAX_HANDLING, TAXABILITY, VAT_SHORT, options } from '../domain/vocabulary'
import { breakdown, DIMENSION_NOUN, largeRecordIds, NO_ENTITY, sum, type Dimension } from '../lib/analytics'
import { ShareBar } from '../components/charts'
import { BackBar } from '../components/BackBar'
import { readJson, writeJson } from '../../shared/storage'
import { monthLabel, monthShort, parseDate, weekdayShort } from '../lib/dates'
import { lei, money } from '../lib/money'
import { inRange } from '../lib/period'
import { download, recordsCsv } from '../store/backup'
import styles from '../styles/ui.module.css'

export function applyFilter(data: InflowData, f: IncomeFilter, range: { from: string; to: string }): IncomeRecord[] {
  const q = f.query.trim().toLowerCase()
  const name = (list: { id: string; name: string }[], id: string | null) => list.find((x) => x.id === id)?.name ?? ''
  const match = (field: string | null, want: string) => !want || (want === NO_ENTITY ? !field : field === want)
  return data.records
    .filter((r) => f.range === 'all' || inRange(r.date, range))
    .filter((r) => match(r.clientId, f.clientId) && match(r.sourceId, f.sourceId) && match(r.venueId, f.venueId) && match(r.category, f.activity))
    .filter((r) => !f.taxability || r.taxability === f.taxability)
    .filter((r) => !f.status || (f.status === 'suggested' ? r.classification === 'suggested' : r.status === f.status))
    .filter((r) => !q || [r.description, r.notes, name(data.clients, r.clientId), name(data.sources, r.sourceId), name(data.venues, r.venueId), r.currency]
      .some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.amountRon - a.amountRon)
}

export function Income({ onOpen }: { onOpen: (id: string) => void }) {
  const { data, filter, setFilter, settings, today, on } = useInflow()
  const { range } = usePeriodData()
  const [showFilters, setShowFilters] = useState(false)
  // Expected payments switched off: they leave the list too, not just the label.
  const showExpected = on('expected')
  const list = useMemo(() => applyFilter(data, filter, range).filter((r) => showExpected || r.status !== 'expected'), [data, filter, range, showExpected])
  const showUnusual = on('unusual')
  const large = useMemo(() => (showUnusual ? largeRecordIds(data.records, settings.largeMultiple) : new Set<string>()), [showUnusual, data.records, settings.largeMultiple])
  const set = (patch: Partial<IncomeFilter>) => setFilter({ ...filter, ...patch })

  // Expected payments get their own group on top; the months hold what was received.
  const groups = useMemo(() => {
    const m = new Map<string, IncomeRecord[]>()
    const expected = list.filter((r) => r.status === 'expected').sort((a, b) => a.date.localeCompare(b.date))
    for (const r of list) if (r.status === 'received') m.set(r.date.slice(0, 7), [...(m.get(r.date.slice(0, 7)) ?? []), r])
    return [...(expected.length ? [['expected', expected] as [string, IncomeRecord[]]] : []), ...m.entries()]
  }, [list])

  const name = (l: { id: string; name: string }[], id: string | null) => l.find((x) => x.id === id)?.name
  const active: [keyof IncomeFilter, string][] = []
  if (filter.clientId) active.push(['clientId', filter.clientId === NO_ENTITY ? 'No client' : name(data.clients, filter.clientId) ?? 'Client'])
  if (filter.sourceId) active.push(['sourceId', filter.sourceId === NO_ENTITY ? 'No source' : name(data.sources, filter.sourceId) ?? 'Source'])
  if (filter.venueId) active.push(['venueId', filter.venueId === NO_ENTITY ? 'No venue' : name(data.venues, filter.venueId) ?? 'Venue'])
  if (filter.activity) active.push(['activity', filter.activity === NO_ENTITY ? 'No activity' : ACTIVITY[filter.activity as keyof typeof ACTIVITY]])
  if (filter.taxability) active.push(['taxability', TAXABILITY[filter.taxability as keyof typeof TAXABILITY]])
  if (filter.status) active.push(['status', filter.status === 'suggested' ? 'Unconfirmed tax' : filter.status === 'expected' ? 'Expected' : 'Received'])

  const receivedTotal = sum(list.filter((r) => r.status === 'received'))

  return (
    <>
      <BackBar />
      <div className={styles.toolbar}>
        <input className={styles.search} type="search" placeholder="Search payments, clients, venues…" value={filter.query}
          onChange={(e) => set({ query: e.target.value })} aria-label="Search income" />
        <Button size="sm" variant={showFilters ? 'primary' : 'secondary'} onClick={() => setShowFilters((s) => !s)}>Filters{active.length ? ` (${active.length})` : ''}</Button>
      </div>
      <div className={styles.chips}>
        <button type="button" className={`${styles.chip} ${filter.range === 'all' ? styles.chipOn : ''}`} onClick={() => set({ range: 'all' })}>All time</button>
        <button type="button" className={`${styles.chip} ${filter.range === 'period' ? styles.chipOn : ''}`} onClick={() => set({ range: 'period' })}>{range.label}</button>
        {active.map(([k, label]) => (
          <button key={k} type="button" className={`${styles.chip} ${styles.chipOn}`} onClick={() => set({ [k]: '' })} aria-label={`Remove filter ${label}`}>
            {label} <X size={12} aria-hidden />
          </button>
        ))}
        {(active.length > 0 || filter.query) && (
          <button type="button" className={styles.chip} onClick={() => setFilter({ ...EMPTY_FILTER, range: filter.range })}>Clear</button>
        )}
      </div>
      {showFilters && (
        <section className={styles.panel}>
          <div className={styles.formRow}>
            <SelectInput label="Client" value={filter.clientId} onChange={(v) => set({ clientId: v })}>
              <option value="">Any</option>
              {[...data.clients].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value={NO_ENTITY}>No client</option>
            </SelectInput>
            <SelectInput label="Source" value={filter.sourceId} onChange={(v) => set({ sourceId: v })}>
              <option value="">Any</option>
              {data.sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value={NO_ENTITY}>No source</option>
            </SelectInput>
            <SelectInput label="Venue" value={filter.venueId} onChange={(v) => set({ venueId: v })}>
              <option value="">Any</option>
              {data.venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              <option value={NO_ENTITY}>No venue</option>
            </SelectInput>
            <SelectInput label="Activity" value={filter.activity} onChange={(v) => set({ activity: v })}>
              <option value="">Any</option>
              {options(ACTIVITY).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              <option value={NO_ENTITY}>No activity</option>
            </SelectInput>
            {settings.features.tax && <SelectInput label="Tax" value={filter.taxability} onChange={(v) => set({ taxability: v })}>
              <option value="">Any</option>
              <option value="taxable">Taxable</option>
              <option value="non_taxable">Non-taxable</option>
              <option value="review">Needs review</option>
            </SelectInput>}
            <SelectInput label="Status" value={filter.status} onChange={(v) => set({ status: v })}>
              <option value="">Any</option>
              <option value="received">Received</option>
              {showExpected && <option value="expected">Expected</option>}
              {settings.features.tax && <option value="suggested">Tax not yet confirmed</option>}
            </SelectInput>
          </div>
        </section>
      )}

      <div className={styles.panelHead} style={{ marginBottom: 0 }}>
        <span className={styles.panelSub}>{list.length} {list.length === 1 ? 'payment' : 'payments'} · {lei(receivedTotal)} received</span>
        {list.length > 0 && (
          <button type="button" className={styles.linkButton} onClick={() => download(`inflow-income-${today}.csv`, recordsCsv(list, data), 'text/csv')}>
            <Download size={12} aria-hidden /> CSV
          </button>
        )}
      </div>

      {receivedTotal > 0 && <WhereFrom list={list.filter((r) => r.status === 'received')} data={data} onPick={(patch) => set(patch)} />}

      {list.length === 0 ? (
        <div className={styles.empty}>
          {data.records.length === 0 ? 'No income yet. Tap “Add income” to record your first payment.' : 'Nothing matches these filters.'}
        </div>
      ) : groups.map(([month, rs]) => (
        <div key={month} className={styles.group}>
          <div className={styles.groupHead}>
            <span>{month === 'expected' ? 'Expected' : monthLabel(`${month}-01`)}</span>
            <span className="num">{month === 'expected' ? `${lei(sum(rs))} to come` : lei(sum(rs))}</span>
          </div>
          {rs.map((r) => <EntryRow key={r.id} r={r} data={data} large={large.has(r.id)} today={today} onOpen={onOpen} tax={settings.features.tax} currencies={on('currencies')} />)}
        </div>
      ))}
    </>
  )
}

const PICK: Record<Dimension, keyof IncomeFilter> = { client: 'clientId', source: 'sourceId', venue: 'venueId', activity: 'activity' }

/** Where the income in this list came from: one bar, its largest parts, tap one to narrow the list. */
function WhereFrom({ list, data, onPick }: { list: IncomeRecord[]; data: InflowData; onPick: (patch: Partial<IncomeFilter>) => void }) {
  const [dim, setDim] = useState<Dimension>(() => readJson<Dimension>('inflow:income-split', 'source'))
  const parts = useMemo(() => breakdown(data, list, [], dim).map((r) => ({ id: r.id, name: r.name, value: r.total })), [data, list, dim])
  return (
    <section className={styles.panel} aria-label="Where it came from">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Where it came from</h2>
        <select className={styles.inlineSelect} value={dim} aria-label="Split by"
          onChange={(e) => { const v = e.target.value as Dimension; setDim(v); writeJson('inflow:income-split', v) }}>
          {(['source', 'client', 'venue', 'activity'] as Dimension[]).map((x) => <option key={x} value={x}>by {DIMENSION_NOUN[x].toLowerCase()}</option>)}
        </select>
      </div>
      <ShareBar parts={parts} label={`Income by ${DIMENSION_NOUN[dim].toLowerCase()}`} max={4}
        onSelect={(id) => onPick({ [PICK[dim]]: id })} />
    </section>
  )
}

function EntryRow({ r, data, large, today, onOpen, tax, currencies }: { r: IncomeRecord; data: InflowData; large: boolean; today: string; onOpen: (id: string) => void; tax: boolean; currencies: boolean }) {
  const client = data.clients.find((c) => c.id === r.clientId)?.name
  const venue = data.venues.find((v) => v.id === r.venueId)?.name
  const activity = r.category ? ACTIVITY[r.category] : null
  const taxClass = r.taxability === 'taxable' ? styles.tagTax : r.taxability === 'non_taxable' ? styles.tagNon : styles.tagReview
  return (
    <button type="button" className={styles.entry} onClick={() => onOpen(r.id)} aria-label={`${r.description}, ${money(r.amount, r.currency)}, ${r.date}`}>
      <span className={styles.entryDate}>
        <span className={styles.entryDay}>{parseDate(r.date).getDate()}</span>
        <span className={styles.entryDow}>{r.status === 'expected' ? monthShort(r.date) : weekdayShort(r.date)}</span>
      </span>
      <span style={{ minWidth: 0 }}>
        <span className={styles.entryTitle} style={{ display: 'block' }}>{r.description}</span>
        <span className={styles.entrySub} style={{ display: 'block' }}>{[client, venue, activity].filter(Boolean).join(' · ') || '—'}</span>
        <span className={styles.tags}>
          {r.status === 'expected' && (
            <span className={`${styles.tag} ${styles.tagAlert}`}>{r.date < today ? 'Overdue' : 'Expected'}</span>
          )}
          {tax && <>
          <span className={`${styles.tag} ${taxClass} ${r.classification === 'suggested' ? styles.tagSuggested : ''}`}
            title={r.classification === 'suggested' ? 'Suggested, not yet confirmed' : 'Confirmed'}>
            {TAXABILITY[r.taxability]}{r.taxability === 'taxable' ? ` · ${TAX_HANDLING[r.taxHandling].toLowerCase()}` : ''}{r.classification === 'suggested' ? ' ?' : ''}
          </span>
          <span className={styles.tag}>{VAT_SHORT[r.vat]}</span>
          </>}
          {r.recurring && <span className={styles.tag}><Repeat size={10} aria-hidden /> recurring</span>}
          {large && <span className={`${styles.tag} ${styles.tagAlert}`}><AlertTriangle size={10} aria-hidden /> unusually large</span>}
        </span>
      </span>
      <span className={styles.entryAmount}>
        <span className={styles.entryAmountMain} style={{ display: 'block' }}>{currencies ? money(r.amount, r.currency) : lei(r.amountRon)}</span>
        {currencies && r.currency !== 'RON' && <span className={styles.entryAmountSub} style={{ display: 'block' }}>{lei(r.amountRon)}</span>}
        {tax && r.taxReserve !== null && r.taxReserve > 0 && <span className={styles.entryAmountSub} style={{ display: 'block' }}>set aside {lei(r.taxReserve)}</span>}
      </span>
    </button>
  )
}
