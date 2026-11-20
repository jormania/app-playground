import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useToastStack, ToastStack, type ToastTone } from '../../ds'
import { readJson, readSessionJson, removeJson, writeJson, writeSessionJson } from '../../shared/storage'
import { DEMO_SESSIONS } from '../data/demo'
import { BUILT_IN_SERIES } from '../data/series'
import {
  DEFAULT_PREFERENCES,
  type Backup, type PracticeEntry, type Preferences, type SeriesDef, type SeriesProgress, type Session,
  type UserCollection, type UserSessionData,
} from '../domain/types'
import { EMPTY_FILTERS, lastPractisedMap, type Filters, type SortKey } from '../lib/filter'
import { openRepo, type Snapshot, type StillflowRepo } from '../store/repo'

/**
 * The app's one store. Everything lives in memory (a catalogue of a few
 * thousand sessions is small) and every change is written through to
 * IndexedDB straight away. Writes are optimistic; a failed write says so.
 */

/** What Start Practice opened, so returning can offer Mark as Completed. */
export interface PendingLaunch {
  at: number
  /** The catalogue session opened, when there is one. */
  sessionId?: string
  /** A series day opened, linked to a session or not. */
  seriesId?: string
  day?: number
}

export interface ToastOptions {
  tone?: ToastTone
  actionLabel?: string
  onAction?: () => void
}

interface StateValue extends Snapshot {
  ready: boolean
  lastPractised: Record<string, string>
  byId: Map<string, Session>
  seriesDefs: SeriesDef[]
  filters: Filters
  sort: SortKey
  pending: PendingLaunch | null
  /** Whether the browser promised not to evict this app's storage; null = unknown. */
  persisted: boolean | null
  setFilters: (f: Filters) => void
  setSort: (s: SortKey) => void
  toggleFavourite: (id: string) => void
  setUserData: (data: UserSessionData) => void
  savePractice: (entry: PracticeEntry) => void
  deletePractice: (id: string) => void
  saveCollection: (c: UserCollection) => void
  deleteCollection: (id: string) => void
  savePreferences: (p: Preferences) => void
  saveProgress: (p: SeriesProgress) => void
  deleteProgress: (seriesId: string) => void
  saveSeriesDef: (d: SeriesDef) => void
  deleteSeriesDef: (id: string) => void
  upsertSessions: (list: Session[]) => Promise<void>
  deleteSessions: (ids: string[]) => Promise<void>
  restore: (b: Backup) => Promise<void>
  resetAll: () => Promise<void>
  exportBackup: () => Promise<Backup>
  markLaunched: (launch: Omit<PendingLaunch, 'at'>) => void
  clearPending: () => void
  requestPersistence: () => Promise<boolean>
  toast: (message: string, opts?: ToastTone | ToastOptions) => void
}

const Ctx = createContext<StateValue | null>(null)

const FILTERS_KEY = 'stillflow:filters'
const SORT_KEY = 'stillflow:sort'
const PENDING_KEY = 'stillflow:pending'

const EMPTY: Snapshot = {
  sessions: [], userData: {}, history: [], collections: [], preferences: DEFAULT_PREFERENCES,
  seriesProgress: {}, customSeries: [],
}

const byNewest = (a: PracticeEntry, b: PracticeEntry) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)

function readPending(): PendingLaunch | null {
  const p = readJson<PendingLaunch | null>(PENDING_KEY, null)
  return p && typeof p.at === 'number' && (p.sessionId || p.seriesId) ? p : null
}

