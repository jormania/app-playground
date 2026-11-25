/**
 * Add or edit one cost. Quick by default: amount, what it was, and where it
 * sits (direct or operating). A cost you've entered before is one tap away
 * under "Repeat a recent cost", which is how monthly bills get entered. Linking a venue,
 * client or activity is optional and only feeds the margins.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, ConfirmModal, Modal, SettingsToggle } from '../../ds'
import { readJson, writeJson } from '../../shared/storage'
import { useInflow } from '../app/state'
import type { Category, CostCategory, CostGroup, CostRecord, Currency } from '../domain/types'
import { ACTIVITY, CATEGORIES_BY_GROUP, COST_CATEGORY, COST_GROUP, COST_GROUP_HINT, CURRENCIES, options } from '../domain/vocabulary'
import { fetchRonRate, lei, money, round2, toRon } from '../lib/money'
import { addMonths } from '../lib/dates'
import { parseAmount, SelectInput, TextArea, TextInput } from './fields'
import styles from '../styles/ui.module.css'

const LAST_KEY = 'inflow:last-cost'

interface Draft {
  description: string
  amount: string
  currency: Currency
  fxRate: string
  date: string
  status: CostRecord['status']
  group: CostGroup
  category: CostCategory
  venueId: string
  clientId: string
  activity: string
  recurring: boolean
  deductible: boolean
  notes: string
}

const deductibleByDefault = (g: CostGroup) => g !== 'investment' && g !== 'financing' && g !== 'tax'

function fromCost(c: CostRecord, today?: string): Draft {
  return {
    description: c.description, amount: String(c.amount), currency: c.currency, fxRate: String(c.fxRate),
    date: today ?? c.date, status: today ? 'paid' : c.status, group: c.group, category: c.category,
    venueId: c.venueId ?? '', clientId: c.clientId ?? '', activity: c.activity ?? '', recurring: c.recurring,
    deductible: c.deductible, notes: today ? '' : c.notes,
  }
}

export interface CostFormProps {
  cost: CostRecord | null
  /** A cost to copy into a new one (dated today). */
  copyOf?: CostRecord | null
  onClose: () => void
  onDuplicate?: (c: CostRecord) => void
}

