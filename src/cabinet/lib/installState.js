// Best-effort PWA install detection for the react-vite sub-apps listed in
// src/apps-registry.js.
//
// Only Chromium (desktop Chrome/Edge, Android Chrome) implements
// navigator.getInstalledRelatedApps() — Safari and Firefox have no equivalent
// API at all. So the result of checkInstalledApps() is one of:
//   - a Map<manifestPath, boolean>  — Chromium's answer, but only its `true`
//     values are trustworthy (see AppTile.jsx: Chrome throttles this API to
//     prevent installed-app fingerprinting, so even a confirmed real install
//     can come back false)
//   - null                          — "can't tell" (every other browser)
//
// getInstalledRelatedApps() only ever reports apps declared in THIS page's own
// manifest's related_applications — and cabinet.webmanifest deliberately no
// longer declares that field. It was removed because it was the one thing
// blocking Chrome from minting a WebAPK for the Cabinet hub itself: Chromium's
// Android install-banner logic suppresses WebAPK promotion for a page whose own
// manifest carries a non-empty related_applications list, regardless of
// prefer_related_applications. Every sibling sub-app manifest lacks the field
// and minted fine; the Cabinet was the only one that didn't (chrome://webapks
// listed all 15 sub-apps but not the Cabinet, while Chrome's install UI
// wrongly reported it "already installed"). Don't re-add it.
//
// Consequences, accepted as a tradeoff:
//   - checkInstalledApps() below now always resolves to a Map of all-`false`
//     here, since the browser has nothing to match against.
//   - reconcileInstallFlags() therefore can never reach a conclusive answer,
//     so the secondary cleanup of stale "Launch" flags after a sub-app is
//     uninstalled is inert. It stays correct (an inconclusive answer clears
//     nothing), just no longer effective.
//   - The PRIMARY signal is unaffected: checkInstalledFlags() reads the
//     per-app flag each sub-app writes itself via src/shared/installFlag.ts,
//     which never depended on related_applications.
//
// The absolute-URL / PROD_ORIGIN machinery below is kept as-is: it's what the
// matching would need if this ever becomes viable again, and PROD_ORIGIN is
// referenced elsewhere.
const PROD_ORIGIN = 'https://coneofcold.vercel.app'

const INSTALL_FLAG_PREFIX = 'installed:'

// Each app marks its own install via src/shared/installFlag.ts (standalone
// display-mode on load, or the `appinstalled` event) — a one-shot, trustworthy
// signal, unlike getInstalledRelatedApps() below. Synchronous and available
// immediately at mount, so the Cabinet doesn't have to wait on the async
// check just to show an accurate "Launch" the first time an already-installed
// app's flag exists.
export function checkInstalledFlags(apps) {
  const result = new Map()
  for (const app of apps) {
    let flagged = false
    try {
      flagged = localStorage.getItem(INSTALL_FLAG_PREFIX + app.file) === '1'
    } catch {
      // private browsing / unavailable — falls through as not flagged
    }
    result.set(app.manifest, flagged)
  }
  return result
}

// Clears install flags for apps that are provably no longer installed, and
// reports whether `detected` was an answer worth trusting in the negative.
//
// A flag is otherwise write-once: nothing in installFlag.ts ever removes one,
// so uninstalling an app left its tile reading "Launch →" forever, sending a
// tap to a browser tab instead of an app.
//
// The one safe way to downgrade: Chrome's throttling of
// getInstalledRelatedApps() degrades it into returning an EMPTY list, never a
// partial one. So an answer that names at least one installed app cannot be a
// throttled answer — and in that single case the apps it doesn't name really
// aren't installed, and their stale flags can go. An empty answer stays
// ambiguous (throttled, or genuinely nothing installed) and is left alone.
export function reconcileInstallFlags(apps, detected) {
  if (!detected) return false
  let conclusive = false
  for (const isInstalled of detected.values()) {
    if (isInstalled) { conclusive = true; break }
  }
  if (!conclusive) return false

  for (const app of apps) {
    if (detected.get(app.manifest)) continue
    try {
      localStorage.removeItem(INSTALL_FLAG_PREFIX + app.file)
    } catch {
      // private browsing / unavailable — nothing to clear
    }
  }
  return true
}

export function installDetectionSupported() {
  return typeof navigator !== 'undefined' && 'getInstalledRelatedApps' in navigator
}

export function absoluteManifestUrl(manifestPath) {
  return new URL(manifestPath, PROD_ORIGIN).href
}

export async function checkInstalledApps(apps) {
  if (!installDetectionSupported()) return null
  let related
  try {
    related = await navigator.getInstalledRelatedApps()
  } catch {
    return null
  }
  const installedUrls = new Set(related.map((r) => r.url))
  const result = new Map()
  for (const app of apps) {
    result.set(app.manifest, installedUrls.has(absoluteManifestUrl(app.manifest)))
  }
  return result
}
