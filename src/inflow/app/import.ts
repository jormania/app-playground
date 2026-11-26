/**
 * Saving an import, and undoing one (Release 2, experimental). The plan (`lib/import/plan.ts`)
 * says what to save; this saves it through the same provider actions every screen uses, one row
 * at a time, writing each row to the ledger as soon as it lands. An import stopped halfway (a tab
 * closed, Notion busy) is resumed by importing the same file again: what landed carries its key
 * and shows as already in InFlow; the rest is still new.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CostRecord, Currency, ImportMeta, IncomeRecord, InflowData, Refund } from '../domain/types'
import { lastRate } from '../lib/guards'
import type { Kind, Rule } from '../lib/import/classify'
import { rateKey, type Op } from '../lib/import/plan'
import { fetchRonRate } from '../lib/money'
import { newId } from '../store/repo'
import { EMPTY_IMPORTS, loadImports, stamp, updateImports, type Batch, type ImportState } from '../store/imports'
import { useInflow } from './state'

export interface RunResult {
  batch: Batch
  /** Rows that did not save; the import stopped there. Running the same file again picks up from it. */
  failedAt: string | null
}

export interface UndoPreview {
  remove: { kind: 'record' | 'cost' | 'refund'; id: string; label: string; edited: boolean }[]
  /** Kept: something added since depends on it (a refund, a reimbursement link). */
  keep: { kind: 'record' | 'cost' | 'refund'; id: string; label: string; why: string }[]
  unlink: { kind: 'record' | 'cost' | 'refund'; id: string; label: string }[]
  /** Expected payments put back as expected; `edited` ones are left as they are now. */
  unreceive: { id: string; label: string; edited: boolean }[]
  gone: number
  clients: number
}

const find = (d: InflowData, kind: 'record' | 'cost' | 'refund', id: string) =>
  kind === 'record' ? d.records.find((x) => x.id === id) : kind === 'cost' ? d.costs.find((x) => x.id === id) : d.refunds.find((x) => x.id === id)

const label = (x: IncomeRecord | CostRecord | Refund | undefined) =>
  !x ? '' : 'description' in x ? `${x.description} · ${x.amount} ${x.currency} · ${x.date}` : `Refund · ${x.amount} ${x.currency} · ${x.date}`

/** What undoing a batch would do, from the data as it is now. Pure. */
export function previewUndo(batch: Batch, d: InflowData): UndoPreview {
  const p: UndoPreview = { remove: [], keep: [], unlink: [], unreceive: [], gone: 0, clients: batch.clients.length }
  const mine = new Set(batch.created.map((c) => c.id))
  for (const c of batch.created) {
    const x = find(d, c.kind, c.id)
    if (!x) { p.gone++; continue }
    if (c.kind === 'record') {
      const others = d.refunds.filter((f) => f.paymentId === c.id && !mine.has(f.id))
      if (others.length) { p.keep.push({ kind: c.kind, id: c.id, label: label(x), why: `${others.length === 1 ? 'A refund' : `${others.length} refunds`} added since are against it.` }); continue }
    }
    if (c.kind === 'cost') {
      const repaid = d.records.filter((r) => r.repaysCostId === c.id && !mine.has(r.id))
      if (repaid.length) { p.keep.push({ kind: c.kind, id: c.id, label: label(x), why: 'A reimbursement added since names it.' }); continue }
    }
    p.remove.push({ kind: c.kind, id: c.id, label: label(x), edited: stamp(x) !== c.stamp })
  }
  for (const l of batch.linked) {
    const x = find(d, l.kind, l.id)
    if (x && x.importMeta?.batch === batch.id) p.unlink.push({ kind: l.kind, id: l.id, label: label(x) })
  }
  for (const r of batch.received) {
    const x = d.records.find((y) => y.id === r.receivedId)
    if (!x) { p.gone++; continue }
    p.unreceive.push({ id: r.receivedId, label: label(x), edited: stamp(x) !== r.stamp })
  }
  return p
}

