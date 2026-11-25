/**
 * Add or edit one payment. Quick by default: amount, who, done. Everything
 * else is prefilled — the date, the currency you last used, and the source,
 * venue and category from that client's last payment.
 *
 * Tax fields follow a live suggestion until you touch them, and every
 * suggested value wears a "Suggested" badge. Editing an older payment never
 * replaces its stored classification or reserve unless you ask for the
 * suggestion explicitly.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button, ConfirmModal, Modal, SettingsToggle } from '../../ds'
import { readJson, writeJson } from '../../shared/storage'
import { useInflow } from '../app/state'
import type { Currency, IncomeRecord, TaxHandling, Taxability, VatTreatment } from '../domain/types'
import { CATEGORY, CURRENCIES, TAX_HANDLING, TAXABILITY, VAT, options } from '../domain/vocabulary'
import { fetchRonRate, lei, money, round2, toRon } from '../lib/money'
import { suggestClassification, suggestedWithholding } from '../tax/classify'
import { suggestReserve } from '../tax/estimate'
import type { Entity, EntityKind } from '../store/repo'
import { blankEntity, EntityEditor, KIND_LABEL } from './EntityEditor'
import { parseAmount, SelectInput, TextArea, TextInput } from './fields'
import { Optional } from './Optional'
import styles from '../styles/ui.module.css'

const LAST_KEY = 'inflow:last-entry'
const NEW = '__new__'

interface Draft {
  description: string
  amount: string
  currency: Currency
  fxRate: string
  date: string
  status: IncomeRecord['status']
  clientId: string
  sourceId: string
  venueId: string
  category: string
  recurring: boolean
  notes: string
  taxability: Taxability
  taxHandling: TaxHandling
  vat: VatTreatment
  confirmed: boolean
  reserve: string
  withheld: string
}

type TaxField = 'taxability' | 'taxHandling' | 'vat'

function fromRecord(r: IncomeRecord): Draft {
  return {
    description: r.description, amount: String(r.amount), currency: r.currency, fxRate: String(r.fxRate), date: r.date,
    status: r.status, clientId: r.clientId ?? '', sourceId: r.sourceId ?? '', venueId: r.venueId ?? '', category: r.category ?? '',
    recurring: r.recurring, notes: r.notes, taxability: r.taxability, taxHandling: r.taxHandling, vat: r.vat,
    confirmed: r.classification === 'confirmed', reserve: r.taxReserve === null ? '' : String(r.taxReserve), withheld: r.taxWithheld ? String(r.taxWithheld) : '',
  }
}

export interface EntryFormProps {
  open: boolean
  record: IncomeRecord | null
  onClose: () => void
}

export function EntryForm({ open, record, onClose }: EntryFormProps) {
  const { data, settings, today, saveRecord, deleteRecord, toast } = useInflow()
  const isNew = !record
  const blank = (): Draft => {
    const last = readJson<{ currency?: Currency }>(LAST_KEY, {})
    return {
      description: '', amount: '', currency: last.currency ?? 'RON', fxRate: '1', date: today, status: 'received',
      clientId: '', sourceId: '', venueId: '', category: '', recurring: false, notes: '',
      taxability: 'taxable', taxHandling: 'self_declared', vat: 'exempt', confirmed: false, reserve: '', withheld: '',
    }
  }
  const [draft, setDraft] = useState<Draft>(() => (record ? fromRecord(record) : blank()))
  // Fields the user has set by hand; these stop following the suggestion.
  const [touched, setTouched] = useState<Set<TaxField | 'reserve' | 'withheld' | 'fx' | 'prefill'>>(
    () => new Set(record ? ['taxability', 'taxHandling', 'vat', 'reserve', 'withheld', 'fx', 'prefill'] : []),
  )
  // The parent mounts a fresh form per opening (keyed), so state starts clean each time.
  const [fxState, setFxState] = useState<'idle' | 'loading' | 'failed' | 'ok'>('idle')
  const [creating, setCreating] = useState<{ kind: EntityKind; entity: Entity } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  // Tax stays folded away unless the payment needs a decision; it's optional.
  const [taxOpen, setTaxOpen] = useState(record?.taxability === 'review')
  const [error, setError] = useState<string | null>(null)

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const touch = (f: TaxField | 'reserve' | 'withheld' | 'fx' | 'prefill') => setTouched((t) => new Set(t).add(f))

  const client = data.clients.find((c) => c.id === draft.clientId) ?? null
  const source = data.sources.find((s) => s.id === draft.sourceId) ?? null
  const amount = parseAmount(draft.amount)
  const fxRate = draft.currency === 'RON' ? 1 : parseAmount(draft.fxRate)
  const amountRon = Number.isFinite(amount) && Number.isFinite(fxRate) ? toRon(amount, fxRate) : 0

  const cls = useMemo(
    () => suggestClassification({ category: (draft.category || null) as IncomeRecord['category'], client, source }, settings.tax),
    [draft.category, client, source, settings.tax],
  )

  // Untouched tax fields follow the suggestion as the payment takes shape.
  useEffect(() => {
    setDraft((d) => {
      const next = { ...d }
      if (!touched.has('taxability')) next.taxability = cls.taxability
      if (!touched.has('taxHandling')) next.taxHandling = cls.taxHandling
      if (!touched.has('vat')) next.vat = cls.vat
      return next.taxability === d.taxability && next.taxHandling === d.taxHandling && next.vat === d.vat ? d : next
    })
  }, [cls, touched])

  const withheldNum = draft.withheld ? parseAmount(draft.withheld) : 0
  const suggestedWithheld = draft.taxHandling === 'withheld' ? suggestedWithholding(amountRon) : 0
  useEffect(() => {
    if (touched.has('withheld')) return
    const v = suggestedWithheld ? String(suggestedWithheld) : ''
    setDraft((d) => (d.withheld === v ? d : { ...d, withheld: v }))
  }, [suggestedWithheld, touched])

  const others = useMemo(() => data.records.filter((r) => r.id !== record?.id), [data.records, record?.id])
  const reserveSuggestion = useMemo(
    () => suggestReserve({ amountRon, date: draft.date || today, taxability: draft.taxability, taxHandling: draft.taxHandling, taxWithheld: Number.isFinite(withheldNum) ? withheldNum : 0, status: draft.status }, others, settings.tax, today),
    [amountRon, draft.date, draft.taxability, draft.taxHandling, withheldNum, draft.status, others, settings.tax, today],
  )
  useEffect(() => {
    if (touched.has('reserve')) return
    const v = draft.taxability === 'taxable' ? String(reserveSuggestion.amount) : ''
    setDraft((d) => (d.reserve === v ? d : { ...d, reserve: v }))
  }, [reserveSuggestion.amount, draft.taxability, touched])

  // Fetch the day's rate for a foreign currency until a rate is typed by hand.
  const fxReq = useRef(0)
  useEffect(() => {
    if (!open || draft.currency === 'RON' || touched.has('fx')) return
    const req = ++fxReq.current
    setFxState('loading')
    void fetchRonRate(draft.currency, draft.date || today).then((r) => {
      if (req !== fxReq.current) return
      if (r) { setDraft((d) => ({ ...d, fxRate: String(r) })); setFxState('ok') } else setFxState('failed')
    })
  }, [open, draft.currency, draft.date, touched, today])

  const pickClient = (id: string) => {
    if (id === NEW) { setCreating({ kind: 'client', entity: blankEntity('client') }); return }
    const patch: Partial<Draft> = { clientId: id }
    // A new payment from a known client starts as a copy of their last one.
    if (isNew && !touched.has('prefill') && id) {
      const last = [...data.records].filter((r) => r.clientId === id).sort((a, b) => b.date.localeCompare(a.date))[0]
      if (last) {
        Object.assign(patch, {
          sourceId: draft.sourceId || last.sourceId || '', venueId: draft.venueId || last.venueId || '',
          category: draft.category || last.category || '', currency: last.currency, recurring: last.recurring,
          description: draft.description || last.description, amount: draft.amount || String(last.amount),
        })
        if (last.currency !== 'RON') patch.fxRate = String(last.fxRate)
      }
    }
    set(patch)
  }

  const pickEntity = (kind: EntityKind, id: string) => {
    if (id === NEW) { setCreating({ kind, entity: blankEntity(kind) }); return }
    if (kind === 'source') set({ sourceId: id })
    if (kind === 'venue') set({ venueId: id })
  }

  const setTax = <K extends TaxField>(field: K, value: Draft[K]) => {
    touch(field)
    set({ [field]: value, confirmed: true } as Partial<Draft>)
  }

  const useSuggestedTax = () => {
    setTouched((t) => { const n = new Set(t); n.delete('taxability'); n.delete('taxHandling'); n.delete('vat'); return n })
    set({ taxability: cls.taxability, taxHandling: cls.taxHandling, vat: cls.vat })
  }

  const isSuggested = (f: TaxField) => draft[f] === cls[f]
  const reserveIsSuggested = draft.reserve === String(reserveSuggestion.amount)

  const save = async () => {
    setError(null)
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter an amount above zero.'); return }
    if (!draft.date) { setError('Pick the date it was received.'); return }
    if (draft.currency !== 'RON' && (!Number.isFinite(fxRate) || fxRate <= 0)) { setError('Enter the exchange rate to lei.'); return }
    const reserveNum = !settings.trackTax ? record?.taxReserve ?? null : draft.reserve === '' ? null : parseAmount(draft.reserve)
    if (reserveNum !== null && !Number.isFinite(reserveNum)) { setError('The tax reserve is not a number.'); return }
    const allSuggested = !touched.has('taxability') && !touched.has('taxHandling') && !touched.has('vat')
    const reserveUnchanged = !!record && record.taxReserve === (reserveNum === null ? null : round2(reserveNum))
    const r: IncomeRecord = {
      id: record?.id ?? '',
      description: draft.description.trim() || (draft.category ? CATEGORY[draft.category as keyof typeof CATEGORY] : client?.name) || 'Payment',
      amount: round2(amount),
      currency: draft.currency,
      fxRate,
      amountRon,
      date: draft.date,
      status: draft.status,
      clientId: draft.clientId || null,
      sourceId: draft.sourceId || null,
      venueId: draft.venueId || null,
      category: (draft.category || null) as IncomeRecord['category'],
      recurring: draft.recurring,
      notes: draft.notes.trim(),
      taxability: draft.taxability,
      taxHandling: draft.taxHandling,
      vat: draft.vat,
      classification: draft.confirmed || !allSuggested ? 'confirmed' : 'suggested',
      taxReserve: reserveNum === null ? null : round2(reserveNum),
      // An unchanged stored reserve keeps its origin; otherwise it's suggested or yours.
      reserveSource: reserveNum === null ? null : reserveUnchanged ? record!.reserveSource : reserveIsSuggested ? 'suggested' : 'manual',
      taxWithheld: Number.isFinite(withheldNum) ? round2(withheldNum) : 0,
      taxRules: reserveUnchanged ? record!.taxRules : reserveSuggestion.rulesId,
      demo: record?.demo,
    }
    setBusy(true)
    const saved = await saveRecord(r)
    setBusy(false)
    if (!saved) return
    writeJson(LAST_KEY, { currency: r.currency })
    toast({ message: isNew ? `Added ${money(r.amount, r.currency)}` : 'Saved', tone: 'success' })
    onClose()
  }

  const activeClients = data.clients.filter((c) => !c.archived || c.id === draft.clientId).sort((a, b) => a.name.localeCompare(b.name))
  const activeSources = data.sources.filter((s) => s.active || s.id === draft.sourceId).sort((a, b) => a.name.localeCompare(b.name))
  const activeVenues = data.venues.filter((v) => !v.archived || v.id === draft.venueId).sort((a, b) => a.name.localeCompare(b.name))

  const badge = (ok: boolean) => ok
    ? <span className={styles.badge} title="Suggested by InFlow from your tax profile; not confirmed">Suggested</span>
    : <span className={`${styles.badge} ${styles.badgeOk}`}>Your choice</span>

  return (
    <>
      <Modal open={open && !creating} onClose={onClose} title={isNew ? 'Add income' : 'Edit payment'}>
        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void save() }}>
          <div className={styles.amountRow}>
            <TextInput label="Amount" value={draft.amount} onChange={(v) => set({ amount: v })} inputMode="decimal" placeholder="0" autoFocus={isNew} name="amount" />
            <SelectInput label="Currency" value={draft.currency} onChange={(v) => set({ currency: v as Currency, fxRate: v === 'RON' ? '1' : draft.fxRate })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </SelectInput>
          </div>
          {draft.currency !== 'RON' && (
            <TextInput
              label={`Lei per 1 ${draft.currency}`}
              value={draft.fxRate}
              onChange={(v) => { touch('fx'); set({ fxRate: v }) }}
              inputMode="decimal"
              hint={<>
                {fxState === 'loading' ? 'Fetching the ECB rate for that day…'
                  : fxState === 'failed' ? 'No rate could be fetched; type the BNR rate.'
                    : touched.has('fx') ? 'Your rate.' : 'ECB rate for that day. The BNR rate is what you declare; adjust if it differs.'}
                {amountRon > 0 && <> · <b>{lei(amountRon)}</b></>}
              </>}
            />
          )}
          <SelectInput label="Client" value={draft.clientId} onChange={pickClient} name="client">
            <option value="">— none —</option>
            {activeClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value={NEW}>+ New client…</option>
          </SelectInput>
          <TextInput label="Description" value={draft.description} onChange={(v) => set({ description: v })} placeholder="e.g. Coaching session" name="description" />
          <div className={styles.formRow}>
            <TextInput label="Date" type="date" value={draft.date} onChange={(v) => set({ date: v })} name="date" />
            <SelectInput label="Status" value={draft.status} onChange={(v) => set({ status: v as Draft['status'] })}>
              <option value="received">Received</option>
              <option value="expected">Expected</option>
            </SelectInput>
          </div>
          <div className={styles.formRow}>
            <SelectInput label="Source" value={draft.sourceId} onChange={(v) => pickEntity('source', v)} name="source">
              <option value="">— none —</option>
              {activeSources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value={NEW}>+ New source…</option>
            </SelectInput>
            <SelectInput label="Venue" value={draft.venueId} onChange={(v) => pickEntity('venue', v)} name="venue">
              <option value="">— none —</option>
              {activeVenues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              <option value={NEW}>+ New venue…</option>
            </SelectInput>
          </div>
          <SelectInput label="Kind of work (optional)" value={draft.category} onChange={(v) => set({ category: v })}>
            <option value="">—</option>
            {options(CATEGORY).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </SelectInput>
          <SettingsToggle label="Recurring" hint="A package, retainer or regular payout." checked={draft.recurring} onChange={(e) => set({ recurring: e.target.checked })} />

          {settings.trackTax && !taxOpen && (
            <button type="button" className={styles.disclosure} onClick={() => setTaxOpen(true)} aria-expanded={false}>
              <span>
                <b>Tax</b> <Optional />
                <span className={styles.disclosureSummary}>
                  {TAXABILITY[draft.taxability]}{draft.taxability === 'taxable' ? ` · ${TAX_HANDLING[draft.taxHandling].toLowerCase()}` : ''} · VAT {VAT[draft.vat].toLowerCase()}
                  {draft.taxability === 'taxable' && draft.reserve ? ` · set aside ${lei(parseAmount(draft.reserve) || 0)}` : ''}
                  {!touched.has('taxability') && !touched.has('taxHandling') && !touched.has('vat') ? ' (suggested)' : ''}
                </span>
              </span>
              <ChevronDown size={18} aria-hidden />
            </button>
          )}
          {settings.trackTax && taxOpen && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <span>Tax <Optional /></span>
              {(!isSuggested('taxability') || !isSuggested('taxHandling') || !isSuggested('vat')) && (
                <button type="button" className={styles.linkButton} onClick={useSuggestedTax}>Use suggestion</button>
              )}
            </h3>
            <p className={styles.hint}>Suggestions from your tax profile ({settings.tax.id.replace('_', ' ').toUpperCase()}). You decide; nothing here is tax advice.</p>
            <SelectInput label="Taxable?" right={badge(isSuggested('taxability') && !touched.has('taxability'))} value={draft.taxability}
              onChange={(v) => setTax('taxability', v as Taxability)} hint={isSuggested('taxability') ? cls.reasons.taxability : `Suggested: ${TAXABILITY[cls.taxability]}. ${cls.reasons.taxability}`}>
              {options(TAXABILITY).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectInput>
            <SelectInput label="How the tax is handled" right={badge(isSuggested('taxHandling') && !touched.has('taxHandling'))} value={draft.taxHandling}
              onChange={(v) => setTax('taxHandling', v as TaxHandling)} hint={isSuggested('taxHandling') ? cls.reasons.taxHandling : `Suggested: ${TAX_HANDLING[cls.taxHandling]}. ${cls.reasons.taxHandling}`}>
              {options(TAX_HANDLING).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectInput>
            <SelectInput label="VAT" right={badge(isSuggested('vat') && !touched.has('vat'))} value={draft.vat}
              onChange={(v) => setTax('vat', v as VatTreatment)} hint={isSuggested('vat') ? cls.reasons.vat : `Suggested: ${VAT[cls.vat]}. ${cls.reasons.vat}`}>
              {options(VAT).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectInput>
            {(draft.taxHandling === 'withheld' || withheldNum > 0) && (
              <TextInput label="Tax withheld or paid (lei)" value={draft.withheld} inputMode="decimal"
                onChange={(v) => { touch('withheld'); set({ withheld: v }) }}
                hint={touched.has('withheld') ? 'As on the payment statement.' : '10% suggested; enter what the statement shows.'} />
            )}
            <TextInput
              label="Set aside for tax (lei)"
              right={draft.taxability === 'taxable' ? badge(reserveIsSuggested) : undefined}
              value={draft.reserve}
              inputMode="decimal"
              onChange={(v) => { touch('reserve'); set({ reserve: v }) }}
              hint={<>
                {reserveSuggestion.explanation}
                {!reserveIsSuggested && draft.taxability === 'taxable' && (
                  <> <button type="button" className={styles.linkButton} onClick={() => { touch('reserve'); set({ reserve: String(reserveSuggestion.amount) }) }}>
                    Use {lei(reserveSuggestion.amount)}
                  </button></>
                )}
              </>}
            />
            <SettingsToggle label="Classification checked" hint="Marks the tax treatment as confirmed rather than suggested." checked={draft.confirmed} onChange={(e) => set({ confirmed: e.target.checked })} />
          </div>
          )}

          <TextArea label="Notes" value={draft.notes} onChange={(v) => set({ notes: v })} />
          {error && <p className={styles.hint} role="alert" style={{ color: 'var(--color-danger)' }}>{error}</p>}
          <div className={styles.formActions}>
            <div>{!isNew && <Button variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Button>}</div>
            <div>
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={busy}>{isNew ? 'Add' : 'Save'}</Button>
            </div>
          </div>
        </form>
      </Modal>
      {creating && (
        <EntityEditor
          open
          kind={creating.kind}
          entity={null}
          onClose={() => setCreating(null)}
          onSaved={(e) => {
            const k = creating.kind
            if (k === 'client') pickClient(e.id)
            else set(k === 'source' ? { sourceId: e.id } : { venueId: e.id })
            toast({ message: `New ${KIND_LABEL[k]}: ${e.name}`, tone: 'success' })
          }}
        />
      )}
      <ConfirmModal
        isOpen={confirmDelete}
        title="Delete this payment?"
        message={record ? `${record.description} — ${money(record.amount, record.currency)} on ${record.date}.` : ''}
        confirmText="Delete"
        variant="danger"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); if (record) void deleteRecord(record); onClose() }}
      />
    </>
  )
}
