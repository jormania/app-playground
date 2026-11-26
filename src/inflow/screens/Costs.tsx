/**
 * Every cost, newest first, grouped by month, with unpaid ones on top. The
 * filters are the same dimensions as income (venue, client, activity) plus
 * the kind of cost.
 */
import { useMemo, useState } from 'react'
import { Download, PieChart, Repeat, X } from 'lucide-react'
import { Button } from '../../ds'
import { useInflow } from '../app/state'
import { usePeriodData } from '../app/usePeriod'
import { SelectInput } from '../components/fields'
import type { CostRecord, InflowData } from '../domain/types'
import { ACTIVITY, COST_CATEGORY, COST_GROUP, COST_GROUP_PLAIN, options } from '../domain/vocabulary'
import { NO_ENTITY } from '../lib/analytics'
import { monthLabel, monthShort, parseDate, shortDate, weekdayShort } from '../lib/dates'
import { recurringCostsMissing } from '../lib/finance'
import { lei, money, round2 } from '../lib/money'
import { costsCsv, download } from '../store/backup'
import { Donut } from '../components/Donut'
import { ListEnd } from '../components/ListEnd'
import { readJson, writeJson } from '../../shared/storage'
import { ClientPicker } from '../components/ClientPicker'
import styles from '../styles/ui.module.css'

export interface CostFilter {
  query: string
  group: string
  venueId: string
  clientId: string
  activity: string
  status: string
}

export const EMPTY_COST_FILTER: CostFilter = { query: '', group: '', venueId: '', clientId: '', activity: '', status: '' }

export function applyCostFilter(data: InflowData, f: CostFilter, range: { from: string; to: string }): CostRecord[] {
  const q = f.query.trim().toLowerCase()
  const name = (l: { id: string; name: string }[], id: string | null) => l.find((x) => x.id === id)?.name ?? ''
  const match = (field: string | null, want: string) => !want || (want === NO_ENTITY ? !field : field === want)
  return data.costs
    // The selected period is the list's range; costs still due show whenever they fall due.
    .filter((c) => (c.date >= range.from && c.date <= range.to) || c.status === 'due')
    .filter((c) => !f.group || c.group === f.group)
    .filter((c) => match(c.venueId, f.venueId) && match(c.clientId, f.clientId) && match(c.activity, f.activity))
    .filter((c) => !f.status || c.status === f.status)
    .filter((c) => !q || [c.description, c.notes, COST_CATEGORY[c.category], name(data.venues, c.venueId), name(data.clients, c.clientId)]
      .some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.amountRon - a.amountRon)
}

const sumRon = (cs: CostRecord[]) => round2(cs.reduce((s, c) => s + c.amountRon, 0))

type CostSplit = 'group' | 'category' | 'venue'
const SPLIT_LABEL: Record<CostSplit, string> = { group: 'by kind', category: 'by category', venue: 'by venue' }

/** Where the money went, WhereItWent's question: one bar of the P&L costs in this list, its largest parts. */
function WhereWent({ costs, data, onPick, empty, onWiden }: { costs: CostRecord[]; data: InflowData; onPick: (patch: Partial<CostFilter>) => void; empty: string | null; onWiden: () => void }) {
  const [split, setSplit] = useState<CostSplit>(() => readJson<CostSplit>('inflow:cost-split', 'category'))
  const parts = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of costs) {
      const k = split === 'group' ? c.group : split === 'category' ? c.category : c.venueId ?? NO_ENTITY
      m.set(k, (m.get(k) ?? 0) + c.amountRon)
    }
    const nameOf = (k: string) => split === 'group' ? COST_GROUP_PLAIN[k as keyof typeof COST_GROUP_PLAIN]
      : split === 'category' ? COST_CATEGORY[k as keyof typeof COST_CATEGORY]
        : k === NO_ENTITY ? 'No venue (overheads)' : data.venues.find((v) => v.id === k)?.name ?? '—'
    return [...m.entries()].map(([id, value]) => ({ id, name: nameOf(id), value: round2(value) }))
  }, [costs, split, data.venues])
  return (
    <section className={styles.panel} aria-label="Where it went">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}><PieChart size={14} aria-hidden /> Where it went</h2>
        <select className={styles.inlineSelect} value={split} aria-label="Split by"
          onChange={(e) => { const v = e.target.value as CostSplit; setSplit(v); writeJson('inflow:cost-split', v) }}>
          {(Object.keys(SPLIT_LABEL) as CostSplit[]).map((k) => <option key={k} value={k}>{SPLIT_LABEL[k]}</option>)}
        </select>
      </div>
      {parts.length === 0 ? (
        <p className={styles.emptyNote}>
          Nothing paid {empty ?? 'for these filters'} yet.{' '}
          {empty && <button type="button" className={styles.linkButton} onClick={onWiden}>See the whole year</button>}
        </p>
      ) : <Donut key={split} parts={parts} caption="spent" label={`Costs ${SPLIT_LABEL[split]}`}
        onSelect={split === 'category' ? undefined : (id) => onPick(split === 'group' ? { group: id } : { venueId: id })} />}
      <p className={styles.hint} style={{ marginTop: 'var(--space-xs)' }}>Costs in the P&L only: equipment, loan repayments and drawings are left out.</p>
    </section>
  )
}

