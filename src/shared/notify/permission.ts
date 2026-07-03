// Notification permission + capability checks. Guarded so importing this module is safe in
// node (tests) or a worker where `Notification`/`navigator` don't exist.

export function isNotificationSupported(): boolean {
  return typeof Notification !== 'undefined'
}

export function notificationPermission(): NotificationPermission {
  return isNotificationSupported() ? Notification.permission : 'denied'
}

export function supportsPeriodicSync(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof (globalThis as { PeriodicSyncManager?: unknown }).PeriodicSyncManager !== 'undefined'
  )
}

export interface NotifyCapabilities {
  notifications: boolean
  periodicSync: boolean
  supported: boolean
}

export function capabilities(): NotifyCapabilities {
  const notifications = isNotificationSupported()
  const periodicSync = supportsPeriodicSync()
  return { notifications, periodicSync, supported: notifications && periodicSync }
}

/** Request permission (must run from a user gesture in most browsers). Resolves 'denied'
 *  when Notification isn't supported at all. */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied'
  if (Notification.permission === 'default') return Notification.requestPermission()
  return Notification.permission
}
