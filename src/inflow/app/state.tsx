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
import type { CostRecord, FeatureKey, IncomeRecord, InflowData, Settings, Workspace } from '../domain/types'
import { todayString, type PeriodChoice } from '../lib/period'
import { copyToNotion, NotionRepo } from '../store/notion'
import { DEMO_KEY, DeviceRepo, EMPTY, normalise, type Entity, type EntityKind, type Repo, listKey } from '../store/repo'
import { featureOn, loadSettings, mergeSettings, notionReady, saveSettings, type SettingsPatch } from '../store/settings'
import type { Backup } from '../store/backup'

const PERIOD_KEY = 'inflow:period'

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
  load: LoadState
  error: string | null
  offlineCopy: boolean
  reload: () => Promise<void>
  period: PeriodChoice
  setPeriod: (p: PeriodChoice) => void
  filter: IncomeFilter
  setFilter: (f: IncomeFilter) => void
  saveRecord: (r: IncomeRecord) => Promise<IncomeRecord | null>
  deleteRecord: (r: IncomeRecord) => Promise<void>
  saveCost: (c: CostRecord) => Promise<CostRecord | null>
  deleteCost: (c: CostRecord) => Promise<void>
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
  restore: (b: Backup) => Promise<void>
  copyDeviceToNotion: (onProgress?: (done: number, total: number) => void) => Promise<number>
  /** Your own data on this device (not the demo) has something in it. */
  deviceHasOwnData: boolean
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

  const apply = useCallback((fn: (d: InflowData) => InflowData) => {
    // Device data is kept whatever is on screen; the screen only takes rows from its own repo.
    if (repo === device) setDeviceData(fn)
    if (repoRef.current === repo) setData(fn)
  }, [repo, device])

  const fail = useCallback((e: unknown, what: string) => {
    toast({ message: `${what} failed: ${(e as Error).message || 'unknown error'}`, tone: 'danger', duration: 8000 })
  }, [toast])

  const saveRecord = useCallback(async (r: IncomeRecord) => {
    try {
      const saved = await repo.saveRecord(r)
      apply((d) => {
        const exists = d.records.some((x) => x.id === r.id && r.id)
        return { ...d, records: exists ? d.records.map((x) => (x.id === r.id ? saved : x)) : [...d.records, saved] }
      })
      return saved
    } catch (e) { fail(e, 'Saving'); return null }
  }, [repo, apply, fail])

  const deleteRecord = useCallback(async (r: IncomeRecord) => {
    try {
      await repo.deleteRecord(r.id)
      apply((d) => ({ ...d, records: d.records.filter((x) => x.id !== r.id) }))
      toast({
        message: 'Payment deleted',
        actionLabel: 'Undo',
        onAction: () => { void saveRecord(repo.kind === 'notion' ? { ...r, id: '' } : r) },
      })
    } catch (e) { fail(e, 'Deleting') }
  }, [repo, apply, fail, toast, saveRecord])

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

  const deleteCost = useCallback(async (c: CostRecord) => {
    try {
      await repo.deleteCost(c.id)
      apply((d) => ({ ...d, costs: d.costs.filter((x) => x.id !== c.id) }))
      toast({
        message: 'Cost deleted',
        actionLabel: 'Undo',
        onAction: () => { void saveCost(repo.kind === 'notion' ? { ...c, id: '' } : c) },
      })
    } catch (e) { fail(e, 'Deleting') }
  }, [repo, apply, fail, toast, saveCost])

  const saveEntity = useCallback(async <T extends Entity>(kind: EntityKind, e: T): Promise<T | null> => {
    try {
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

  const restore = useCallback(async (b: Backup) => {
    const data = normalise(b.data)
    await device.replaceAll(data)
    setDeviceData(data)
    const { notionToken: _t, ...keep } = b.settings as Settings
    updateSettings({ ...keep, features: { ...(keep.features ?? {}) }, notionToken: settingsRef.current.notionToken, mode: 'device', demoSeeded: true, workspace: 'mine' })
    if (repo === device) setData(data)
    toast({ message: `Restored ${b.data.records.length} payments to this device`, tone: 'success' })
  }, [device, repo, updateSettings, toast])

  const copyDeviceToNotion = useCallback(async (onProgress?: (done: number, total: number) => void) => {
    if (repo.kind !== 'notion') throw new Error('Connect Notion first.')
    const n = await copyToNotion(repo, withoutDemo(deviceData), onProgress)
    await reload()
    return n
  }, [repo, deviceData, reload])

  const deviceHasOwnData = deviceData.records.length > 0 || deviceData.costs.length > 0

  const on = useCallback((key: FeatureKey) => featureOn(settings.features, key), [settings.features])

  // The demo keeps its own cash on hand, so the demo's never leaks into yours.
  const shownSettings = useMemo(() => (workspace === 'demo' ? { ...settings, ...demoOpening(today) } : settings), [workspace, settings, today])

  const value: InflowState = {
    today, settings: shownSettings, updateSettings, on, data, load, error, offlineCopy, reload, period, setPeriod,
    filter, setFilter, saveRecord, deleteRecord, saveCost, deleteCost, costsAvailable, saveEntity, deleteEntity, workspace, setWorkspace, clearDemo, loadDemo, resetDemo, restore,
    copyDeviceToNotion, deviceHasOwnData, toast, toasts,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export { hasDemo }
