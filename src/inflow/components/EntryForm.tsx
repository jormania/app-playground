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
import { DateShortcuts, parseAmount, parseRate, SelectInput, TextArea, TextInput } from './fields'
import { Findings } from './Findings'
import { incomeErrors, incomeFindings, type Finding, type Fix } from '../lib/guards'
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
  attendees: string
  sessions: string
  hours: string
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
    recurring: r.recurring, notes: r.notes, attendees: r.attendees === null ? '' : String(r.attendees), sessions: String(r.sessions ?? 1), hours: r.hours === null || r.hours === undefined ? '' : String(r.hours), taxability: r.taxability, taxHandling: r.taxHandling, vat: r.vat,
    confirmed: r.classification === 'confirmed', reserve: r.taxReserve === null ? '' : String(r.taxReserve), withheld: r.taxWithheld ? String(r.taxWithheld) : '',
  }
}

export interface EntryFormProps {
  open: boolean
  record: IncomeRecord | null
  /** Start a new payment as a copy of this one, dated today. */
  copyOf?: IncomeRecord | null
  onClose: () => void
  onDuplicate?: (r: IncomeRecord) => void
}

export function EntryForm({ open, record, copyOf, onClose, onDuplicate }: EntryFormProps) {
  const { data, settings, today, saveRecord, deleteRecord, toast, on } = useInflow()
  const isNew = !record
  const blank = (): Draft => {
    const last = readJson<{ currency?: Currency }>(LAST_KEY, {})
    return {
      description: '', amount: '', currency: last.currency ?? 'RON', fxRate: '1', date: today, status: 'received',
      clientId: '', sourceId: '', venueId: '', category: '', recurring: false, notes: '', attendees: '', sessions: '1', hours: '',
      taxability: 'taxable', taxHandling: 'self_declared', vat: 'exempt', confirmed: false, reserve: '', withheld: '',
    }
  }
  const [draft, setDraft] = useState<Draft>(() => {
    if (record) return fromRecord(record)
    // A copy keeps who, where and what, and starts fresh on when, status and tax.
    if (copyOf) return { ...fromRecord(copyOf), date: today, status: 'received', notes: '', confirmed: false, reserve: '', withheld: '' }
    return blank()
  })
  // Fields the user has set by hand; these stop following the suggestion.
  const [touched, setTouched] = useState<Set<TaxField | 'reserve' | 'withheld' | 'fx' | 'prefill'>>(
    () => new Set(record ? ['taxability', 'taxHandling', 'vat', 'reserve', 'withheld', 'fx', 'prefill'] : copyOf ? ['prefill'] : []),
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
  // Warnings from lib/guards.ts for the draft exactly as it was when Save was pressed.
  const [warned, setWarned] = useState<{ draft: Draft; items: Finding[] } | null>(null)
  const warnings = warned && warned.draft === draft ? warned.items : []
  const touch = (f: TaxField | 'reserve' | 'withheld' | 'fx' | 'prefill') => setTouched((t) => new Set(t).add(f))

  // The clients paid most recently, as one-tap chips above the picker.
  const recentClients = useMemo(() => {
    const seen = new Set<string>()
    const out: { id: string; name: string }[] = []
    for (const r of [...data.records].sort((a, b) => b.date.localeCompare(a.date))) {
      if (!r.clientId || seen.has(r.clientId)) continue
      seen.add(r.clientId)
      const c = data.clients.find((x) => x.id === r.clientId)
      if (c && !c.archived) out.push(c)
      if (out.length === 5) break
    }
    return out
  }, [data.records, data.clients])

  // The amounts this client pays most often, as one-tap chips: most freelancers charge a few set prices.
  const usual = useMemo(() => {
    if (!draft.clientId) return []
    const count = new Map<string, { amount: number; currency: Currency; n: number; last: string }>()
    for (const r of data.records) {
      if (r.clientId !== draft.clientId || r.status !== 'received' || r.id === record?.id) continue
      const k = `${r.amount}|${r.currency}`
      const c = count.get(k) ?? { amount: r.amount, currency: r.currency, n: 0, last: '' }
      c.n += 1
      if (r.date > c.last) c.last = r.date
      count.set(k, c)
    }
    return [...count.values()].sort((a, b) => b.n - a.n || b.last.localeCompare(a.last)).slice(0, 3)
  }, [draft.clientId, data.records, record?.id])

  // What a head usually brings at this venue (or for this activity): turns "people who came" into an amount.
  const usualPerHead = useMemo(() => {
    const like = data.records.filter((r) => r.status === 'received' && r.attendees && r.attendees > 0 && r.id !== record?.id
      && (draft.venueId ? r.venueId === draft.venueId : draft.category ? r.category === draft.category : false))
    if (like.length < 2) return null
    const per = like.map((r) => r.amountRon / (r.attendees! * (r.sessions || 1))).sort((a, b) => a - b)
    return Math.round(per[Math.floor(per.length / 2)])
  }, [data.records, draft.venueId, draft.category, record?.id])

  const client = data.clients.find((c) => c.id === draft.clientId) ?? null
  const source = data.sources.find((s) => s.id === draft.sourceId) ?? null
  const venue = data.venues.find((v) => v.id === draft.venueId) ?? null
  // An empty description is written from what's known: the activity, then where or for whom.
  const autoDescription = [draft.category ? CATEGORY[draft.category as keyof typeof CATEGORY] : '', venue?.name ?? client?.name ?? ''].filter(Boolean).join(' · ') || 'Payment'
  const amount = parseAmount(draft.amount)
  const fxRate = draft.currency === 'RON' ? 1 : parseRate(draft.fxRate)
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
  const costsForTax = useMemo(() => (settings.features.costs ? data.costs : []), [settings.features.costs, data.costs])
  const reserveSuggestion = useMemo(
    () => suggestReserve({ amountRon, date: draft.date || today, taxability: draft.taxability, taxHandling: draft.taxHandling, taxWithheld: Number.isFinite(withheldNum) ? withheldNum : 0, status: draft.status }, others, settings.tax, today, costsForTax),
    [amountRon, draft.date, draft.taxability, draft.taxHandling, withheldNum, draft.status, others, settings.tax, today, costsForTax],
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
      // The last payment actually received, not one still expected.
      const last = [...data.records].filter((r) => r.clientId === id && r.status === 'received').sort((a, b) => b.date.localeCompare(a.date))[0]
      if (last) {
        Object.assign(patch, {
          sourceId: draft.sourceId || last.sourceId || '', venueId: draft.venueId || last.venueId || '',
          category: draft.category || last.category || '', currency: last.currency, recurring: last.recurring,
          description: draft.description || last.description, amount: draft.amount || String(last.amount),
          sessions: draft.sessions !== '1' ? draft.sessions : String(last.sessions ?? 1), hours: draft.hours || (last.hours ? String(last.hours) : ''),
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
    const attendeesNum = draft.attendees.trim() === '' ? null : Math.round(parseAmount(draft.attendees))
    if (attendeesNum !== null && (!Number.isFinite(attendeesNum) || attendeesNum < 0)) { setError('People per session is a head count: one whole number, like 8.'); return }
    const sessionsNum = draft.sessions.trim() === '' ? 1 : Math.round(parseAmount(draft.sessions))
    if (!Number.isFinite(sessionsNum) || sessionsNum < 1) { setError('Sessions should be a whole number, 1 or more.'); return }
    const hoursNum = draft.hours.trim() === '' ? null : parseRate(draft.hours)
    if (hoursNum !== null && (!Number.isFinite(hoursNum) || hoursNum <= 0)) { setError('Hours should be a number above zero, or empty.'); return }
    const reserveNum = !settings.features.tax ? record?.taxReserve ?? null : draft.reserve === '' ? null : parseAmount(draft.reserve)
    if (reserveNum !== null && !Number.isFinite(reserveNum)) { setError('The tax reserve is not a number.'); return }
    const allSuggested = !touched.has('taxability') && !touched.has('taxHandling') && !touched.has('vat')
    const reserveUnchanged = !!record && record.taxReserve === (reserveNum === null ? null : round2(reserveNum))
    const r: IncomeRecord = {
      id: record?.id ?? '',
      description: draft.description.trim() || autoDescription,
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
      attendees: attendeesNum,
      sessions: sessionsNum,
      hours: hoursNum === null ? null : round2(hoursNum),
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
    const impossible = incomeErrors(r)
    if (impossible) { setError(impossible); return }
    // A second press with nothing changed means "yes, I meant it".
    if (!warnings.length) {
      const found = incomeFindings(r, {
        records: data.records, today, before: record ?? null,
        suggestedReserve: settings.features.tax && r.taxability === 'taxable' && r.status === 'received' ? reserveSuggestion.amount : null,
      })
      if (found.length) { setWarned({ draft, items: found }); return }
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

  // Optional parts of the form follow the feature switches, but never hide a value a record already has.
  const showCurrency = on('currencies') || draft.currency !== 'RON'
  const showStatus = on('expected') || draft.status === 'expected'
  const sessionsN = Math.max(1, Math.round(parseAmount(draft.sessions)) || 1)
  const heads = Number(draft.attendees) * sessionsN
  const perHead = heads > 0 && amountRon > 0 ? amountRon / heads : 0
  const fromHeads = usualPerHead && heads > 0 && draft.currency === 'RON' ? heads * usualPerHead : 0
  const attendeesField = (
    <TextInput label="People per session (optional)" value={draft.attendees} onChange={(v) => set({ attendees: v })} inputMode="numeric" placeholder="e.g. 8"
      hint={fromHeads && Math.round(amountRon) !== fromHeads
        ? <>Usually {lei(usualPerHead!)} a head here: {heads}{sessionsN > 1 ? ` seats (${draft.attendees} × ${sessionsN} sessions)` : ''} × {lei(usualPerHead!)} = <b>{lei(fromHeads)}</b>{' '}
          <button type="button" className={styles.linkButton} onClick={() => set({ amount: String(fromHeads) })}>Use</button></>
        : perHead ? `${lei(perHead)} a head` : 'How many came, as one number (not names). Shows what a seat earns.'} />
  )

  return (
    <>
      <Modal open={open && !creating} onClose={onClose} title={isNew ? (copyOf ? 'Add income (copy)' : 'Add income') : 'Edit payment'}>
        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void save() }}>
          {showCurrency ? (
            <div className={styles.amountRow}>
              <TextInput label="Amount" value={draft.amount} onChange={(v) => set({ amount: v })} inputMode="decimal" placeholder="0" autoFocus={isNew} name="amount" />
              <SelectInput label="Currency" value={draft.currency} onChange={(v) => set({ currency: v as Currency, fxRate: v === 'RON' ? '1' : draft.fxRate })}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </SelectInput>
            </div>
          ) : (
            <TextInput label="Amount (lei)" value={draft.amount} onChange={(v) => set({ amount: v })} inputMode="decimal" placeholder="0" autoFocus={isNew} name="amount" />
          )}
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
          {isNew && !copyOf && !draft.clientId && recentClients.length > 0 && (
            <div className={styles.chips} aria-label="Recent clients">
              {recentClients.map((c) => (
                <button key={c.id} type="button" className={styles.chip} onClick={() => pickClient(c.id)}>{c.name}</button>
              ))}
            </div>
          )}
          <SelectInput label="Client" value={draft.clientId} onChange={pickClient} name="client"
            hint={activeClients.length ? undefined : "Your own list. Add one with “+ New client…” at the bottom."}>
            <option value="">— none —</option>
            {activeClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value={NEW}>+ New client…</option>
          </SelectInput>
          {usual.length > 0 && (
            <div className={styles.chips} aria-label="Usual amounts">
              <span className={styles.panelSub}>Usual:</span>
              {usual.map((u) => {
                const same = parseAmount(draft.amount) === u.amount && draft.currency === u.currency
                return (
                  <button key={`${u.amount}-${u.currency}`} type="button" className={`${styles.chip} ${same ? styles.chipOn : ''}`}
                    onClick={() => set({ amount: String(u.amount), currency: u.currency, fxRate: u.currency === 'RON' ? '1' : draft.fxRate })}>
                    {money(u.amount, u.currency)} <span className={styles.panelSub}>×{u.n}</span>
                  </button>
                )
              })}
            </div>
          )}
          <TextInput label="Description" value={draft.description} onChange={(v) => set({ description: v })} placeholder={autoDescription === 'Payment' ? 'e.g. Coaching session' : autoDescription} name="description"
            hint={!draft.description.trim() && autoDescription !== 'Payment' ? 'Left empty, it is saved as shown.' : undefined} />
          <div className={styles.formRow}>
            <TextInput label="Date" type="date" value={draft.date} onChange={(v) => set({ date: v })} name="date"
              hint={<DateShortcuts today={today} value={draft.date} onPick={(d) => set({ date: d })} />} />
            {showStatus ? (
              <SelectInput label="Status" value={draft.status} onChange={(v) => set({ status: v as Draft['status'] })}>
                <option value="received">Received</option>
                <option value="expected">Expected</option>
              </SelectInput>
            ) : on('deals') ? attendeesField : <span />}
          </div>
          {showStatus && on('deals') && attendeesField}
          <div className={styles.formRow}>
            <TextInput label="Sessions" value={draft.sessions} onChange={(v) => set({ sessions: v })} inputMode="numeric"
              hint="A 4-session package is 4." />
            <TextInput label="Hours (optional)" value={draft.hours} onChange={(v) => set({ hours: v })} inputMode="decimal" placeholder="—"
              hint="All of it, to see what an hour keeps." />
          </div>
          <div className={styles.formRow}>
            <SelectInput label="Source" value={draft.sourceId} onChange={(v) => pickEntity('source', v)} name="source"
              hint="How it reached you: direct, a platform, an agency. “+ New…” at the bottom.">
              <option value="">— none —</option>
              {activeSources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value={NEW}>+ New source…</option>
            </SelectInput>
            <SelectInput label="Venue" value={draft.venueId} onChange={(v) => pickEntity('venue', v)} name="venue"
              hint="Where it happened, online too. “+ New…” at the bottom.">
              <option value="">— none —</option>
              {activeVenues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              <option value={NEW}>+ New venue…</option>
            </SelectInput>
          </div>
          <SelectInput label="Activity (optional)" value={draft.category} onChange={(v) => set({ category: v })}
            hint="A set list, the same everywhere and in Notion. Anything else: Other.">
            <option value="">—</option>
            {options(CATEGORY).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </SelectInput>
          <SettingsToggle label="Recurring" hint="A package, retainer or regular payout." checked={draft.recurring} onChange={(e) => set({ recurring: e.target.checked })} />

          {settings.features.tax && !taxOpen && (
            <button type="button" className={styles.disclosure} onClick={() => setTaxOpen(true)} aria-expanded={false}>
              <span>
                <b>Tax</b>
                <span className={styles.disclosureSummary}>
                  {TAXABILITY[draft.taxability]}{draft.taxability === 'taxable' ? ` · ${TAX_HANDLING[draft.taxHandling].toLowerCase()}` : ''} · VAT {VAT[draft.vat].toLowerCase()}
                  {draft.taxability === 'taxable' && draft.reserve ? ` · set aside ${lei(parseAmount(draft.reserve) || 0)}` : ''}
                  {!touched.has('taxability') && !touched.has('taxHandling') && !touched.has('vat') ? ' (suggested)' : ''}
                </span>
              </span>
              <ChevronDown size={18} aria-hidden />
            </button>
          )}
          {settings.features.tax && taxOpen && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              {/* Opens from the summary row above; closes from its own heading. */}
              <button type="button" className={styles.sectionToggle} onClick={() => setTaxOpen(false)} aria-expanded>
                Tax <ChevronDown size={16} aria-hidden style={{ transform: 'rotate(180deg)' }} />
              </button>
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
          <Findings items={warnings} onFix={(f: Fix) => {
            if (f.kind === 'amount') set({ amount: String(f.value) })
            else if (f.kind === 'fxRate') { touch('fx'); set({ fxRate: String(f.value) }) }
            else if (f.kind === 'status') set({ status: f.value as Draft['status'] })
            else { touch('reserve'); set({ reserve: String(f.value) }) }
          }} />
          <div className={styles.formActions}>
            <div>
              {!isNew && <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Button>}
              {!isNew && onDuplicate && <Button size="sm" variant="ghost" onClick={() => onDuplicate(record!)}>Copy</Button>}
            </div>
            <div>
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={busy}>{warnings.length ? 'Save anyway' : isNew ? 'Add' : 'Save'}</Button>
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
