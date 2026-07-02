import { useEffect, useState } from 'react'
import { APPS } from '../apps-registry'
import { IconButton } from '../ds'
import { useTheme } from './lib/themeContext'
import {
  checkInstalledApps,
  installDetectionSupported,
  getRawInstalledRelatedApps,
  absoluteManifestUrl,
} from './lib/installState'
import { AppTile } from './components/AppTile'
import styles from './App.module.css'

const TROVE_APPS = APPS.filter((app) => app.kind === 'react-vite')

// Shows exactly what the browser's install-detection API reported, so a real
// device can be diagnosed without remote debugging — e.g. an app confirmed
// installed in Android's own Settings > Apps that still reads as "not
// installed" here means Chrome's API itself isn't matching it, not that our
// UI logic is wrong. Collapsed by default; only worth opening when
// troubleshooting.
function Diagnostics() {
  const [raw, setRaw] = useState(undefined) // undefined = loading, null = unsupported, array = result

  useEffect(() => {
    let cancelled = false
    getRawInstalledRelatedApps().then((result) => {
      if (!cancelled) setRaw(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!installDetectionSupported()) return null

  return (
    <details className={styles.diagnostics}>
      <summary>Diagnostics</summary>
      <p>What the browser reported as installed (raw):</p>
      <pre>{raw === undefined ? 'checking…' : JSON.stringify(raw, null, 2)}</pre>
      <p>What each app's manifest URL is expected to be:</p>
      <pre>
        {JSON.stringify(
          Object.fromEntries(TROVE_APPS.map((app) => [app.title, absoluteManifestUrl(app.manifest)])),
          null,
          2,
        )}
      </pre>
    </details>
  )
}

export default function App() {
  const { theme, toggle } = useTheme()
  // A confirmed install can still come back false — see AppTile's comment —
  // so this Map (or null before/without a check) only ever gets trusted for
  // its `true` values. Everything else renders identically to "unknown".
  const [installedByManifest, setInstalledByManifest] = useState(null)

  useEffect(() => {
    let cancelled = false
    checkInstalledApps(TROVE_APPS).then((result) => {
      if (!cancelled) setInstalledByManifest(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className={styles.shell}>
      <div className={styles.content}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>Coneofcold Trove</h1>
            <p className={styles.subtitle}>Every app, one launch pad.</p>
          </div>
          <IconButton
            size="sm"
            aria-label={`Theme: ${theme === 'dark' ? 'Dark' : 'Light'} (tap to switch)`}
            title={`Theme: ${theme === 'dark' ? 'Dark' : 'Light'}`}
            onClick={toggle}
          >
            {theme === 'dark' ? '☾' : '☀'}
          </IconButton>
        </div>

        <p className={styles.disclaimer}>
          "Launch" means this device confirmed the app is already installed. "Open" just
          opens it in the browser — it may already be installed too, browsers don't always
          let a site check.
        </p>

        <div className={styles.grid}>
          {TROVE_APPS.map((app) => (
            <AppTile
              key={app.file}
              app={app}
              installed={installedByManifest?.get(app.manifest) === true}
            />
          ))}
        </div>

        <Diagnostics />
      </div>
    </div>
  )
}