export function useImports() {
  const { data, importStore, saveRecord, saveCost, saveRefund, deleteRecord, deleteCost, deleteRefund } = useInflow()
  const [state, setState] = useState<ImportState>(EMPTY_IMPORTS)
  const [ready, setReady] = useState(false)
  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data }, [data])

  const refresh = useCallback(async () => {
    const s = await loadImports(importStore.store, importStore.key).catch(() => EMPTY_IMPORTS)
    setState(s)
    setReady(true)
    return s
  }, [importStore])
  useEffect(() => { void refresh() }, [refresh])

  const change = useCallback(async (fn: (s: ImportState) => ImportState) => {
    const next = await updateImports(importStore.store, importStore.key, fn)
    setState(next)
    return next
  }, [importStore])

  /** The day's rate for each currency and date needed, from the ECB; offline, the last one used. */
  const rates = useCallback(async (needs: { currency: Currency; date: string }[]): Promise<Map<string, number>> => {
    const out = new Map<string, number>()
    const unique = [...new Map(needs.filter((n) => n.currency !== 'RON').map((n) => [rateKey(n.currency, n.date), n])).values()]
    for (const n of unique) {
      const r = (await fetchRonRate(n.currency, n.date)) ?? lastRate(n.currency, [...dataRef.current.records, ...dataRef.current.costs])
      if (r) out.set(rateKey(n.currency, n.date), r)
    }
    return out
  }, [])

  const run = useCallback(async (ops: Op[], file: Batch['file'], batchId: string, clients: string[]): Promise<RunResult> => {
    const batch: Batch = { id: batchId, at: new Date().toISOString(), file, status: 'running', created: [], linked: [], received: [], setAside: 0, clients }
    await change((s) => ({ ...s, batches: [batch, ...s.batches] }))
    const log = async (key: string, kind: Kind, outcome: 'created' | 'linked' | 'received' | 'skipped', target: string | undefined, patch: (b: Batch) => Batch) => {
      await change((s) => ({
        ...s,
        ledger: { ...s.ledger, [key]: { batch: batchId, outcome, kind, ...(target ? { target } : {}) } },
        batches: s.batches.map((b) => (b.id === batchId ? patch(b) : b)),
      }))
    }
    let failedAt: string | null = null
    for (const op of ops) {
      if (op.op === 'skip') {
        await log(op.key, op.kind, 'skipped', undefined, (b) => ({ ...b, setAside: b.setAside + 1 }))
        continue
      }
      if (op.op === 'createRecord' || op.op === 'createCost' || op.op === 'createRefund') {
        const saved = op.op === 'createRecord' ? await saveRecord(op.record) : op.op === 'createCost' ? await saveCost(op.cost) : await saveRefund(op.refund)
        if (!saved) { failedAt = op.key; break }
        const kind = op.op === 'createRecord' ? 'record' : op.op === 'createCost' ? 'cost' : 'refund'
        await log(op.key, op.kind, 'created', saved.id, (b) => ({ ...b, created: [...b.created, { kind, id: saved.id, key: op.key, stamp: stamp(saved) }] }))
        continue
      }
      if (op.op === 'link') {
        const x = find(dataRef.current, op.target.kind, op.target.id)
        if (!x) { failedAt = op.key; break }
        const before: ImportMeta | null = x.importMeta ?? null
        const meta: ImportMeta = { key: op.key, batch: batchId, counterparty: op.counterparty, matched: true }
        const saved = op.target.kind === 'record' ? await saveRecord({ ...(x as IncomeRecord), importMeta: meta })
          : op.target.kind === 'cost' ? await saveCost({ ...(x as CostRecord), importMeta: meta })
            : await saveRefund({ ...(x as Refund), importMeta: meta })
        if (!saved) { failedAt = op.key; break }
        await log(op.key, op.kind, 'linked', saved.id, (b) => ({ ...b, linked: [...b.linked, { kind: op.target.kind, id: saved.id, key: op.key, before }] }))
        continue
      }
      // receive
      const before = dataRef.current.records.find((r) => r.id === op.expectedId)
      if (!before) { failedAt = op.key; break }
      const got = await saveRecord(op.received)
      if (!got) { failedAt = op.key; break }
      const part = !!op.remaining
      if (op.remaining && !(await saveRecord(op.remaining))) {
        // The money is recorded; the expected payment still shows its old amount. Logged so undo can put it right.
        await log(op.key, op.kind, 'received', got.id, (b) => ({ ...b, received: [...b.received, { key: op.key, expectedId: op.expectedId, receivedId: got.id, before, stamp: stamp(got), part }] }))
        failedAt = op.key
        break
      }
      await log(op.key, op.kind, 'received', got.id, (b) => ({ ...b, received: [...b.received, { key: op.key, expectedId: op.expectedId, receivedId: got.id, before, stamp: stamp(got), part }] }))
    }
    const next = await change((s) => ({ ...s, batches: s.batches.map((b) => (b.id === batchId ? { ...b, status: 'done' } : b)) }))
    return { batch: next.batches.find((b) => b.id === batchId)!, failedAt }
  }, [change, saveRecord, saveCost, saveRefund])

  /** Undoes a batch as `previewUndo` describes. Returns how many entries could not be put back. */
  const undo = useCallback(async (batch: Batch): Promise<{ failed: number }> => {
    const d = dataRef.current
    const p = previewUndo(batch, d)
    let failed = 0
    // Refunds first, so a payment never goes before its refund; then payments and costs.
    const order = { refund: 0, record: 1, cost: 2 }
    for (const r of [...p.remove].sort((a, b) => order[a.kind] - order[b.kind])) {
      const x = find(dataRef.current, r.kind, r.id)
      if (!x) continue
      const ok = r.kind === 'record' ? await deleteRecord(x as IncomeRecord, { quiet: true })
        : r.kind === 'cost' ? await deleteCost(x as CostRecord, { quiet: true }) : await deleteRefund(x as Refund, { quiet: true })
      if (!ok) failed++
    }
    for (const l of p.unlink) {
      const x = find(dataRef.current, l.kind, l.id)
      const before = batch.linked.find((y) => y.id === l.id)?.before ?? null
      if (!x) continue
      const saved = l.kind === 'record' ? await saveRecord({ ...(x as IncomeRecord), importMeta: before })
        : l.kind === 'cost' ? await saveCost({ ...(x as CostRecord), importMeta: before }) : await saveRefund({ ...(x as Refund), importMeta: before })
      if (!saved) failed++
    }
    for (const u of p.unreceive.filter((x) => !x.edited)) {
      const r = batch.received.find((y) => y.receivedId === u.id)!
      const now = dataRef.current.records.find((y) => y.id === r.receivedId)
      if (r.part && now && !(await deleteRecord(now, { quiet: true }))) { failed++; continue }
      // The expected payment as it was before the money arrived (the same record when paid in full).
      if (!(await saveRecord(r.before))) failed++
    }
    await change((s) => ({
      ...s,
      ledger: Object.fromEntries(Object.entries(s.ledger).filter(([, e]) => e.batch !== batch.id)),
      batches: s.batches.map((b) => (b.id === batch.id ? { ...b, status: 'undone', undoneAt: new Date().toISOString() } : b)),
    }))
    return { failed }
  }, [change, deleteRecord, deleteCost, deleteRefund, saveRecord, saveCost, saveRefund])

  const saveRule = useCallback((r: Rule) => change((s) => ({ ...s, rules: [...s.rules.filter((x) => x.id !== r.id), r] })), [change])
  const deleteRule = useCallback((id: string) => change((s) => ({ ...s, rules: s.rules.filter((x) => x.id !== id) })), [change])
  const setOwnNames = useCallback((names: string[]) => change((s) => ({ ...s, ownNames: [...new Set(names.map((n) => n.trim()).filter(Boolean))] })), [change])

  return { state, ready, refresh, rates, run, undo, saveRule, deleteRule, setOwnNames, newBatchId: () => newId('imp') }
}
