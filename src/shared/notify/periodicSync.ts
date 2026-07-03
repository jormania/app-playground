// Periodic Background Sync registration — best-effort everywhere; a no-op where the API or
// permission isn't available, so callers never need their own feature-detection.

type PeriodicSyncRegistration = ServiceWorkerRegistration & {
  periodicSync?: {
    register: (tag: string, opts: { minInterval: number }) => Promise<void>
    unregister: (tag: string) => Promise<void>
    getTags: () => Promise<string[]>
  }
}

export async function registerPeriodicSync(tag: string, minIntervalMs: number): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return
    const reg = (await navigator.serviceWorker.ready) as PeriodicSyncRegistration
    if (!reg.periodicSync) return
    try {
      const status = await navigator.permissions.query({
        name: 'periodic-background-sync' as PermissionName,
      })
      if (status.state !== 'granted') return
    } catch {
      /* permission name unsupported on this browser — attempt registration anyway */
    }
    await reg.periodicSync.register(tag, { minInterval: minIntervalMs })
  } catch {
    /* not installed / not permitted — in-app surfaces still carry the reminder */
  }
}

export async function unregisterPeriodicSync(tag: string): Promise<void> {
  try {
    const reg = (await navigator.serviceWorker.ready) as PeriodicSyncRegistration
    await reg.periodicSync?.unregister(tag)
  } catch {
    /* ignore */
  }
}

export async function getPeriodicSyncTags(): Promise<string[]> {
  try {
    if (!('serviceWorker' in navigator)) return []
    const reg = (await navigator.serviceWorker.ready) as PeriodicSyncRegistration
    if (!reg.periodicSync) return []
    return await reg.periodicSync.getTags()
  } catch {
    return []
  }
}
