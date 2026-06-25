import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSettings } from './settingsContext'
import { isConfigured } from './settings'
import { queueSize } from './queue'
import { flushQueue, isOnline, SYNC_EVENT } from './sync'

interface SyncStatus {
  online: boolean
  pending: number
  syncing: boolean
}

const SyncContext = createContext<SyncStatus>({ online: true, pending: 0, syncing: true })

export function SyncProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const queryClient = useQueryClient()
  const [online, setOnline] = useState(isOnline())
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)

  const refreshPending = useCallback(async () => {
    try {
      setPending(await queueSize())
    } catch {
      /* IndexedDB unavailable — leave as-is */
    }
  }, [])

  const flush = useCallback(async () => {
    if (!isConfigured(settings)) {
      await refreshPending()
      return
    }
    setSyncing(true)
    try {
      const res = await flushQueue(settings)
      setPending(res.remaining)
      if (res.synced > 0) {
        // Replace optimistic local rows with the real synced ones.
        queryClient.invalidateQueries({ queryKey: ['checkins'] })
        queryClient.invalidateQueries({ queryKey: ['reflections'] })
      }
    } catch {
      await refreshPending()
    } finally {
      setSyncing(false)
    }
  }, [settings, queryClient, refreshPending])

  // Flush on mount + whenever settings become usable.
  useEffect(() => {
    void flush()
  }, [flush])

  // React to connectivity changes and to queue activity from the mutation hooks.
  useEffect(() => {
    const goOnline = () => {
      setOnline(true)
      void flush()
    }
    const goOffline = () => setOnline(false)
    const onSync = () => {
      setOnline(isOnline())
      void flush()
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    window.addEventListener(SYNC_EVENT, onSync)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener(SYNC_EVENT, onSync)
    }
  }, [flush])

  return <SyncContext.Provider value={{ online, pending, syncing }}>{children}</SyncContext.Provider>
}

export function useSyncStatus(): SyncStatus {
  return useContext(SyncContext)
}
