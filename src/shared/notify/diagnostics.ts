// Generic "why did my background notification go quiet?" data-gatherer. Each app renders
// the result with its own markup/styling — this only fetches the raw state.
import { createIdbKv } from './idbKv'
import { notificationPermission } from './permission'
import { getPeriodicSyncTags } from './periodicSync'

export interface NotifyDiagnostics {
  permission: NotificationPermission | 'n/a'
  periodicSyncTags: string[]
  values: Record<string, unknown>
}

export async function gatherDiagnostics(opts: {
  dbName: string
  storeName?: string
  keys: string[]
}): Promise<NotifyDiagnostics> {
  const { dbName, storeName = 'kv', keys } = opts
  const kv = createIdbKv(dbName, storeName)
  const [permission, periodicSyncTags, ...values] = await Promise.all([
    Promise.resolve(typeof Notification === 'undefined' ? 'n/a' : notificationPermission()),
    getPeriodicSyncTags(),
    ...keys.map((k) => kv.get(k)),
  ])
  const valuesObj: Record<string, unknown> = {}
  keys.forEach((k, i) => {
    valuesObj[k] = values[i]
  })
  return { permission: permission as NotificationPermission | 'n/a', periodicSyncTags, values: valuesObj }
}