export function Costs({ onOpen, onCopy, filter, setFilter }: { onOpen: (id: string) => void; onCopy?: (id: string) => void; filter: CostFilter; setFilter: (f: CostFilter) => void }) {
  const { data, today, costsAvailable, setPeriod } = useInflow()
  // Costs a received reimbursement names as the one it repays.
  const reimbursed = useMemo(() => new Set(data.records.filter((r) => r.repaysCostId && r.status === 'received').map((r) => r.repaysCostId!)), [data.records])
  const { range } = usePeriodData()
  const [showFilters, setShowFilters] = useState(false)
  const list = useMemo(() => applyCostFilter(data, filter, range), [data, filter, range])
  const set = (patch: Partial<CostFilter>) => setFilter({ ...filter, ...patch })

  const groups = useMemo(() => {
    const due = list.filter((c) => c.status === 'due').sort((a, b) => a.date.localeCompare(b.date))
    const m = new Map<string, CostRecord[]>()
    for (const c of list) if (c.status === 'paid') m.set(c.date.slice(0, 7), [...(m.get(c.date.slice(0, 7)) ?? []), c])
    return [...(due.length ? [['due', due] as [string, CostRecord[]]] : []), ...m.entries()]
  }, [list])

  const paid = list.filter((c) => c.status === 'paid')
  const pnl = paid.filter((c) => !['investment', 'financing'].includes(c.group))
  const name = (l: { id: string; name: string }[], id: string) => l.find((x) => x.id === id)?.name ?? '—'
  const active: [keyof CostFilter, string][] = []
  if (filter.group) active.push(['group', COST_GROUP_PLAIN[filter.group as keyof typeof COST_GROUP_PLAIN]])
  if (filter.venueId) active.push(['venueId', filter.venueId === NO_ENTITY ? 'No venue' : name(data.venues, filter.venueId)])
  if (filter.clientId) active.push(['clientId', filter.clientId === NO_ENTITY ? 'No client' : name(data.clients, filter.clientId)])
  if (filter.activity) active.push(['activity', filter.activity === NO_ENTITY ? 'No activity' : ACTIVITY[filter.activity as keyof typeof ACTIVITY]])
  if (filter.status) active.push(['status', filter.status === 'due' ? 'Due' : 'Paid'])

  const missing = useMemo(() => recurringCostsMissing(data.costs, today), [data.costs, today])
  const exportCsv = () => download(`inflow-costs-${today}.csv`, costsCsv(list, data), 'text/csv')

  return (
    <>
      {!costsAvailable && (
        <div className={styles.banner} role="status">
          <span>Your Notion workspace has no “InFlow — Costs” database next to Income, so costs can't be saved there. Duplicate it from the Starter Template.</span>
        </div>
      )}
      {onCopy && missing.length > 0 && (
        <section className={styles.panel} aria-label="Usually paid by now">
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}><Repeat size={14} aria-hidden /> Usually paid by now</h2>
            <span className={styles.panelSub}>recurring, not yet this month</span>
          </div>
          <div className={styles.rows}>
            {missing.slice(0, 4).map((c) => (
              <div key={c.id} className={styles.expectedRow}>
                <div className={`${styles.row} ${styles.suggestRow}`}>
                  <span className={styles.rowName}>{c.description}</span>
                  <span className={styles.rowValue}>{money(c.amount, c.currency)}</span>
                  <span className={styles.rowMeta}>last on {shortDate(c.date)}</span>
                </div>
                <div className={styles.expectedActions}>
                  <button type="button" className={styles.chip} onClick={() => onCopy(c.id)} aria-label={`Add ${c.description} for this month`}>Add</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <div className={styles.toolbar}>
        <input className={styles.search} type="search" placeholder="Search costs, venues, categories…" value={filter.query}
          onChange={(e) => set({ query: e.target.value })} aria-label="Search costs" />
        <Button size="sm" variant={showFilters ? 'primary' : 'secondary'} onClick={() => setShowFilters((s) => !s)}>Filters{active.length ? ` (${active.length})` : ''}</Button>
      </div>
      <div className={styles.chips}>
        {active.map(([k, label]) => (
          <button key={k} type="button" className={`${styles.chip} ${styles.chipOn}`} onClick={() => set({ [k]: '' })} aria-label={`Remove filter ${label}`}>
            {label} <X size={12} aria-hidden />
          </button>
        ))}
        {(active.length > 0 || filter.query) && (
          <button type="button" className={styles.chip} onClick={() => setFilter(EMPTY_COST_FILTER)}>Clear</button>
        )}
      </div>
      {showFilters && (
        <section className={styles.panel}>
          <div className={styles.formRow}>
            <SelectInput label="Kind of cost" value={filter.group} onChange={(v) => set({ group: v })}>
              <option value="">Any</option>
              {options(COST_GROUP).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectInput>
            <SelectInput label="Status" value={filter.status} onChange={(v) => set({ status: v })}>
              <option value="">Any</option>
              <option value="paid">Paid</option>
              <option value="due">Due</option>
            </SelectInput>
            <SelectInput label="Venue" value={filter.venueId} onChange={(v) => set({ venueId: v })}>
              <option value="">Any</option>
              {[...data.venues].sort((a, b) => a.name.localeCompare(b.name)).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              <option value={NO_ENTITY}>No venue (overheads)</option>
            </SelectInput>
            <SelectInput label="Activity" value={filter.activity} onChange={(v) => set({ activity: v })}>
              <option value="">Any</option>
              {options(ACTIVITY).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              <option value={NO_ENTITY}>No activity</option>
            </SelectInput>
            <ClientPicker clients={data.clients} records={data.records} today={today} value={filter.clientId} onPick={(v) => set({ clientId: v })}
              empty="Any client" extras={[{ value: NO_ENTITY, label: 'No client' }]} includeArchived />
          </div>
        </section>
      )}

      <div className={styles.panelHead} style={{ marginBottom: 0 }}>
        <span className={styles.panelSub}>{list.length} {list.length === 1 ? 'cost' : 'costs'} · {lei(sumRon(pnl))} in the P&L{paid.length !== pnl.length ? ` · ${lei(sumRon(paid) - sumRon(pnl))} equipment & drawings` : ''}</span>
        {list.length > 0 && (
          <button type="button" className={styles.linkButton} onClick={exportCsv}><Download size={12} aria-hidden /> CSV</button>
        )}
      </div>

      {data.costs.some((c) => c.status === 'paid') && <WhereWent costs={pnl} data={data} onPick={(patch) => set(patch)} empty={range.label.toLowerCase()} onWiden={() => setPeriod({ preset: 'year' })} />}

      {list.length === 0 ? (
        <div className={styles.empty}>
          {data.costs.length === 0 ? 'No costs yet. Tap “Add cost” to record rent, a room hire or a subscription.' : 'Nothing matches these filters.'}
        </div>
      ) : groups.map(([key, cs]) => (
        <div key={key} className={styles.group}>
          <div className={styles.groupHead}>
            <span>{key === 'due' ? 'Due, not paid yet' : monthLabel(`${key}-01`)}</span>
            <span className="num">{key === 'due' ? `${lei(sumRon(cs))} to pay` : lei(sumRon(cs))}</span>
          </div>
          {cs.map((c) => <CostRow key={c.id} c={c} data={data} today={today} onOpen={onOpen} reimbursed={reimbursed.has(c.id)} />)}
        </div>
      ))}
      {list.length > 4 && <ListEnd>That's everything: {list.length} costs, {lei(sumRon(paid))} paid.</ListEnd>}
    </>
  )
}

function CostRow({ c, data, today, onOpen, reimbursed }: { c: CostRecord; data: InflowData; today: string; onOpen: (id: string) => void; reimbursed: boolean }) {
  const venue = data.venues.find((v) => v.id === c.venueId)?.name
  const client = data.clients.find((x) => x.id === c.clientId)?.name
  return (
    <button type="button" className={styles.entry} onClick={() => onOpen(c.id)} aria-label={`${c.description}, ${money(c.amount, c.currency)}, ${c.date}`}>
      <span className={styles.entryDate}>
        <span className={styles.entryDay}>{parseDate(c.date).getDate()}</span>
        <span className={styles.entryDow}>{c.status === 'due' ? monthShort(c.date) : weekdayShort(c.date)}</span>
      </span>
      <span style={{ minWidth: 0 }}>
        <span className={styles.entryTitle} style={{ display: 'block' }}>{c.description}</span>
        <span className={styles.entrySub} style={{ display: 'block' }}>{[COST_CATEGORY[c.category], venue, client].filter(Boolean).join(' · ')}</span>
        <span className={styles.tags}>
          {c.status === 'due' && <span className={`${styles.tag} ${styles.tagAlert}`}>{c.date < today ? 'Overdue' : 'Due'}</span>}
          <span className={`${styles.tag} ${c.group === 'direct' ? styles.tagReview : c.group === 'operating' ? styles.tagNon : ''}`}>{COST_GROUP_PLAIN[c.group]}</span>
          {c.activity && <span className={styles.tag}>{ACTIVITY[c.activity]}</span>}
          {c.recurring && <span className={styles.tag}><Repeat size={10} aria-hidden /> recurring</span>}
          {reimbursed && <span className={`${styles.tag} ${styles.tagNon}`}>reimbursed</span>}
        </span>
      </span>
      <span className={styles.entryAmount}>
        <span className={styles.entryAmountMain} style={{ display: 'block' }}>− {money(c.amount, c.currency)}</span>
        {c.currency !== 'RON' && <span className={styles.entryAmountSub} style={{ display: 'block' }}>{lei(c.amountRon)}</span>}
      </span>
    </button>
  )
}
