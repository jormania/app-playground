const PREFIX = 'installed:'

function markInstalled(file: string) {
  try {
    localStorage.setItem(PREFIX + file, '1')
  } catch {
    // private browsing / quota exceeded — best-effort only
  }
}

// Marks `file` (an app's registry filename, e.g. "touch-grass-react.html")
// as installed once there's real proof — either this exact page is running
// in standalone display mode right now (authoritative: that's literally
// what "installed and launched as an app" means), or the `appinstalled`
// event fires later. Unlike navigator.getInstalledRelatedApps() (throttled
// by Chrome into an unreliable answer — see the Cabinet's installState.js),
// both of these are one-shot, trustworthy signals. Written to localStorage
// so the Cabinet, sharing this origin, can read it directly without any app
// needing to know the Cabinet exists.
export function watchInstalled(file: string) {
  if (typeof window === 'undefined') return
  if (window.matchMedia?.('(display-mode: standalone)').matches) markInstalled(file)
  window.addEventListener('appinstalled', () => markInstalled(file))
}

export function isMarkedInstalled(file: string): boolean {
  try {
    return localStorage.getItem(PREFIX + file) === '1'
  } catch {
    return false
  }
}
