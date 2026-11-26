/**
 * Import from Revolut (Release 2, experimental): pick a statement, review what each transaction is,
 * confirm, and undo the whole import if it went wrong. Revolut provides the transaction data;
 * you provide the business context. The file is read in this browser and never sent anywhere.
 */
import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, FileUp, FlaskConical, Undo2 } from 'lucide-react'
import { Button, ConfirmModal, Modal } from '../../ds'
import { ImportBusy, useImports, previewUndo } from '../app/import'
import { useInflow } from '../app/state'
import { BackBar } from '../components/BackBar'
import { ClientPicker } from '../components/ClientPicker'
import { blankEntity } from '../components/EntityEditor'
import { SelectInput } from '../components/fields'
import type { Choice, Kind, Row, RowFilter } from '../lib/import/classify'
import {
  canRemember, classify, effective, expandFees, KIND_LABEL, KINDS_IN, KINDS_OUT, MATCH_LABEL, ruleFrom, rowMatches, SET_ASIDE,
} from '../lib/import/classify'
import { CsvError, MAX_BYTES, parseCsv } from '../lib/import/csv'
import { blocker, buildPlan, planSignature, type Plan } from '../lib/import/plan'
import { FIELD_LABEL, readMoney, readStatement, suggestColumns, waiting, type Columns, type DateOrder, type Decimal, type Field, type Statement } from '../lib/import/revolut'
import { fold, type StateWord } from '../lib/import/locale'
import type { CsvTable } from '../lib/import/csv'
import { readJson, writeJson } from '../../shared/storage'
import type { Client, Currency, IncomeRecord } from '../domain/types'
import { ACTIVITY, CATEGORIES_BY_GROUP, COST_CATEGORY, COST_GROUP_PLAIN, CURRENCIES, options } from '../domain/vocabulary'
import { money } from '../lib/money'
import { shortDate } from '../lib/dates'
import { newId } from '../store/repo'
import { suggestReserve } from '../tax/estimate'
import type { Batch } from '../store/imports'
import styles from '../styles/ui.module.css'

type Step = 'pick' | 'review' | 'confirm' | 'done'

const FILTERS: { key: RowFilter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'in', label: 'Money in' }, { key: 'out', label: 'Money out' },
  { key: 'unclassified', label: 'Needs a decision' }, { key: 'duplicates', label: 'Possible duplicates' },
  { key: 'transfers', label: 'Transfers' }, { key: 'refunds', label: 'Refunds' },
]

const totalsLine = (m: Record<string, number>) => Object.entries(m).map(([c, v]) => money(v, c as Currency)).join(' + ') || '—'

export function ExperimentalNote() {
  return (
    <div className={`${styles.banner} ${styles.bannerInfo}`} role="note">
      <span><FlaskConical size={14} aria-hidden /> <strong>Experimental.</strong> Check what InFlow suggests before you import. The file is read on this device and never uploaded; one import can be undone as a whole.</span>
    </div>
  )
}

