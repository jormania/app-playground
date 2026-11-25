/**
 * App state: settings, the loaded data, the selected period, and every action
 * that writes. One context, because every screen reads the same records and
 * the same period.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { indexedDbStore, type KeyValueStore } from '../../shared/kvStore'
import { readJson, writeJson } from '../../shared/storage'
import { useToastStack, type ToastInput } from '../../ds'
import { buildDemo, hasDemo, withoutDemo } from '../data/demo'
import type { IncomeRecord, InflowData, Settings } from '../domain/types'
import { todayString, type PeriodChoice } from '../lib/period'
import { copyToNotion, NotionRepo } from '../store/notion'
import { DeviceRepo, EMPTY, type Entity, type EntityKind, type Repo, listKey } from '../store/repo'
import { loadSettings, notionReady, saveSettings } from '../store/settings'
import type { Backup } from '../store/backup'

const PERIOD_KEY = 'inflow:period'

export type LoadState = 'loading' | 'ready' | 'error'

export interface IncomeFilter {
  query: string
  clientId: string
  sourceId: string
  venueId: string
  taxability: string
  status: string
  /** 'period' follows the selected period; 'all' shows everything. */
  range: 'period' | 'all'
}

export const EMPTY_FILTER: IncomeFilter = { query: '', clientId: '', sourceId: '', venueId: '', taxability: '', status: '', range: 'all' }

interface InflowState {
  today: string
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
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
  saveEntity: <T extends Entity>(kind: EntityKind, e: T) => Promise<T | null>
  deleteEntity: (kind: EntityKind, id: string) => Promise<void>
  clearDemo: () => Promise<void>
  loadDemo: () => Promise<void>
  restore: (b: Backup) => Promise<void>
  copyDeviceToNotion: (onProgress?: (done: number, total: number) => void) => Promise<number>
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
  const toasts = useToastStack()
  const { push } = toasts
  const toast = useCallback((t: ToastInput | string) => { push(typeof t === 'string' ? { message: t } : t) }, [push])

  const device = useMemo(() => new DeviceRepo(store), [store])
  const useNotion = notionReady(settings)
  const repo: Repo = useMemo(
    () => (useNotion ? notionRepo ?? new NotionRepo(settings.notionToken, settings.incomeDbId, store) : device),
    [useNotion, notionRepo, settings.notionToken, settings.incomeDbId, store, device],
  )

  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((cur) => {
      const next = { ...cur, ...patch, tax: { ...cur.tax, ...(patch.tax ?? {}) } }
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
      // First run on this device: seed the demo once, so the app is never an empty page.
      if (!settingsRef.current.demoSeeded && dev.records.length === 0 && dev.clients.length === 0) {
        dev = buildDemo(today, settingsRef.current.tax)
        await device.replaceAll(dev)
        updateSettings({ demoSeeded: true })
      }
      setDeviceData(dev)
      if (repo.kind === 'device') {
        setData(dev)
        setOfflineCopy(false)
      } else {
        const cached = repo instanceof NotionRepo ? await repo.cached() : EMPTY
        if (cached.records.length || cached.clients.length) setData(cached)
        try {
          setData(await repo.load())
          setOfflineCopy(false)
        } catch (e) {
          if (cached.records.length || cached.clients.length) {
            setOfflineCopy(true)
            setError(`Showing the last copy from Notion: ${(e as Error).message}`)
          } else throw e
        }
      }
      setLoad('ready')
    } catch (e) {
      setError((e as Error).message || 'Could not load your data.')
      setLoad('error')
    }
  }, [device, repo, today, updateSettings])

  useEffect(() => { void reload() }, [reload])

  const apply = useCallback((fn: (d: InflowData) => InflowData) => {
    setData(fn)
    if (repo.kind === 'device') setDeviceData(fn)
  }, [repo])

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
      }))
    } catch (e) { fail(e, 'Deleting') }
  }, [repo, apply, fail])

  const clearDemo = useCallback(async () => {
    const next = withoutDemo(deviceData)
    await device.replaceAll(next)
    setDeviceData(next)
    if (repo.kind === 'device') setData(next)
    updateSettings({ demoSeeded: true })
    toast({ message: 'Demo data cleared', tone: 'success' })
  }, [deviceData, device, repo, updateSettings, toast])

  const loadDemo = useCallback(async () => {
    const demo = buildDemo(today, settingsRef.current.tax)
    const mine = withoutDemo(deviceData)
    const ids = (l: { id: string }[]) => new Set(l.map((x) => x.id))
    const merge = <T extends { id: string }>(a: T[], b: T[]) => [...a, ...b.filter((x) => !ids(a).has(x.id))]
    const next: InflowData = {
      records: [...mine.records, ...demo.records],
      clients: merge(mine.clients, demo.clients),
      sources: merge(mine.sources, demo.sources),
      venues: merge(mine.venues, demo.venues),
    }
    await device.replaceAll(next)
    setDeviceData(next)
    if (repo.kind === 'device') setData(next)
    toast({ message: 'Demo data loaded on this device', tone: 'success' })
  }, [today, deviceData, device, repo, toast])

  const restore = useCallback(async (b: Backup) => {
    await device.replaceAll(b.data)
    setDeviceData(b.data)
    const { notionToken: _t, ...keep } = b.settings as Settings
    updateSettings({ ...keep, notionToken: settingsRef.current.notionToken, mode: 'device', demoSeeded: true })
    setData(b.data)
    toast({ message: `Restored ${b.data.records.length} payments to this device`, tone: 'success' })
  }, [device, updateSettings, toast])

  const copyDeviceToNotion = useCallback(async (onProgress?: (done: number, total: number) => void) => {
    if (repo.kind !== 'notion') throw new Error('Connect Notion first.')
    const n = await copyToNotion(repo, deviceData, onProgress)
    await reload()
    return n
  }, [repo, deviceData, reload])

  const deviceHasOwnData = deviceData.records.some((r) => !r.demo)

  const value: InflowState = {
    today, settings, updateSettings, data, load, error, offlineCopy, reload, period, setPeriod,
    filter, setFilter, saveRecord, deleteRecord, saveEntity, deleteEntity, clearDemo, loadDemo, restore,
    copyDeviceToNotion, deviceHasOwnData, toast, toasts,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export { hasDemo }
