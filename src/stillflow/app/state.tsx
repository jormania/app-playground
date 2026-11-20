import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useToastStack, ToastStack, type ToastTone } from '../../ds'
import { readJson, readSessionJson, removeJson, writeJson, writeSessionJson } from '../../shared/storage'
import { DEMO_SESSIONS } from '../data/demo'
import type { Backup, PracticeEntry, Preferences, Session, UserCollection, UserSessionData } from '../domain/types'
import { EMPTY_FILTERS, lastPractisedMap, type Filters, type SortKey } from '../lib/filter'
import { openRepo, type Snapshot, type StillflowRepo } from '../store/repo'

/**
 * The app's one store. Everything lives in memory (a catalogue of a few
 * thousand sessions is small) and every change is written through to
 * IndexedDB straight away. Writes are optimistic; a failed write says so.
 */

export interface PendingLaunch {
  sessionId: string
  at: number
}

interface StateValue extends Snapshot {
  ready: boolean
  lastPractised: Record<string, string>
  byId: Map<string, Session>
  filters: Filters
  sort: SortKey
  pending: PendingLaunch | null
  setFilters: (f: Filters) => void
  setSort: (s: SortKey) => void
  toggleFavourite: (id: string) => void
  setUserData: (data: UserSessionData) => void
  savePractice: (entry: PracticeEntry) => void
  deletePractice: (id: string) => void
  saveCollection: (c: UserCollection) => void
  deleteCollection: (id: string) => void
  savePreferences: (p: Preferences) => void
  upsertSessions: (list: Session[]) => Promise<void>
  deleteSessions: (ids: string[]) => Promise<void>
  restore: (b: Backup) => Promise<void>
  resetAll: () => Promise<void>
  exportBackup: () => Promise<Backup>
  markLaunched: (sessionId: string) => void
  clearPending: () => void
  toast: (message: string, tone?: ToastTone) => void
}

const Ctx = createContext<StateValue | null>(null)

const FILTERS_KEY = 'stillflow:filters'
const SORT_KEY = 'stillflow:sort'
const PENDING_KEY = 'stillflow:pending'

const EMPTY: Snapshot = {
  sessions: [], userData: {}, history: [], collections: [],
  preferences: { defaultInstructor: 'Yoga With Adriene', openMethod: 'auto', preferredStyles: [], view: 'grid', welcomed: false },
}

export function StateProvider({ children, repo: injected }: { children: ReactNode; repo?: StillflowRepo }) {
  const repoRef = useRef<StillflowRepo>(injected ?? openRepo())
  const repo = repoRef.current
  const [snap, setSnap] = useState<Snapshot>(EMPTY)
  const [ready, setReady] = useState(false)
  const [filters, setFiltersState] = useState<Filters>(() => ({ ...EMPTY_FILTERS, ...readSessionJson<Partial<Filters>>(FILTERS_KEY, {}) }))
  const [sort, setSortState] = useState<SortKey>(() => readSessionJson<SortKey>(SORT_KEY, 'recent'))
  const [pending, setPending] = useState<PendingLaunch | null>(() => readJson<PendingLaunch | null>(PENDING_KEY, null))
  const { toasts, push, dismiss } = useToastStack()

  const toast = useCallback((message: string, tone: ToastTone = 'neutral') => {
    push({ message, tone })
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
    return () => { alive = false }
  }, [repo, fail])

  const write = useCallback((p: Promise<unknown>) => { p.catch(fail) }, [fail])

  const setUserData = useCallback((data: UserSessionData) => {
    setSnap((s) => ({ ...s, userData: { ...s.userData, [data.sessionId]: data } }))
    write(repo.putUserData(data))
  }, [repo, write])

  const value = useMemo<StateValue>(() => {
    const byId = new Map(snap.sessions.map((s) => [s.id, s]))
    return {
      ...snap,
      ready,
      byId,
      lastPractised: lastPractisedMap(snap.history),
      filters,
      sort,
      pending,
      toast,
      setFilters: (f) => { setFiltersState(f); writeSessionJson(FILTERS_KEY, f) },
      setSort: (s) => { setSortState(s); writeSessionJson(SORT_KEY, s) },
      setUserData,
      toggleFavourite: (id) => {
        const cur = snap.userData[id] ?? { sessionId: id, favourite: false }
        setUserData({ ...cur, favourite: !cur.favourite })
      },
      savePractice: (entry) => {
        setSnap((s) => {
          const rest = s.history.filter((h) => h.id !== entry.id)
          const history = [entry, ...rest].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
          return { ...s, history }
        })
        write(repo.putHistory(entry))
        if (entry.rating) {
          const cur = snap.userData[entry.sessionId] ?? { sessionId: entry.sessionId, favourite: false }
          setUserData({ ...cur, rating: entry.rating })
        }
      },
      deletePractice: (id) => {
        setSnap((s) => ({ ...s, history: s.history.filter((h) => h.id !== id) }))
        write(repo.deleteHistory(id))
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
      },
      restore: async (b) => {
        await repo.restoreBackup(b)
        setSnap(await repo.load())
      },
      resetAll: async () => {
        await repo.resetAll()
        removeJson(PENDING_KEY)
        setPending(null)
        setSnap(await repo.load())
      },
      exportBackup: () => repo.exportBackup(),
      markLaunched: (sessionId) => {
        const p = { sessionId, at: Date.now() }
        setPending(p)
        writeJson(PENDING_KEY, p)
      },
      clearPending: () => {
        setPending(null)
        removeJson(PENDING_KEY)
      },
    }
  }, [snap, ready, filters, sort, pending, toast, setUserData, repo, write])

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
