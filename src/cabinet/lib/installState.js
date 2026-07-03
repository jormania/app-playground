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
// getInstalledRelatedApps() matches against the ABSOLUTE urls declared in
// this page's own manifest (cabinet.webmanifest's
// related_applications), which point at the production domain — so real
// detection only works on the deployed site, not localhost. Keep this in
// sync with the manifest's related_applications list.
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
