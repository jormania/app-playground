/**
 * App state: settings, the loaded data, the selected period, and every action
 * that writes. One context, because every screen reads the same records and
 * the same period.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { indexedDbStore, type KeyValueStore } from '../../shared/kvStore'
import { readJson, writeJson } from '../../shared/storage'
import { useToastStack, type ToastInput } from '../../ds'
import { buildDemo, demoOpening, hasDemo, withoutDemo } from '../data/demo'
import type { CostRecord, FeatureKey, IncomeRecord, InflowData, Refund, Settings, Venue, Workspace } from '../domain/types'
import { sameTerms, stampTerms, termsOf } from '../lib/deals'
import { paymentEditError, refundError, refundsOf, withRefunds } from '../lib/refunds'
import { todayString, type PeriodChoice } from '../lib/period'
import { copyToNotion, NotionRepo, type CopyResult } from '../store/notion'
import { DATA_CHANNEL, DEMO_KEY, DeviceRepo, EMPTY, TAB_ID, normalise, type DataChange, type Entity, type EntityKind, type Repo, listKey } from '../store/repo'
import { featureOn, loadSettings, mergeSettings, notionReady, saveSettings, type SettingsPatch } from '../store/settings'
import type { Backup } from '../store/backup'
import { importKey } from '../store/imports'

const PERIOD_KEY = 'inflow:period'
/** Device id → Notion id of every row already copied, per Income database (`copyToNotion`). */
export const COPY_LOG_KEY = 'inflow:notion-copy'
/** This device's data as it was just before the last restore, kept for Undo. */
export const PRE_RESTORE_KEY = 'pre-restore'

export type LoadState = 'loading' | 'ready' | 'error'

export interface IncomeFilter {
  query: string
  clientId: string
  sourceId: string
  venueId: string
  /** Activity: the record's `category`. */
  activity: string
  taxability: string
  status: string
}

/** Which filter field narrows the income list to one client, source, venue or work type. */
export const DIM_FILTER = { client: 'clientId', source: 'sourceId', venue: 'venueId', activity: 'activity' } as const

export const EMPTY_FILTER: IncomeFilter = { query: '', clientId: '', sourceId: '', venueId: '', activity: '', taxability: '', status: '' }


interface InflowState {
  today: string
  settings: Settings
  updateSettings: (patch: SettingsPatch) => void
  /** A feature is on, and so is whatever it needs. */
  on: (key: FeatureKey) => boolean
  data: InflowData
  /**
   * `data` with each refund's adjustment row added to the records (`lib/refunds.ts`). Every
   * figure (totals, P&L, cash flow, tax, deals, reports) reads this; lists and forms read `data`.
   */
  books: InflowData
  load: LoadState
  error: string | null
  offlineCopy: boolean
  reload: () => Promise<void>
  period: PeriodChoice
  setPeriod: (p: PeriodChoice) => void
  filter: IncomeFilter
  setFilter: (f: IncomeFilter) => void
  saveRecord: (r: IncomeRecord) => Promise<IncomeRecord | null>
  /** `quiet`: no toast with Undo (a batch undo reports once for all). True when deleted. */
  deleteRecord: (r: IncomeRecord, opts?: { quiet?: boolean }) => Promise<boolean>
  /** Refund part or all of a received payment; refused (with a message) beyond what is left. */
  saveRefund: (f: Refund) => Promise<Refund | null>
  deleteRefund: (f: Refund, opts?: { quiet?: boolean }) => Promise<boolean>
  saveCost: (c: CostRecord) => Promise<CostRecord | null>
  deleteCost: (c: CostRecord, opts?: { quiet?: boolean }) => Promise<boolean>
  /** False in Notion mode when no Costs database sits next to Income. */
  costsAvailable: boolean
  saveEntity: <T extends Entity>(kind: EntityKind, e: T) => Promise<T | null>
  deleteEntity: (kind: EntityKind, id: string) => Promise<void>
  /** Demo or your own data; switching keeps both as they are. */
  workspace: Workspace
  setWorkspace: (w: Workspace) => void
  /** Removes the demo from this device and shows your data; the toast offers it back. */
  clearDemo: () => Promise<void>
  /** Shows the demo, building it afresh if it was cleared. */
  loadDemo: () => Promise<void>
  /** Puts the demo back as it started, dropping changes made while exploring. */
  resetDemo: () => Promise<void>
  /** True when the backup was restored; false (with a message) when nothing changed. */
  restore: (b: Backup) => Promise<boolean>
  copyDeviceToNotion: (onProgress?: (done: number, total: number) => void) => Promise<CopyResult>
  /** Your own data on this device (not the demo) has something in it. */
  deviceHasOwnData: boolean
  /** Where this workspace's import history, rules and ledger live (Release 2, experimental): one per data set. */
  importStore: { store: KeyValueStore; key: string }
  /** Notion only: the row an import made for this key, looked up in Notion; null on this device or when none. */
  findImported: (kind: 'record' | 'cost' | 'refund', key: string) => Promise<string | null>
  toast: (t: ToastInput | string) => void
  toasts: ReturnType<typeof useToastStack>
}