export function StateProvider({ children, repo: injected }: { children: ReactNode; repo?: StillflowRepo }) {
  const repoRef = useRef<StillflowRepo>(injected ?? openRepo())
  const repo = repoRef.current
  const [snap, setSnap] = useState<Snapshot>(EMPTY)
  const [ready, setReady] = useState(false)
  const [filters, setFiltersState] = useState<Filters>(() => ({ ...EMPTY_FILTERS, ...readSessionJson<Partial<Filters>>(FILTERS_KEY, {}) }))
  const [sort, setSortState] = useState<SortKey>(() => readSessionJson<SortKey>(SORT_KEY, 'recent'))
  const [pending, setPending] = useState<PendingLaunch | null>(readPending)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const { toasts, push, dismiss } = useToastStack()

  const toast = useCallback((message: string, opts?: ToastTone | ToastOptions) => {
    const o: ToastOptions = typeof opts === 'string' ? { tone: opts } : opts ?? {}
    push({ message, tone: o.tone ?? 'neutral', actionLabel: o.actionLabel, onAction: o.onAction, duration: o.onAction ? 6000 : undefined })
  }, [push])

  const fail = useCallback((e: unknown) => {
    console.error(e)
    toast('That change could not be saved on this device.', 'danger')
  }, [toast])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        await repo.seedOnce(DEMO_SESSIONS)
        const s = await repo.load()
        if (alive) setSnap(s)
      } catch (e) {
        fail(e)
      } finally {
        if (alive) setReady(true)
      }
    })()
    navigator.storage?.persisted?.().then((v) => { if (alive) setPersisted(v) }).catch(() => {})
    return () => { alive = false }
  }, [repo, fail])

  const write = useCallback((p: Promise<unknown>) => { p.catch(fail) }, [fail])

  const requestPersistence = useCallback(async () => {
    try {
      const ok = (await navigator.storage?.persist?.()) ?? false
      setPersisted(ok)
      return ok
    } catch {
      return false
    }
  }, [])

  const setUserData = useCallback((data: UserSessionData) => {
    setSnap((s) => ({ ...s, userData: { ...s.userData, [data.sessionId]: data } }))
    write(repo.putUserData(data))
  }, [repo, write])

  const clearPending = useCallback(() => {
    setPending(null)
    removeJson(PENDING_KEY)
  }, [])

  const value = useMemo<StateValue>(() => {
    const byId = new Map(snap.sessions.map((s) => [s.id, s]))
    return {
      ...snap,
      ready,
      byId,
      seriesDefs: [...BUILT_IN_SERIES, ...snap.customSeries],
      lastPractised: lastPractisedMap(snap.history),
      filters,
      sort,
      pending,
      persisted,
      toast,
      requestPersistence,
      setFilters: (f) => { setFiltersState(f); writeSessionJson(FILTERS_KEY, f) },
      setSort: (s) => { setSortState(s); writeSessionJson(SORT_KEY, s) },
      setUserData,
      toggleFavourite: (id) => {
        const cur = snap.userData[id] ?? { sessionId: id, favourite: false }
        setUserData({ ...cur, favourite: !cur.favourite })
      },
      savePractice: (entry) => {
        setSnap((s) => ({ ...s, history: [entry, ...s.history.filter((h) => h.id !== entry.id)].sort(byNewest) }))
        write(repo.putHistory(entry))
        if (entry.rating) {
          const cur = snap.userData[entry.sessionId] ?? { sessionId: entry.sessionId, favourite: false }
          setUserData({ ...cur, rating: entry.rating })
        }
        // Recording the practice answers "Did you finish…?" however it was reached.
        if (pending?.sessionId === entry.sessionId) clearPending()
        // The first record is when the data starts to matter: ask the browser
        // not to evict it. Silent; Settings shows the answer.
        if (snap.history.length === 0 && persisted !== true) void requestPersistence()
      },
      deletePractice: (id) => {
        const entry = snap.history.find((h) => h.id === id)
        setSnap((s) => ({ ...s, history: s.history.filter((h) => h.id !== id) }))
        write(repo.deleteHistory(id))
        if (entry) {
          toast('Practice entry deleted', {
            actionLabel: 'Undo',
            onAction: () => {
              setSnap((s) => ({ ...s, history: [entry, ...s.history.filter((h) => h.id !== entry.id)].sort(byNewest) }))
              write(repo.putHistory(entry))
            },
          })
        }
      },
      saveCollection: (c) => {
        setSnap((s) => {
          const exists = s.collections.some((x) => x.id === c.id)
          return { ...s, collections: exists ? s.collections.map((x) => (x.id === c.id ? c : x)) : [...s.collections, c] }
        })
        write(repo.putCollection(c))
      },
      deleteCollection: (id) => {
        setSnap((s) => ({ ...s, collections: s.collections.filter((x) => x.id !== id) }))
        write(repo.deleteCollection(id))
      },
      savePreferences: (p) => {
        setSnap((s) => ({ ...s, preferences: p }))
        write(repo.putPreferences(p))
      },
      saveProgress: (p) => {
        setSnap((s) => ({ ...s, seriesProgress: { ...s.seriesProgress, [p.seriesId]: p } }))
        write(repo.putProgress(p))
      },
      deleteProgress: (seriesId) => {
        setSnap((s) => {
          const next = { ...s.seriesProgress }
          delete next[seriesId]
          return { ...s, seriesProgress: next }
        })
        write(repo.deleteProgress(seriesId))
      },
      saveSeriesDef: (d) => {
        setSnap((s) => ({ ...s, customSeries: [...s.customSeries.filter((x) => x.id !== d.id), d].sort((a, b) => a.name.localeCompare(b.name)) }))
        write(repo.putSeriesDef(d))
      },
      deleteSeriesDef: (id) => {
        setSnap((s) => {
          const next = { ...s.seriesProgress }
          delete next[id]
          return { ...s, customSeries: s.customSeries.filter((x) => x.id !== id), seriesProgress: next }
        })
        write(repo.deleteSeriesDef(id))
      },
      upsertSessions: async (list) => {
        await repo.putSessions(list)
        setSnap((s) => {
          const m = new Map(s.sessions.map((x) => [x.id, x]))
          for (const x of list) m.set(x.id, x)
          return { ...s, sessions: [...m.values()] }
        })
      },
      deleteSessions: async (ids) => {
        await repo.deleteSessions(ids)
        const gone = new Set(ids)
        setSnap((s) => ({ ...s, sessions: s.sessions.filter((x) => !gone.has(x.id)) }))
        if (pending?.sessionId && gone.has(pending.sessionId) && !pending.seriesId) clearPending()
      },
      restore: async (b) => {
        await repo.restoreBackup(b)
        setSnap(await repo.load())
      },
      resetAll: async () => {
        await repo.resetAll()
        clearPending()
        setSnap(await repo.load())
      },
      exportBackup: async () => {
        const b = await repo.exportBackup()
        const prefs = { ...snap.preferences, lastBackupAt: b.exportedAt }
        setSnap((s) => ({ ...s, preferences: prefs }))
        write(repo.putPreferences(prefs))
        return b
      },
      markLaunched: (launch) => {
        const p = { ...launch, at: Date.now() }
        setPending(p)
        writeJson(PENDING_KEY, p)
      },
      clearPending,
    }
  }, [snap, ready, filters, sort, pending, persisted, toast, setUserData, repo, write, clearPending, requestPersistence])

  return (
    <Ctx.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </Ctx.Provider>
  )
}

export function useStillflow(): StateValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStillflow outside StateProvider')
  return v
}