export function CostForm({ cost, copyOf, onClose, onDuplicate }: CostFormProps) {
  const { data, today, saveCost, deleteCost, toast } = useInflow()
  const isNew = !cost
  const [draft, setDraft] = useState<Draft>(() => {
    if (cost) return fromCost(cost)
    if (copyOf) return fromCost(copyOf, today)
    const last = readJson<{ currency?: Currency; group?: CostGroup }>(LAST_KEY, {})
    const group = last.group ?? 'operating'
    return {
      description: '', amount: '', currency: last.currency ?? 'RON', fxRate: '1', date: today, status: 'paid', group,
      category: CATEGORIES_BY_GROUP[group][0], venueId: '', clientId: '', activity: '', recurring: false,
      deductible: deductibleByDefault(group), notes: '',
    }
  })
  const [fxTouched, setFxTouched] = useState(!!cost || !!copyOf)
  const [fxState, setFxState] = useState<'idle' | 'loading' | 'failed' | 'ok'>('idle')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  const amount = parseAmount(draft.amount)
  const fxRate = draft.currency === 'RON' ? 1 : parseAmount(draft.fxRate)
  const amountRon = Number.isFinite(amount) && Number.isFinite(fxRate) ? toRon(amount, fxRate) : 0

  const fxReq = useRef(0)
  useEffect(() => {
    if (draft.currency === 'RON' || fxTouched) return
    const req = ++fxReq.current
    setFxState('loading')
    void fetchRonRate(draft.currency, draft.date || today).then((r) => {
      if (req !== fxReq.current) return
      if (r) { setDraft((d) => ({ ...d, fxRate: String(r) })); setFxState('ok') } else setFxState('failed')
    })
  }, [draft.currency, draft.date, fxTouched, today])

  // The costs you enter again and again (rent, Zoom, the accountant) as one-tap shortcuts:
  // ranked by how often they were paid in the last six months, then by how recently.
  const recent = useMemo(() => {
    const since = addMonths(today, -6)
    const groups = new Map<string, { c: CostRecord; n: number }>()
    for (const c of data.costs) {
      if (c.status !== 'paid' || c.date < since || c.date > today) continue
      const k = c.description.trim().toLowerCase()
      if (!k) continue
      const g = groups.get(k)
      if (!g) groups.set(k, { c, n: 1 })
      else { g.n += 1; if (c.date > g.c.date) g.c = c }
    }
    return [...groups.values()].sort((a, b) => b.n - a.n || b.c.date.localeCompare(a.c.date)).slice(0, 5).map((g) => g.c)
  }, [data.costs, today])

  const setGroup = (g: CostGroup) => set({
    group: g,
    category: CATEGORIES_BY_GROUP[g].includes(draft.category) ? draft.category : CATEGORIES_BY_GROUP[g][0],
    deductible: deductibleByDefault(g),
  })

  const save = async () => {
    setError(null)
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter an amount above zero.'); return }
    if (!draft.date) { setError('Pick the date.'); return }
    if (draft.currency !== 'RON' && (!Number.isFinite(fxRate) || fxRate <= 0)) { setError('Enter the exchange rate to lei.'); return }
    const c: CostRecord = {
      id: cost?.id ?? '',
      description: draft.description.trim() || COST_CATEGORY[draft.category],
      amount: round2(amount), currency: draft.currency, fxRate, amountRon, date: draft.date, status: draft.status,
      group: draft.group, category: draft.category, venueId: draft.venueId || null, clientId: draft.clientId || null,
      activity: (draft.activity || null) as Category | null, recurring: draft.recurring, deductible: draft.deductible,
      notes: draft.notes.trim(), demo: cost?.demo,
    }
    setBusy(true)
    const saved = await saveCost(c)
    setBusy(false)
    if (!saved) return
    writeJson(LAST_KEY, { currency: c.currency, group: c.group })
    toast({ message: isNew ? `Added ${money(c.amount, c.currency)} cost` : 'Saved', tone: 'success' })
    onClose()
  }

  const clients = data.clients.filter((c) => !c.archived || c.id === draft.clientId).sort((a, b) => a.name.localeCompare(b.name))
  const venues = data.venues.filter((v) => !v.archived || v.id === draft.venueId).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <Modal open onClose={onClose} title={isNew ? (copyOf ? 'Add cost (copy)' : 'Add cost') : 'Edit cost'}>
        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void save() }}>
          {isNew && !copyOf && recent.length > 0 && (
            <div>
              <div className={styles.fieldLabel} style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 6 }}>Repeat a recent cost</div>
              <div className={styles.chips}>
                {recent.map((c) => (
                  <button key={c.id} type="button" className={styles.chip} onClick={() => { setDraft(fromCost(c, today)); setFxTouched(true) }}>
                    {c.description} · {money(c.amount, c.currency)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className={styles.amountRow}>
            <TextInput label="Amount" value={draft.amount} onChange={(v) => set({ amount: v })} inputMode="decimal" placeholder="0" autoFocus={isNew && !copyOf} name="amount" />
            <SelectInput label="Currency" value={draft.currency} onChange={(v) => { setFxTouched(false); set({ currency: v as Currency, fxRate: v === 'RON' ? '1' : draft.fxRate }) }}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </SelectInput>
          </div>
          {draft.currency !== 'RON' && (
            <TextInput label={`Lei per 1 ${draft.currency}`} value={draft.fxRate} inputMode="decimal"
              onChange={(v) => { setFxTouched(true); set({ fxRate: v }) }}
              hint={<>{fxState === 'loading' ? 'Fetching the ECB rate…' : fxState === 'failed' ? 'No rate could be fetched; type it.' : 'Rate for that day.'}{amountRon > 0 && <> · <b>{lei(amountRon)}</b></>}</>} />
          )}
          <TextInput label="What was it?" value={draft.description} onChange={(v) => set({ description: v })} placeholder="e.g. Studio hire, Zoom, accountant" name="description" />
          <SelectInput label="Kind of cost" value={draft.group} onChange={(v) => setGroup(v as CostGroup)} hint={COST_GROUP_HINT[draft.group]} name="group">
            {options(COST_GROUP).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </SelectInput>
          <div className={styles.formRow}>
            <SelectInput label="Category" value={draft.category} onChange={(v) => set({ category: v as CostCategory })} name="category">
              {CATEGORIES_BY_GROUP[draft.group].map((c) => <option key={c} value={c}>{COST_CATEGORY[c]}</option>)}
            </SelectInput>
            <TextInput label="Date" type="date" value={draft.date} onChange={(v) => set({ date: v })} name="date" />
          </div>
          <SelectInput label="Status" value={draft.status} onChange={(v) => set({ status: v as Draft['status'] })}
            hint={draft.status === 'due' ? 'Not paid yet: left out of the P&L and cash flow until you mark it paid.' : undefined}>
            <option value="paid">Paid</option>
            <option value="due">Due (not paid yet)</option>
          </SelectInput>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}><span>Link it <span className={styles.optional}>Optional</span></span></h3>
            <p className={styles.hint}>Linked costs come off that venue's, client's or activity's revenue in the margins. Leave them empty for overheads.</p>
            <div className={styles.formRow}>
              <SelectInput label="Venue" value={draft.venueId} onChange={(v) => set({ venueId: v })}>
                <option value="">—</option>
                {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </SelectInput>
              <SelectInput label="Activity" value={draft.activity} onChange={(v) => set({ activity: v })}>
                <option value="">—</option>
                {options(ACTIVITY).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectInput>
            </div>
            <SelectInput label="Client" value={draft.clientId} onChange={(v) => set({ clientId: v })}>
              <option value="">—</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SelectInput>
          </div>
          <SettingsToggle label="Recurring" hint="Rent, subscriptions, monthly fees." checked={draft.recurring} onChange={(e) => set({ recurring: e.target.checked })} />
          <SettingsToggle label="Deductible" hint="Counts as an expense for the tax estimate." checked={draft.deductible} onChange={(e) => set({ deductible: e.target.checked })} />
          <TextArea label="Notes" value={draft.notes} onChange={(v) => set({ notes: v })} />
          {error && <p className={styles.hint} role="alert" style={{ color: 'var(--color-danger)' }}>{error}</p>}
          <div className={styles.formActions}>
            <div>
              {!isNew && <Button variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Button>}
              {!isNew && onDuplicate && <Button variant="ghost" onClick={() => onDuplicate(cost!)}>Copy</Button>}
            </div>
            <div>
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={busy}>{isNew ? 'Add' : 'Save'}</Button>
            </div>
          </div>
        </form>
      </Modal>
      <ConfirmModal
        isOpen={confirmDelete}
        title="Delete this cost?"
        message={cost ? `${cost.description} — ${money(cost.amount, cost.currency)} on ${cost.date}.` : ''}
        confirmText="Delete"
        variant="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); if (cost) void deleteCost(cost); onClose() }}
      />
    </>
  )
}