const Ctx = createContext<InflowState | null>(null)

export function useInflow(): InflowState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useInflow outside InflowProvider')
  return v
}

export interface ProviderProps {
  children: ReactNode
  /** Injected in tests; IndexedDB in the browser. */
  store?: KeyValueStore
  /** Injected in tests to pin the date. */
  today?: string
  /** Injected in tests to replace the Notion repo. */
  notionRepo?: Repo
}

export function InflowProvider({ children, store: injected, today: fixedToday, notionRepo }: ProviderProps) {
  const store = useMemo(() => injected ?? indexedDbStore('inflow'), [injected])
  const today = fixedToday ?? todayString()
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [data, setData] = useState<InflowData>(EMPTY)
  const [deviceData, setDeviceData] = useState<InflowData>(EMPTY)
  const [load, setLoad] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [offlineCopy, setOfflineCopy] = useState(false)
  const [period, setPeriodState] = useState<PeriodChoice>(() => readJson<PeriodChoice>(PERIOD_KEY, { preset: 'month' }))
  const [filter, setFilter] = useState<IncomeFilter>(EMPTY_FILTER)
  const [costsAvailable, setCostsAvailable] = useState(true)
  const toasts = useToastStack()
  const { push } = toasts
  const toast = useCallback((t: ToastInput | string) => { push(typeof t === 'string' ? { message: t } : t) }, [push])

  const device = useMemo(() => new DeviceRepo(store), [store])
  const demoRepo = useMemo(() => new DeviceRepo(store, DEMO_KEY), [store])
  const useNotion = notionReady(settings)
  const workspace: Workspace = settings.workspace ?? 'mine'
  const repo: Repo = useMemo(
    () => (settings.workspace === 'demo' ? demoRepo
      : useNotion ? notionRepo ?? new NotionRepo(settings.notionToken, settings.incomeDbId, store) : device),
    [settings.workspace, demoRepo, useNotion, notionRepo, settings.notionToken, settings.incomeDbId, store, device],
  )

  const settingsRef = useRef(settings)
  settingsRef.current = settings
  // The repo on screen now. A load or save that finishes after a switch (demo ↔
  // your data, device ↔ Notion) must not paint its rows into the other one.
  const repoRef = useRef(repo)
  repoRef.current = repo

  const updateSettings = useCallback((patch: SettingsPatch) => {
    setSettings((cur) => {
      const next = mergeSettings(cur, patch)
      saveSettings(next)
      return next
    })
  }, [])

  const setPeriod = useCallback((p: PeriodChoice) => {
    setPeriodState(p)
    writeJson(PERIOD_KEY, p)
  }, [])

  const reload = useCallback(async () => {
    setLoad((s) => (s === 'ready' ? s : 'loading'))
    setError(null)
    try {
      let dev = await device.load()
      let demo = await demoRepo.load()
      // An older InFlow kept the demo in the same list as your data: split it off.
      const mixed = hasDemo(dev)
      if (mixed) {
        dev = withoutDemo(dev)
        await device.replaceAll(dev)
      }
      let ws = settingsRef.current.workspace
      if (ws === null) {
        const own = dev.records.length > 0 || dev.costs.length > 0 || notionReady(settingsRef.current)
        // A first run opens on the demo, so the app is never an empty page.
        ws = own ? 'mine' : !settingsRef.current.demoSeeded || mixed || demo.records.length > 0 ? 'demo' : 'mine'
        updateSettings({ workspace: ws, demoSeeded: true })
        // The repo follows the workspace on the next render, and this runs again.
        if (ws === 'demo') return
      }
      if (ws === 'demo' && demo.records.length === 0) {
        demo = buildDemo(today, settingsRef.current.tax)
        await demoRepo.replaceAll(demo)
      }
      setDeviceData(dev)
      if (repoRef.current !== repo) return
      if (repo === demoRepo || repo === device) {
        setData(repo === demoRepo ? demo : dev)
        setCostsAvailable(true)
        setOfflineCopy(false)
      } else {
        const cached = repo instanceof NotionRepo ? await repo.cached() : EMPTY
        if (repoRef.current !== repo) return
        if (cached.records.length || cached.clients.length) setData(cached)
        try {
          const fresh = await repo.load()
          if (repoRef.current !== repo) return
          setData(fresh)
          setCostsAvailable(!(repo instanceof NotionRepo) || repo.hasCosts)
          setOfflineCopy(false)
        } catch (e) {
          if (repoRef.current !== repo) return
          if (cached.records.length || cached.clients.length) {
            setOfflineCopy(true)
            setError(`Showing the last copy from Notion: ${(e as Error).message}`)
          } else throw e
        }
      }
      setLoad('ready')
    } catch (e) {
      if (repoRef.current !== repo) return
      setError((e as Error).message || 'Could not load your data.')
      setLoad('error')
    }
  }, [device, demoRepo, repo, today, updateSettings])

  useEffect(() => { void reload() }, [reload])

  // Another tab saved to this device: show its change here too, so this tab never works from a
  // copy older than what is stored (writes are safe either way: see DeviceRepo).
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel(DATA_CHANNEL)
    ch.onmessage = (e: MessageEvent<DataChange>) => {
      if (e.data?.tab === TAB_ID) return
      if (repoRef.current === device || repoRef.current === demoRepo) void reload()
    }
    return () => ch.close()
  }, [reload, device, demoRepo])

  // Showing Notion's offline copy: when the connection comes back, load the real thing.
  useEffect(() => {
    if (!offlineCopy) return
    const back = () => { void reload() }
    window.addEventListener('online', back)
    return () => window.removeEventListener('online', back)
  }, [offlineCopy, reload])

  const apply = useCallback((fn: (d: InflowData) => InflowData) => {
    // Device data is kept whatever is on screen; the screen only takes rows from its own repo.
    if (repo === device) setDeviceData(fn)
    if (repoRef.current === repo) setData(fn)
  }, [repo, device])

  const fail = useCallback((e: unknown, what: string) => {
    toast({ message: `${what} failed: ${(e as Error).message || 'unknown error'}`, tone: 'danger', duration: 8000 })
  }, [toast])

  const dataRef = useRef(data)
  dataRef.current = data

  const saveRecordWith = useCallback(async (input: IncomeRecord, keep: boolean) => {
    try {
      const d = dataRef.current
      const stored = input.id ? d.records.find((x) => x.id === input.id) : undefined
      // A payment with refunds keeps what they depend on (D1, D2): refused here, whatever screen asked.
      const why = paymentEditError(stored, input, d.refunds)
      if (why) { toast({ message: why, tone: 'danger', duration: 8000 }); return null }
      // Each payment carries its venue's deal as it stood then (see `stampTerms`).
      const r = stampTerms(input, stored, d.venues, { keep })
      const saved = await repo.saveRecord(r)
      apply((d) => {
        const exists = d.records.some((x) => x.id === r.id && r.id)
        return { ...d, records: exists ? d.records.map((x) => (x.id === r.id ? saved : x)) : [...d.records, saved] }
      })
      return saved
    } catch (e) { fail(e, 'Saving'); return null }
  }, [repo, apply, fail, toast])

  const saveRecord = useCallback((r: IncomeRecord) => saveRecordWith(r, false), [saveRecordWith])

  const saveRefundRaw = useCallback(async (f: Refund) => {
    const payment = dataRef.current.records.find((x) => x.id === f.paymentId)
    const saved = await repo.saveRefund(f, payment)
    apply((d) => {
      const exists = !!f.id && d.refunds.some((x) => x.id === f.id)
      return { ...d, refunds: exists ? d.refunds.map((x) => (x.id === f.id ? saved : x)) : [...d.refunds, saved] }
    })
    return saved
  }, [repo, apply])

  const saveRefund = useCallback(async (f: Refund) => {
    const d = dataRef.current
    const why = refundError(f, d.records.find((x) => x.id === f.paymentId), d.refunds)
    if (why) { toast({ message: why, tone: 'danger' }); return null }
    try { return await saveRefundRaw(f) } catch (e) { fail(e, 'Saving the refund'); return null }
  }, [saveRefundRaw, toast, fail])

  const deleteRefund = useCallback(async (f: Refund, opts: { quiet?: boolean } = {}) => {
    try {
      await repo.deleteRefund(f.id)
      apply((d) => ({ ...d, refunds: d.refunds.filter((x) => x.id !== f.id) }))
      if (opts.quiet) return true
      toast({ message: 'Refund deleted', actionLabel: 'Undo', onAction: () => { void saveRefund(repo.kind === 'notion' ? { ...f, id: '' } : f) } })
      return true
    } catch (e) { fail(e, 'Deleting the refund'); return false }
  }, [repo, apply, toast, fail, saveRefund])

  const deleteRecord = useCallback(async (r: IncomeRecord, opts: { quiet?: boolean } = {}) => {
    const refunds = refundsOf(r.id, dataRef.current.refunds)
    try {
      await repo.deleteRecord(r.id, refunds.map((f) => f.id))
      apply((d) => ({ ...d, records: d.records.filter((x) => x.id !== r.id), refunds: d.refunds.filter((f) => f.paymentId !== r.id) }))
      if (opts.quiet) return true
      toast({
        message: refunds.length ? `Payment and its ${refunds.length === 1 ? 'refund' : `${refunds.length} refunds`} deleted` : 'Payment deleted',
        actionLabel: 'Undo',
        onAction: () => {
          void (async () => {
            const back = await saveRecordWith(repo.kind === 'notion' ? { ...r, id: '' } : r, true)
            if (!back) return
            try {
              for (const f of refunds) await saveRefundRaw({ ...f, id: repo.kind === 'notion' ? '' : f.id, paymentId: back.id })
            } catch (e) { fail(e, 'Putting back the refunds') }
          })()
        },
      })
      return true
    } catch (e) { fail(e, 'Deleting'); return false }
  }, [repo, apply, fail, toast, saveRecordWith, saveRefundRaw])

  const saveCost = useCallback(async (c: CostRecord) => {
    try {
      const saved = await repo.saveCost(c)
      apply((d) => {
        const exists = !!c.id && d.costs.some((x) => x.id === c.id)
        return { ...d, costs: exists ? d.costs.map((x) => (x.id === c.id ? saved : x)) : [...d.costs, saved] }
      })
      return saved
    } catch (e) { fail(e, 'Saving'); return null }
  }, [repo, apply, fail])

  const deleteCost = useCallback(async (c: CostRecord, opts: { quiet?: boolean } = {}) => {
    try {
      await repo.deleteCost(c.id)
      apply((d) => ({ ...d, costs: d.costs.filter((x) => x.id !== c.id) }))
      if (opts.quiet) return true
      toast({
        message: 'Cost deleted',
        actionLabel: 'Undo',
        onAction: () => { void saveCost(repo.kind === 'notion' ? { ...c, id: '' } : c) },
      })
      return true
    } catch (e) { fail(e, 'Deleting'); return false }
  }, [repo, apply, fail, toast, saveCost])

  const saveEntity = useCallback(async <T extends Entity>(kind: EntityKind, e: T): Promise<T | null> => {
    try {
      if (kind === 'venue' && e.id) {
        // A venue's deal changing reaches only new payments. Payments here saved before snapshots
        // existed (Notion rows from an older InFlow) are first pinned to the deal they were counted
        // under, so their figures stay as they were.
        const before = dataRef.current.venues.find((v) => v.id === e.id)
        const next = e as unknown as Venue
        if (before && !sameTerms(termsOf(before), termsOf(next))) {
          const old = termsOf(before)
          for (const r of dataRef.current.records.filter((x) => x.venueId === e.id && x.dealTerms === undefined)) {
            const pinned = await repo.saveRecord({ ...r, dealTerms: old })
            apply((d) => ({ ...d, records: d.records.map((x) => (x.id === r.id ? pinned : x)) }))
          }
        }
      }
      const saved = await repo.saveEntity(kind, e)
      const key = listKey(kind)
      apply((d) => {
        const list = d[key] as Entity[]
        const exists = e.id && list.some((x) => x.id === e.id)
        return { ...d, [key]: exists ? list.map((x) => (x.id === e.id ? saved : x)) : [...list, saved] }
      })
      return saved
    } catch (err) { fail(err, 'Saving'); return null }
  }, [repo, apply, fail])

  const deleteEntity = useCallback(async (kind: EntityKind, id: string) => {
    try {
      await repo.deleteEntity(kind, id)
      const key = listKey(kind)
      const field = kind === 'client' ? 'clientId' : kind === 'source' ? 'sourceId' : 'venueId'
      apply((d) => ({
        ...d,
        [key]: (d[key] as Entity[]).filter((x) => x.id !== id),
        records: d.records.map((r) => (r[field] === id ? { ...r, [field]: null } : r)),
        costs: d.costs.map((c) => (field !== 'sourceId' && c[field as 'clientId' | 'venueId'] === id ? { ...c, [field]: null } : c)),
      }))
    } catch (e) { fail(e, 'Deleting') }
  }, [repo, apply, fail])

  const setWorkspace = useCallback((w: Workspace) => {
    if (w === settingsRef.current.workspace) return
    setLoad('loading')
    updateSettings({ workspace: w })
  }, [updateSettings])

  const loadDemo = useCallback(async () => {
    if (settingsRef.current.workspace === 'demo') return
    setWorkspace('demo')
    toast({ message: 'Showing the demo practice. Your own data is untouched.', actionLabel: 'Back to my data', onAction: () => setWorkspace('mine') })
  }, [setWorkspace, toast])

  const clearDemo = useCallback(async () => {
    await demoRepo.replaceAll(EMPTY)
    setWorkspace('mine')
    if (settingsRef.current.workspace === 'mine') setData(deviceData)
    toast({ message: 'Demo cleared', actionLabel: 'Bring it back', onAction: () => { void loadDemo() } })
  }, [demoRepo, setWorkspace, deviceData, toast, loadDemo])

  const resetDemo = useCallback(async () => {
    const fresh = buildDemo(today, settingsRef.current.tax)
    await demoRepo.replaceAll(fresh)
    if (repo === demoRepo) setData(fresh)
    toast({ message: 'Demo reset to how it started', tone: 'success' })
  }, [today, demoRepo, repo, toast])

  /**
   * Restore a backup onto this device (audit B-07). What is here now is kept first, under its own
   * key, so the restore can be undone; nothing is replaced until that copy is safely written, and
   * a failure anywhere leaves the current data as it was and says so.
   */
  const restore = useCallback(async (b: Backup) => {
    const data = normalise(b.data)
    const before = { data: await device.load(), settings: settingsRef.current, imports: await store.get(importKey('device')) }
    try {
      await store.set(PRE_RESTORE_KEY, before.data)
      await device.replaceAll(data)
      // The import history comes back with the data it describes; a backup without one leaves yours.
      if (b.imports) await store.set(importKey('device'), b.imports)
    } catch (e) {
      // replaceAll is one write: if it failed, the stored data is still the old data.
      await device.load().then(setDeviceData).catch(() => {})
      fail(e, 'Restoring')
      return false
    }
    setDeviceData(data)
    const { notionToken: _t, ...keep } = b.settings as Settings
    updateSettings({ ...keep, features: { ...(keep.features ?? {}) }, notionToken: settingsRef.current.notionToken, mode: 'device', demoSeeded: true, workspace: 'mine' })
    if (repo === device) setData(data)
    toast({
      message: `Restored ${data.records.length} payments to this device`, tone: 'success', duration: 12000,
      actionLabel: 'Undo',
      onAction: () => {
        void (async () => {
          try {
            await device.replaceAll(before.data)
            if (b.imports) await (before.imports === undefined ? store.del(importKey('device')) : store.set(importKey('device'), before.imports))
            setDeviceData(before.data)
            updateSettings({ ...before.settings })
            if (repoRef.current === device) setData(before.data)
            await store.del(PRE_RESTORE_KEY)
            toast({ message: 'Restore undone: your data is back as it was', tone: 'success' })
          } catch (e) { fail(e, 'Undoing the restore') }
        })()
      },
    })
    return true
  }, [device, repo, store, updateSettings, toast, fail])

  const copyDeviceToNotion = useCallback(async (onProgress?: (done: number, total: number) => void) => {
    if (repo.kind !== 'notion') throw new Error('Connect Notion first.')
    // The copy log lives with the database it copies to: resumable, and never twice (audit A-03).
    const key = `${COPY_LOG_KEY}:${settingsRef.current.incomeDbId}`
    const entries = readJson<Record<string, string>>(key, {})
    const log = { get: (k: string) => entries[k], put: (k: string, v: string) => { entries[k] = v; writeJson(key, entries) } }
    try {
      return await copyToNotion(repo, withoutDemo(deviceData), onProgress, log)
    } finally {
      // Whatever got there, show it; a stopped copy is resumed by running it again.
      await reload()
    }
  }, [repo, deviceData, reload])

  const deviceHasOwnData = deviceData.records.length > 0 || deviceData.costs.length > 0

  const on = useCallback((key: FeatureKey) => featureOn(settings.features, key), [settings.features])

  // The demo keeps its own cash on hand, so the demo's never leaks into yours.
  const shownSettings = useMemo(() => (workspace === 'demo' ? { ...settings, ...demoOpening(today) } : settings), [workspace, settings, today])

  const books = useMemo(() => withRefunds(data), [data])

  const findImported = useCallback(async (kind: 'record' | 'cost' | 'refund', key: string) => (repo.findImported ? repo.findImported(kind, key) : null), [repo])

  // Import history belongs to the data it was imported into: the demo, this device, or one Notion workspace.
  const importStore = useMemo(() => ({
    store,
    key: importKey(workspace === 'demo' ? 'demo' : useNotion ? `notion:${settings.incomeDbId}` : 'device'),
  }), [store, workspace, useNotion, settings.incomeDbId])

  const value: InflowState = {
    today, settings: shownSettings, updateSettings, on, data, books, load, error, offlineCopy, reload, period, setPeriod,
    filter, setFilter, saveRecord, deleteRecord, saveRefund, deleteRefund, saveCost, deleteCost, costsAvailable, saveEntity, deleteEntity, workspace, setWorkspace, clearDemo, loadDemo, resetDemo, restore,
    copyDeviceToNotion, deviceHasOwnData, importStore, findImported, toast, toasts,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export { hasDemo }
