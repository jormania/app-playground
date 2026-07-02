// Best-effort PWA install detection for the react-vite sub-apps listed in
// src/apps-registry.js.
//
// Only Chromium (desktop Chrome/Edge, Android Chrome) implements
// navigator.getInstalledRelatedApps() — Safari and Firefox have no equivalent
// API at all. So the result of checkInstalledApps() is one of:
//   - a Map<manifestPath, boolean>  — real, verified answer (Chromium)
//   - null                          — "can't tell" (every other browser),
//     which the UI must treat as "unknown", never as a false "not installed"
//
// getInstalledRelatedApps() matches against the ABSOLUTE urls declared in
// this page's own manifest (coneofcold-trove.webmanifest's
// related_applications), which point at the production domain — so real
// detection only works on the deployed site, not localhost. Keep this in
// sync with the manifest's related_applications list.
const PROD_ORIGIN = 'https://coneofcold.vercel.app'

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