export function Import() {
  const { data, settings, today, saveEntity, toast } = useInflow()
  const imports = useImports()
  const [step, setStep] = useState<Step>('pick')
  const [file, setFile] = useState<{ name: string; text: string } | null>(null)
  const [fileCurrency, setFileCurrency] = useState<Currency | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<string, Partial<Choice>>>({})
  const [remember, setRemember] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<RowFilter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<string | null>(null)
  const [newClients, setNewClients] = useState<string[]>([])
  const [plan, setPlan] = useState<Plan | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<{ batch: Batch; failedAt: string | null } | null>(null)
  const [confirmUndo, setConfirmUndo] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  // Settled by hand when the file doesn't say: its columns, currency or date order. Never guessed.
  const [columns, setColumns] = useState<Columns | null>(null)
  const [dateOrder, setDateOrder] = useState<DateOrder | ''>('')
  const [answers, setAnswers] = useState<Answers>(NO_ANSWERS)
  // Set when this file's layout (its headers) was settled before: the same answers apply again.
  const [recalled, setRecalled] = useState<string | null>(null)
  // Answers about the file as a whole: its decimal mark, time zone, states, signs.
  const [said, setSaid] = useState<FileAnswers>({})
  // Asked to map the columns by hand although they were recognised (money out without a minus).
  const [remap, setRemap] = useState(false)
  const statement: Statement | null = useMemo(() => {
    if (!file) return null
    try {
      return readStatement(parseCsv(file.text), {
        ...(fileCurrency ? { fileCurrency } : {}), ...(columns ? { columns } : {}), ...(dateOrder ? { dateOrder } : {}),
        states: answers.states, directions: answers.directions, ...said,
      })
    } catch { return null }
  }, [file, fileCurrency, columns, dateOrder, answers, said])
  const ready = !!statement && !waiting(statement.needs) && !remap
  /** Keeps what was settled for this layout, so the next export of it reads straight away. */
  const keep = (patch: Partial<Layout>) => {
    if (!file) return
    const sig = layoutKey(parseCsv(file.text).header)
    const all = readJson<Record<string, Layout>>(LAYOUTS_KEY, {})
    writeJson(LAYOUTS_KEY, { ...all, [sig]: { ...all[sig], ...patch, saved: today } })
  }

  const rows = useMemo(() => (statement && ready
    ? classify(expandFees(statement.txs), { data, rules: imports.state.rules, ledger: imports.state.ledger, ownNames: imports.state.ownNames })
    : []), [statement, ready, data, imports.state])
  const choiceOf = (r: Row) => effective(r, overrides[r.tx.key])
  const shown = rows.filter((r) => rowMatches(r, choiceOf(r), filter))

  const pick = async (f: File | undefined) => {
    setError(null)
    if (!f) return
    if (f.size > MAX_BYTES) { setError(`That file is larger than ${MAX_BYTES / 1024 / 1024} MB. Export a shorter period and try again.`); return }
    if (/\.(xlsx?|pdf)$/i.test(f.name)) { setError('That is not a CSV file. In Revolut, export the statement as CSV (Excel files can be saved as CSV first).'); return }
    // Strict UTF-8: a file in another encoding would turn letters into "�" in names unseen.
    let text: string
    try {
      text = typeof f.arrayBuffer === 'function' ? new TextDecoder('utf-8', { fatal: true }).decode(await f.arrayBuffer()) : await f.text()
    } catch { setError('That file is not UTF-8 text. Export it again as CSV (UTF-8), or save it as "CSV UTF-8" in a spreadsheet.'); return }
    try { parseCsv(text) } catch (e) { setError(e instanceof CsvError ? e.message : 'That file could not be read as CSV.'); return }
    setFile({ name: f.name, text })
    setOverrides({}); setRemember(new Set()); setSelected(new Set()); setPlan(null); setResult(null)
    const known = readJson<Record<string, Layout>>(LAYOUTS_KEY, {})[layoutKey(parseCsv(text).header)]
    setFileCurrency(known?.fileCurrency ?? ''); setColumns(known?.columns ?? null); setDateOrder(known?.dateOrder ?? '')
    setAnswers({ states: known?.states ?? {}, directions: known?.directions ?? {} })
    setSaid({ ...(known?.decimal ? { decimal: known.decimal } : {}), ...(known?.timeZone ? { timeZone: known.timeZone } : {}), ...(known?.allCompleted ? { allCompleted: true } : {}) })
    setRemap(false)
    setRecalled(known ? known.saved : null)
  }

  const forget = () => {
    if (!file) return
    const all = readJson<Record<string, Layout>>(LAYOUTS_KEY, {})
    delete all[layoutKey(parseCsv(file.text).header)]
    writeJson(LAYOUTS_KEY, all)
  }

  const set = (key: string, patch: Partial<Choice>) => setOverrides((o) => ({ ...o, [key]: { ...o[key], ...patch } }))

  const bulk = (kind: Kind) => {
    const fits = (r: Row) => !r.locked && r.match.status !== 'exact' && (r.tx.direction === 'in' ? KINDS_IN : KINDS_OUT).includes(kind)
    const keys = rows.filter((r) => selected.has(r.tx.key) && fits(r)).map((r) => r.tx.key)
    setOverrides((o) => {
      const n = { ...o }
      for (const k of keys) n[k] = { ...n[k], kind, action: SET_ASIDE.includes(kind) ? 'skip' : 'import' }
      return n
    })
    toast(`${keys.length} ${keys.length === 1 ? 'row' : 'rows'}: ${KIND_LABEL[kind].toLowerCase()}`)
    setSelected(new Set())
  }

  const makeClient = async (rowKey: string, name: string) => {
    const saved = await saveEntity('client', blankEntity('client', name) as Client)
    if (!saved) return
    setNewClients((c) => [...c, saved.id])
    set(rowKey, { clientId: saved.id })
  }

  const others = data.records
  const costs = settings.features.costs ? data.costs : []
  const reserve = (x: IncomeRecord) => { const s = suggestReserve(x, others, settings.tax, today, costs); return { amount: s.amount, rulesId: s.rulesId } }

  const prepare = async () => {
    setBusy('Fetching exchange rates…')
    const needs = rows.filter((r) => r.tx.currency !== 'RON' && !r.locked).map((r) => ({ currency: r.tx.currency, date: r.tx.date }))
    const rates = await imports.rates(needs)
    const choices = new Map(rows.map((r) => [r.tx.key, choiceOf(r)]))
    setPlan(buildPlan({ rows, choices, data, features: settings.features, profile: settings.tax, rates, batch: '', suggestReserve: reserve }))
    setBusy(null)
    setStep('confirm')
  }

  const go = async () => {
    if (!statement || !file || !plan) return
    setBusy('Importing…')
    const batchId = imports.newBatchId()
    // Planned again from the data as it is now. If that is not what you reviewed (an entry edited
    // or deleted meanwhile, another tab, a rate now known), nothing is saved: you review it again.
    const needs = rows.filter((r) => r.tx.currency !== 'RON' && !r.locked).map((r) => ({ currency: r.tx.currency, date: r.tx.date }))
    const rates = await imports.rates(needs)
    const choices = new Map(rows.map((r) => [r.tx.key, choiceOf(r)]))
    const p = buildPlan({ rows, choices, data, features: settings.features, profile: settings.tax, rates, batch: batchId, suggestReserve: reserve })
    if (planSignature(p) !== planSignature(plan)) {
      setPlan(buildPlan({ rows, choices, data, features: settings.features, profile: settings.tax, rates, batch: '', suggestReserve: reserve }))
      setBusy(null)
      toast({ message: 'Something changed since you reviewed this import. Nothing was saved: check the summary again.', tone: 'danger', duration: 10000 })
      return
    }
    let res: Awaited<ReturnType<typeof imports.run>>
    try {
      res = await imports.run(p.ops, { name: file.name, rows: statement.summary.rows, from: statement.summary.from, to: statement.summary.to, currencies: statement.summary.currencies }, batchId, newClients)
    } catch (e) {
      setBusy(null)
      toast({ message: e instanceof ImportBusy ? e.message : 'The import could not start.', tone: 'danger', duration: 10000 })
      return
    }
    // Rules only from rows you decided and that went in.
    const landed = new Set([...res.batch.created.map((c) => c.key), ...Object.entries((await imports.refresh()).ledger).filter(([, e]) => e.batch === batchId).map(([k]) => k)])
    for (const r of rows) {
      const c = choiceOf(r)
      if (remember.has(r.tx.key) && landed.has(r.tx.key) && canRemember(r, c)) await imports.saveRule(ruleFrom(r, c, newId('rule'), today))
    }
    setResult(res)
    setBusy(null)
    setStep('done')
  }

  const undo = async () => {
    if (!result) return
    setConfirmUndo(false)
    setBusy('Undoing…')
    const { failed } = await imports.undo(result.batch)
    setBusy(null)
    toast({ message: failed ? `Import undone, except ${failed} ${failed === 1 ? 'entry' : 'entries'} that could not be changed.` : 'Import undone.', tone: failed ? 'danger' : 'success' })
    setResult({ ...result, batch: { ...result.batch, status: 'undone' } })
  }

  const editingRow = rows.find((r) => r.tx.key === editing) ?? null
  const decided = rows.filter((r) => !r.locked && r.match.status !== 'exact' && !blocker(r, choiceOf(r), data, settings.features)).length
  const undecided = rows.filter((r) => !r.locked && r.match.status !== 'exact' && blocker(r, choiceOf(r), data, settings.features)).length

  return (
    <>
      <BackBar />
      <h2 className={styles.sectionTitle}>Import from Revolut</h2>
      <ExperimentalNote />
      {busy && <div className={styles.banner} role="status">{busy}</div>}

      {step === 'pick' && (
        <section className={styles.panel}>
          <p className={styles.hint}>In the Revolut app: your profile → Documents &amp; statements → (Pro) account statement → Excel/CSV. Pick one account and a period; a month at a time is easiest.</p>
          <input ref={input} type="file" accept=".csv,text/csv" hidden aria-label="Statement file" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
          <Button className={styles.hit} onClick={() => input.current?.click()}><FileUp size={16} aria-hidden /> Choose a CSV file</Button>
          {error && <p className={styles.banner} role="alert">{error}</p>}
          {file && statement && (
            <div style={{ marginTop: 'var(--space-md)' }}>
              <h3 className={styles.panelTitle}>{file.name}</h3>
              {!ready ? (
                <>
                  {statement.needs.mapping && (
                    <ColumnMapper table={parseCsv(file.text)} statement={statement} onApply={(c) => { setColumns(c); keep({ columns: c }) }} />
                  )}
                  {remap && !statement.needs.mapping && (
                    <ColumnMapper table={parseCsv(file.text)} statement={statement} onApply={(c) => { setColumns(c); keep({ columns: c }); setRemap(false) }} />
                  )}
                  {!statement.needs.mapping && statement.needs.currency && (
                    <SelectInput label="This file's currency" hint="The file has no currency column. A Revolut statement is one account, in one currency." value={fileCurrency} onChange={(v) => { setFileCurrency(v as Currency); keep({ fileCurrency: v as Currency }) }}>
                      <option value="">Choose…</option>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </SelectInput>
                  )}
                  {!statement.needs.mapping && statement.needs.dateOrder && (
                    <SelectInput label="Dates in this file are written" hint={`No date in it has a day after the 12th, so "${firstSlashDate(file.text) ?? '03/04/2026'}" could be either.`} value={dateOrder} onChange={(v) => { setDateOrder(v as DateOrder); keep({ dateOrder: v as DateOrder }) }}>
                      <option value="">Choose…</option>
                      <option value="dmy">Day first (31/12/2026)</option>
                      <option value="mdy">Month first (12/31/2026)</option>
                    </SelectInput>
                  )}
                  {!statement.needs.mapping && statement.needs.decimal && (
                    <SelectInput label="The decimal mark in this file's amounts is" hint={`An amount like "${firstAmbiguous(statement, file.text) ?? '1,250'}" could be read two ways, and the amount column itself doesn't say which.`}
                      value={said.decimal ?? ''} onChange={(v) => { setSaid((x) => ({ ...x, decimal: v as Decimal })); keep({ decimal: v as Decimal }) }}>
                      <option value="">Choose…</option>
                      <option value=".">A point: 1,250.50 is one thousand two hundred fifty</option>
                      <option value=",">A comma: 1.250,50 is one thousand two hundred fifty</option>
                    </SelectInput>
                  )}
                  {!statement.needs.mapping && statement.needs.timeZone && (
                    <SelectInput label="The times in this file are" hint="Some transactions are close to midnight: whether a time is Bucharest time or UTC decides which day (and month) they belong to."
                      value={said.timeZone ?? ''} onChange={(v) => { setSaid((x) => ({ ...x, timeZone: v as 'local' | 'utc' })); keep({ timeZone: v as 'local' | 'utc' }) }}>
                      <option value="">Choose…</option>
                      <option value="local">Bucharest time</option>
                      <option value="utc">UTC</option>
                    </SelectInput>
                  )}
                  {!statement.needs.mapping && statement.needs.stateless && (
                    <div className={styles.banner} role="alert">
                      <span>This file has no state column, so pending or reversed transactions can't be told from completed ones.</span>
                      <Button size="sm" className={styles.hit} onClick={() => { setSaid((x) => ({ ...x, allCompleted: true })); keep({ allCompleted: true }) }}>Every row is completed</Button>
                    </div>
                  )}
                  {!statement.needs.mapping && statement.needs.signs && (
                    <div className={styles.banner} role="alert">
                      <span>Every amount in this file is positive, yet some rows are card payments or fees. If money out is shown without a minus, it would be read as money in.</span>
                      <Button size="sm" variant="secondary" className={styles.hit} onClick={() => setRemap(true)}>Money out has no minus: map the columns</Button>
                      <Button size="sm" variant="secondary" className={styles.hit} onClick={() => setSaid((x) => ({ ...x, positivesConfirmed: true }))}>They are all money in</Button>
                    </div>
                  )}
                  {!statement.needs.mapping && !statement.needs.currency && !statement.needs.dateOrder && (statement.needs.states.length > 0 || statement.needs.directions.length > 0) && (
                    <ValueQuestions states={statement.needs.states} directions={statement.needs.directions}
                      onApply={(a) => { const next = { states: { ...answers.states, ...a.states }, directions: { ...answers.directions, ...a.directions } }; setAnswers(next); keep(next) }} />
                  )}
                </>
              ) : (
                <>
                  <div className={styles.stats}>
                    <Stat label="Transactions" value={String(statement.summary.read)} note={`of ${statement.summary.rows} rows`} />
                    <Stat label="Dates" value={statement.summary.from ? `${shortDate(statement.summary.from)} – ${shortDate(statement.summary.to!)}` : '—'} />
                    <Stat label="Money in / out" value={`${statement.summary.incoming} / ${statement.summary.outgoing}`} />
                    <Stat label="Currencies" value={statement.summary.currencies.join(', ') || '—'} />
                  </div>
                  {statement.issues.length > 0 && (
                    <div className={styles.banner} role="alert">
                      <span><AlertTriangle size={14} aria-hidden /> {statement.issues.length} {statement.issues.length === 1 ? 'row was' : 'rows were'} not read, and won't be imported:
                        <ul>{statement.issues.slice(0, 8).map((i) => <li key={i.line}>Line {i.line}: {i.message}</li>)}</ul>
                        {statement.issues.length > 8 && <>…and {statement.issues.length - 8} more.</>}
                      </span>
                    </div>
                  )}
                  {statement.notes.length > 0 && (
                    <div className={`${styles.banner} ${styles.bannerInfo}`} role="status">
                      <span>{statement.notes.length === 1 ? 'Note' : 'Notes'}:
                        <ul>{statement.notes.slice(0, 8).map((n, k) => <li key={k}>{n.line ? `Line ${n.line}: ` : ''}{n.message}</li>)}</ul>
                      </span>
                    </div>
                  )}
                  {recalled && <p className={styles.hint}>Read the way you set it up for files like this on {shortDate(recalled)}. <button type="button" className={styles.linkButton} onClick={() => { forget(); setColumns(null); setDateOrder(''); setFileCurrency(''); setAnswers(NO_ANSWERS); setSaid({}); setRecalled(null) }}>Set it up again</button></p>}
                  {!recalled && columns && <p className={styles.hint}>Read with the columns you chose. <button type="button" className={styles.linkButton} onClick={() => setColumns(null)}>Choose again</button></p>}
                  <p className={styles.hint}>Nothing is imported yet.</p>
                  <Button className={styles.hit} disabled={!statement.txs.length} onClick={() => setStep('review')}>Review transactions</Button>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {step === 'review' && (
        <>
          <div className={styles.chips} role="group" aria-label="Show">
            {FILTERS.map((f) => {
              const n = rows.filter((r) => rowMatches(r, choiceOf(r), f.key)).length
              return <button key={f.key} type="button" className={`${styles.chip} ${filter === f.key ? styles.chipOn : ''}`} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{f.label} {n}</button>
            })}
          </div>
          <div className={styles.toolbar}>
            <label className={styles.check}>
              <input type="checkbox" checked={shown.length > 0 && shown.every((r) => selected.has(r.tx.key))}
                onChange={(e) => setSelected(e.target.checked ? new Set(shown.filter((r) => !r.locked && r.match.status !== 'exact').map((r) => r.tx.key)) : new Set())} />
              Select shown
            </label>
            {selected.size > 0 && (
              <div className={styles.buttonRow} role="group" aria-label={`For ${selected.size} selected`}>
                <Button size="sm" className={styles.hit} variant="secondary" onClick={() => bulk('income')}>Income</Button>
                <Button size="sm" className={styles.hit} variant="secondary" onClick={() => bulk('cost')}>Business cost</Button>
                <Button size="sm" className={styles.hit} variant="secondary" onClick={() => bulk('personal')}>Personal</Button>
                <Button size="sm" className={styles.hit} variant="secondary" onClick={() => bulk('transfer')}>Transfer</Button>
                <Button size="sm" className={styles.hit} variant="secondary" onClick={() => bulk('ignore')}>Leave out</Button>
              </div>
            )}
          </div>
          <div>
            {shown.length === 0 && <div className={styles.empty}>Nothing here.</div>}
            {shown.map((r) => <TxRow key={r.tx.key} row={r} choice={choiceOf(r)} why={blocker(r, choiceOf(r), data, settings.features)}
              selected={selected.has(r.tx.key)} onSelect={(on) => setSelected((s) => { const n = new Set(s); if (on) n.add(r.tx.key); else n.delete(r.tx.key); return n })}
              onOpen={() => setEditing(r.tx.key)} clientName={data.clients.find((c) => c.id === choiceOf(r).clientId)?.name} />)}
          </div>
          <div className={styles.formActions}>
            <Button variant="secondary" className={styles.hit} onClick={() => setStep('pick')}>Back</Button>
            <Button className={styles.hit} disabled={!!busy} onClick={() => void prepare()}>Continue: {decided} ready{undecided ? `, ${undecided} waiting` : ''}</Button>
          </div>
        </>
      )}

      {step === 'confirm' && plan && (
        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>Ready to import</h3>
          <ul className={styles.lineList}>
            <li>{plan.counts.records} new {plan.counts.records === 1 ? 'payment' : 'payments'}: {totalsLine(plan.totals.income)} income{Object.keys(plan.totals.recovery).length ? `, ${totalsLine(plan.totals.recovery)} cost recovery` : ''}{plan.counts.received ? ` (with ${plan.counts.received} expected marked received)` : ''}</li>
            <li>{plan.counts.costs} new {plan.counts.costs === 1 ? 'cost' : 'costs'}: {totalsLine(plan.totals.costs)}{Object.keys(plan.totals.fees).length ? `, bank fees ${totalsLine(plan.totals.fees)}` : ''}</li>
            {plan.counts.refunds > 0 && <li>{plan.counts.refunds} {plan.counts.refunds === 1 ? 'refund' : 'refunds'} to clients: {totalsLine(plan.totals.refunds)}</li>}
            {plan.counts.linked > 0 && <li>{plan.counts.linked} matched to entries you already had (kept as they are)</li>}
            <li>{plan.counts.setAside} set aside (transfers, personal, left out): remembered, so they won't ask again</li>
            {plan.counts.unsupported > 0 && <li>{plan.counts.unsupported} {plan.counts.unsupported === 1 ? 'refund' : 'refunds'} from a supplier: InFlow can't record {plan.counts.unsupported === 1 ? 'it' : 'them'}. Lower the cost by hand.</li>}
            {plan.counts.alreadyIn > 0 && <li>{plan.counts.alreadyIn} already in InFlow: skipped</li>}
            {plan.counts.never > 0 && <li>{plan.counts.never} pending, declined or reversed: never imported</li>}
          </ul>
          {plan.blocked.length > 0 && (
            <div className={styles.banner} role="status">
              <span>{plan.blocked.length} {plan.blocked.length === 1 ? 'row waits' : 'rows wait'} and won't be imported now (they'll come back next time):
                <ul>{plan.blocked.slice(0, 6).map((b) => <li key={b.key}>Line {b.line}: {b.message}</li>)}</ul>
              </span>
            </div>
          )}
          <p className={styles.hint}>Tax classification and reserves are suggested, as for a payment you add by hand. Imported payments have no sessions until you add them.</p>
          <div className={styles.formActions}>
            <Button variant="secondary" className={styles.hit} onClick={() => setStep('review')}>Back to review</Button>
            <Button className={styles.hit} disabled={!!busy || plan.ops.length === 0} onClick={() => void go()}>Import</Button>
          </div>
        </section>
      )}

      {step === 'done' && result && (
        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>{result.batch.status === 'undone' ? 'Import undone' : result.failedAt ? 'Import stopped part way' : 'Imported'}</h3>
          <p>{result.batch.created.length} added, {result.batch.linked.length} matched, {result.batch.received.length} expected marked received, {result.batch.setAside} set aside.</p>
          {result.failedAt && result.batch.status !== 'undone' && <p role="alert">A row could not be saved, so the import stopped there. Import the same file again to carry on: what is in already will be recognised.</p>}
          {result.batch.status !== 'undone' && (
            <Button variant="secondary" className={styles.hit} disabled={!!busy} onClick={() => setConfirmUndo(true)}><Undo2 size={14} aria-hidden /> Undo this import</Button>
          )}
          <Button variant="secondary" className={styles.hit} onClick={() => { setFile(null); setStep('pick') }}>Import another file</Button>
        </section>
      )}

      {editingRow && (
        <RowEditor row={editingRow} choice={choiceOf(editingRow)} why={blocker(editingRow, choiceOf(editingRow), data, settings.features)}
          onChange={(p) => set(editingRow.tx.key, p)} onClose={() => setEditing(null)}
          remember={remember.has(editingRow.tx.key)} onRemember={(on) => setRemember((s) => { const n = new Set(s); if (on) n.add(editingRow.tx.key); else n.delete(editingRow.tx.key); return n })}
          onCreateClient={(name) => void makeClient(editingRow.tx.key, name)} />
      )}
      {result && <UndoConfirm open={confirmUndo} batch={result.batch} onConfirm={() => void undo()} onCancel={() => setConfirmUndo(false)} />}
    </>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className={styles.stat}><span className={styles.statLabel}>{label}</span><span className={styles.statValue}>{value}</span>{note && <span className={styles.statNote}>{note}</span>}</div>
}

function TxRow({ row, choice, why, selected, onSelect, onOpen, clientName }: {
  row: Row; choice: Choice; why: string | null; selected: boolean; onSelect: (on: boolean) => void; onOpen: () => void; clientName?: string
}) {
  const { tx } = row
  const closed = !!row.locked || row.match.status === 'exact'
  const sign = tx.direction === 'in' ? '+' : '−'
  return (
    <div className={styles.importRow}>
      <input type="checkbox" aria-label={`Select ${tx.counterparty} ${tx.date}`} checked={selected} disabled={closed} onChange={(e) => onSelect(e.target.checked)} />
      <button type="button" className={styles.entry} onClick={onOpen} aria-label={`${tx.counterparty}, ${sign}${money(tx.amount, tx.currency)}, ${tx.date}: ${KIND_LABEL[choice.kind]}`}>
        <span className={styles.entryDate}><span className={styles.entryDay}>{Number(tx.date.slice(8, 10))}</span><span className={styles.entryDow}>{shortDate(tx.date).split(' ')[1] ?? ''}</span></span>
        <span style={{ minWidth: 0 }}>
          <span className={styles.entryTitle} style={{ display: 'block' }}>{tx.counterparty || tx.description}</span>
          <span className={styles.entrySub} style={{ display: 'block' }}>
            {closed ? (row.locked ? 'Not imported' : MATCH_LABEL.exact) : choice.action === 'link' ? 'Matches an entry you have' : choice.action === 'receive' ? 'Settles an expected payment' : KIND_LABEL[choice.kind]}
            {clientName && !closed ? ` · ${clientName}` : ''}
          </span>
          <span className={styles.tags}>
            {row.parent && <span className={styles.tag}>fee</span>}
            {row.match.status === 'likely' || row.match.status === 'possible' ? <span className={`${styles.tag} ${styles.tagAlert}`}>{MATCH_LABEL[row.match.status]}</span> : null}
            {!closed && row.confidence === 'rule' && <span className={styles.tag}>your rule</span>}
            {!closed && row.confidence === 'suggested' && choice === row.suggestion && <span className={`${styles.tag} ${styles.tagSuggested}`}>suggested</span>}
            {!closed && why && <span className={`${styles.tag} ${styles.tagReview}`}>{why}</span>}
          </span>
        </span>
        <span className={styles.entryAmount}><span className={`${styles.entryAmountMain} num`}>{sign}{money(tx.amount, tx.currency)}</span></span>
      </button>
    </div>
  )
}

function RowEditor({ row, choice, why, onChange, onClose, remember, onRemember, onCreateClient }: {
  row: Row; choice: Choice; why: string | null; onChange: (p: Partial<Choice>) => void; onClose: () => void
  remember: boolean; onRemember: (on: boolean) => void; onCreateClient: (name: string) => void
}) {
  const { data, today, on } = useInflow()
  const { tx } = row
  const kinds = tx.direction === 'in' ? KINDS_IN : KINDS_OUT
  const closed = !!row.locked || (row.match.status === 'exact' && !choice.anyway)
  const isIncome = choice.kind === 'income' || choice.kind === 'recovery'
  const isCost = choice.kind === 'cost' || choice.kind === 'fee'
  const kindValue = choice.action === 'link' ? 'link' : choice.action === 'receive' ? 'receive' : choice.kind
  return (
    <Modal open onClose={onClose} title={`${tx.direction === 'in' ? '+' : '−'}${money(tx.amount, tx.currency)} · ${shortDate(tx.date)}`}>
      <div className={styles.form}>
        <p><strong>{tx.counterparty}</strong>{tx.description !== tx.counterparty ? <><br /><span className={styles.hint}>{tx.description}</span></> : null}</p>
        <p className={styles.hint}>Line {tx.line} · {tx.type || 'no type'} · {tx.state.toLowerCase()}{row.parent ? ' · the fee charged on top of the transaction' : ''}</p>
        <p className={styles.hint}>{row.reason}</p>
        {row.match.status !== 'new' && (
          <div className={styles.banner} role="status"><span><strong>{MATCH_LABEL[row.match.status]}.</strong> {row.match.reason}
            {row.match.candidates.length > 0 && <ul>{row.match.candidates.map((c) => <li key={c.id}>{c.label} · {c.amount} · {shortDate(c.date)}</li>)}</ul>}</span></div>
        )}
        {row.locked ? null : (
          <>
            {row.match.status === 'exact' && (
              <label className={styles.check}><input type="checkbox" checked={choice.anyway} onChange={(e) => onChange({ anyway: e.target.checked, action: e.target.checked ? 'import' : 'skip' })} /> Import it again anyway</label>
            )}
            {!closed && (
              <SelectInput label="This is" value={kindValue} onChange={(v) => {
                if (v === 'link') onChange({ action: 'link', target: row.match.candidates[0]?.id ?? null, kind: tx.direction === 'in' ? 'income' : 'cost', confirmed: false })
                else if (v === 'receive') onChange({ action: 'receive', target: row.expected[0]?.id ?? null, kind: 'income', confirmed: false })
                else onChange({ kind: v as Kind, action: SET_ASIDE.includes(v as Kind) ? 'skip' : 'import', target: null, confirmed: false, ...(v === 'refundIssued' ? { paymentId: row.refundable[0]?.id ?? null } : {}) })
              }}>
                {row.match.candidates.length > 0 && <option value="link">Already in InFlow: link to my entry</option>}
                {row.expected.length > 0 && on('expected') && <option value="receive">An expected payment arriving</option>}
                {kinds.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </SelectInput>
            )}
            {!closed && choice.action === 'link' && (
              <SelectInput label="My entry" value={choice.target ?? ''} onChange={(v) => onChange({ target: v || null, confirmed: false })}>
                {row.match.candidates.map((c) => <option key={c.id} value={c.id}>{c.label} · {c.amount} · {shortDate(c.date)}</option>)}
              </SelectInput>
            )}
            {!closed && choice.action === 'receive' && (
              <SelectInput label="Expected payment" value={choice.target ?? ''} onChange={(v) => onChange({ target: v || null, confirmed: false })}>
                {row.expected.map((c) => <option key={c.id} value={c.id}>{c.label} · {c.amount} · due {shortDate(c.date)}</option>)}
              </SelectInput>
            )}
            {!closed && row.match.status === 'possible' && choice.action === 'import' && (
              <label className={styles.check}><input type="checkbox" checked={choice.anyway} onChange={(e) => onChange({ anyway: e.target.checked })} /> It's a different transaction: import it anyway</label>
            )}
            {!closed && choice.action === 'import' && (isIncome || isCost || choice.kind === 'refundIssued') && (
              <ClientPicker clients={data.clients} records={data.records} today={today} value={choice.clientId ?? ''} onPick={(v) => onChange({ clientId: v || null })}
                onCreate={(name) => onCreateClient(name || tx.counterparty)} empty="No client" hint={isIncome ? 'Suggested only when the name is exactly a client of yours.' : undefined} />
            )}
            {!closed && choice.action === 'import' && isIncome && (
              <>
                <SelectInput label="Source" value={choice.sourceId ?? ''} onChange={(v) => onChange({ sourceId: v || null })}>
                  <option value="">None</option>
                  {data.sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </SelectInput>
                {choice.kind === 'income' && (
                  <SelectInput label="Activity" value={choice.category ?? ''} onChange={(v) => onChange({ category: (v || null) as Choice['category'] })}>
                    <option value="">None</option>
                    {options(ACTIVITY).filter((o) => o.value !== 'reimbursement').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </SelectInput>
                )}
                {choice.kind === 'recovery' && on('costs') && (
                  <SelectInput label="Cost it pays back" value={choice.repaysCostId ?? ''} onChange={(v) => onChange({ repaysCostId: v || null })} hint="Part of a cost is fine.">
                    <option value="">Not linked</option>
                    {data.costs.filter((c) => c.currency === tx.currency && c.date <= tx.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40)
                      .map((c) => <option key={c.id} value={c.id}>{c.description} · {money(c.amount, c.currency)} · {shortDate(c.date)}</option>)}
                  </SelectInput>
                )}
              </>
            )}
            {!closed && choice.action === 'import' && (isIncome || isCost) && on('deals') && (
              <SelectInput label="Venue" value={choice.venueId ?? ''} onChange={(v) => onChange({ venueId: v || null })} hint="Never guessed: only what you pick, or a rule you saved.">
                <option value="">None</option>
                {data.venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </SelectInput>
            )}
            {!closed && choice.action === 'import' && choice.kind === 'cost' && (
              <>
                <SelectInput label="Kind of cost" value={choice.costGroup} onChange={(v) => onChange({ costGroup: v as Choice['costGroup'] })}>
                  {options(COST_GROUP_PLAIN).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </SelectInput>
                <SelectInput label="Category" value={choice.costCategory} onChange={(v) => onChange({ costCategory: v as Choice['costCategory'] })}>
                  {CATEGORIES_BY_GROUP[choice.costGroup].map((c) => <option key={c} value={c}>{COST_CATEGORY[c]}</option>)}
                </SelectInput>
                <label className={styles.check}><input type="checkbox" checked={choice.deductible} onChange={(e) => onChange({ deductible: e.target.checked })} /> Deductible (as for a cost you add by hand; check it)</label>
              </>
            )}
            {!closed && choice.action === 'import' && choice.kind === 'refundIssued' && (
              <SelectInput label="Payment refunded" value={choice.paymentId ?? ''} onChange={(v) => onChange({ paymentId: v || null, confirmed: false })}>
                <option value="">Choose…</option>
                {data.records.filter((r) => r.status === 'received' && r.currency === tx.currency && r.date <= tx.date && (!choice.clientId || r.clientId === choice.clientId))
                  .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40)
                  .map((r) => <option key={r.id} value={r.id}>{r.description} · {money(r.amount, r.currency)} · {shortDate(r.date)}</option>)}
              </SelectInput>
            )}
            {!closed && ((choice.action === 'link' || choice.action === 'receive') && choice.target || (choice.action === 'import' && choice.kind === 'refundIssued' && choice.paymentId)) && (
              <label className={styles.check}><input type="checkbox" checked={choice.confirmed} onChange={(e) => onChange({ confirmed: e.target.checked })} />
                {choice.action === 'link' ? ' Yes: this transaction is that entry. Only its import mark changes.'
                  : choice.action === 'receive' ? ' Yes: this money settles that expected payment.'
                    : ' Yes: this refunds that payment.'}
              </label>
            )}
            {!closed && canRemember(row, choice) && (
              <label className={styles.check}><input type="checkbox" checked={remember} onChange={(e) => onRemember(e.target.checked)} /> Next time, treat “{tx.counterparty}” the same way</label>
            )}
            {why && !closed && <p className={styles.hint} role="status"><AlertTriangle size={12} aria-hidden /> {why}</p>}
          </>
        )}
        <div className={styles.formActions}><Button className={styles.hit} onClick={onClose}>Done</Button></div>
      </div>
    </Modal>
  )
}

export function UndoConfirm({ open, batch, onConfirm, onCancel }: { open: boolean; batch: Batch; onConfirm: () => void; onCancel: () => void }) {
  const { data } = useInflow()
  const p = previewUndo(batch, data)
  const edited = p.remove.filter((r) => r.edited).length + p.unreceive.filter((r) => r.edited).length
  const parts = [
    `${p.remove.length} ${p.remove.length === 1 ? 'entry' : 'entries'} it added will be deleted${edited ? `, ${p.remove.filter((r) => r.edited).length} of them edited since` : ''}.`,
    p.unlink.length ? `${p.unlink.length} of your own entries it matched stay, just unmarked.` : '',
    p.unreceive.filter((r) => !r.edited).length ? `${p.unreceive.filter((r) => !r.edited).length} expected ${p.unreceive.length === 1 ? 'payment goes' : 'payments go'} back to expected.` : '',
    p.unreceive.some((r) => r.edited) ? `${p.unreceive.filter((r) => r.edited).length} received since edited stay as they are.` : '',
    p.keep.length ? `${p.keep.length} stay because something added since depends on them: ${p.keep.map((k) => k.why).join(' ')}` : '',
    p.clients ? `${p.clients} ${p.clients === 1 ? 'client' : 'clients'} made during the review stay.` : '',
    p.gone ? `${p.gone} already deleted.` : '',
  ].filter(Boolean).join(' ')
  return <ConfirmModal isOpen={open} title="Undo this import?" message={parts} confirmText="Undo import" variant="danger" onConfirm={onConfirm} onCancel={onCancel} />
}

const firstSlashDate = (text: string) => text.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/)?.[0] ?? null

interface Answers { states: Record<string, StateWord>; directions: Record<string, 'in' | 'out'> }
const NO_ANSWERS: Answers = { states: {}, directions: {} }

/** What was settled for one file layout (its headers), kept on this device. Only choices, never file contents. */
interface FileAnswers { decimal?: Decimal; timeZone?: 'local' | 'utc'; allCompleted?: boolean; positivesConfirmed?: boolean }
/** Kept per layout: never `positivesConfirmed`, which is about one file's contents. */
interface Layout extends Partial<Answers> { columns?: Columns; dateOrder?: DateOrder; fileCurrency?: Currency; decimal?: Decimal; timeZone?: 'local' | 'utc'; allCompleted?: boolean; saved: string }

/** The first amount in the file that reads two ways, for the question. */
const firstAmbiguous = (s: Statement, text: string): string | null => {
  const t = parseCsv(text)
  for (const f of ['amount', 'moneyIn', 'moneyOut'] as const) {
    const i = s.map.columns[f]
    if (i === undefined) continue
    for (const r of t.rows) { const v = (r.cells[i] ?? '').trim(); const m = v ? readMoney(v, null) : null; if (m && !m.ok && /could be/.test(m.error)) return v }
  }
  return null
}
const LAYOUTS_KEY = 'inflow:import-layouts'
const layoutKey = (header: string[]) => header.map(fold).join('|')

const STATE_CHOICES: { value: StateWord; label: string }[] = [
  { value: 'COMPLETED', label: 'Completed: the money moved' }, { value: 'PENDING', label: 'Pending: not yet' },
  { value: 'REVERTED', label: 'Reversed or refunded by the bank' }, { value: 'DECLINED', label: 'Declined' },
  { value: 'FAILED', label: 'Failed' }, { value: 'CANCELLED', label: 'Cancelled' },
]

/** States or directions written in words InFlow doesn't know (another app language): asked, once per layout. */
function ValueQuestions({ states, directions, onApply }: { states: string[]; directions: string[]; onApply: (a: Answers) => void }) {
  const [st, setSt] = useState<Record<string, StateWord | ''>>({})
  const [dir, setDir] = useState<Record<string, 'in' | 'out' | ''>>({})
  const done = states.every((v) => st[v]) && directions.every((v) => dir[v])
  return (
    <div>
      <div className={styles.banner} role="alert"><span>Some values are in words InFlow doesn't know, perhaps because of the app's language. Say what each means; nothing is read until you do.</span></div>
      {states.map((v) => (
        <SelectInput key={`s-${v}`} label={`State “${v}” means`} value={st[v] ?? ''} onChange={(x) => setSt((p) => ({ ...p, [v]: x as StateWord }))}>
          <option value="">Choose…</option>
          {STATE_CHOICES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </SelectInput>
      ))}
      {directions.map((v) => (
        <SelectInput key={`d-${v}`} label={`“${v}” means`} value={dir[v] ?? ''} onChange={(x) => setDir((p) => ({ ...p, [v]: x as 'in' | 'out' }))}>
          <option value="">Choose…</option>
          <option value="in">Money in</option>
          <option value="out">Money out</option>
        </SelectInput>
      ))}
      <Button className={styles.hit} disabled={!done} onClick={() => onApply({
        states: Object.fromEntries(states.map((v) => [fold(v), st[v] as StateWord])),
        directions: Object.fromEntries(directions.map((v) => [fold(v), dir[v] as 'in' | 'out'])),
      })}>Read with these answers</Button>
    </div>
  )
}

const MAPPED: Field[] = ['started', 'completed', 'amount', 'direction', 'moneyIn', 'moneyOut', 'currency', 'description', 'counterparty', 'fee', 'reference', 'state', 'type', 'balance', 'id']

/**
 * When the columns can't be told apart by name: says why, and lets you say which column is which.
 * Starts from what was recognised; reads nothing until you apply it.
 */
function ColumnMapper({ table, statement, onApply }: { table: CsvTable; statement: Statement; onApply: (c: Columns) => void }) {
  const { header } = table
  // Recognised by name first; the rest suggested from what each column holds, for you to check.
  const [guessed] = useState<Columns>(() => suggestColumns(table, statement.map.columns))
  const [pick, setPick] = useState<Columns>(() => ({ ...guessed, ...statement.map.columns }))
  const set = (f: Field, v: string) => setPick((p) => { const n = { ...p }; if (v === '') delete n[f]; else n[f] = Number(v); return n })
  const { map } = statement
  return (
    <div>
      <div className={styles.banner} role="alert">
        <span>InFlow can't tell for certain what this file's columns are, so it reads nothing until you say.
          <ul>
            {map.missing.map((m) => <li key={m}>No column for {m}.</li>)}
            {map.conflicts.map((c) => <li key={c}>{c}</li>)}
            {map.unknown.length > 0 && <li>Not recognised: {map.unknown.join(', ')}.</li>}
            {map.unused.length > 0 && <li>Recognised and not used: {map.unused.join(', ')}{map.unused.some((u) => /total amount/i.test(u)) ? ' ("Total amount" may include the fee)' : ''}.</li>}
          </ul>
        </span>
      </div>
      <p className={styles.hint}>Say which column holds what, whatever language its name is in. Use either a signed Amount (money out negative), an Amount with a Direction column, or Money in and Money out. InFlow remembers your choice for files with these same columns.</p>
      <div className={styles.formRow}>
        {MAPPED.map((f) => (
          <SelectInput key={f} label={FIELD_LABEL[f]} value={pick[f] === undefined ? '' : String(pick[f])} onChange={(v) => set(f, v)}
            hint={guessed[f] !== undefined && pick[f] === guessed[f] ? 'Suggested from what the column holds: check it.' : undefined}>
            <option value="">None</option>
            {header.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
          </SelectInput>
        ))}
      </div>
      <Button className={styles.hit} onClick={() => onApply(pick)}>Read with these columns</Button>
    </div>
  )
}
