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
  // null = "haven't checked yet" (rendered like "unknown"); once resolved this
  // becomes either a Map (Chromium: real answers) or the literal null forever
  // (unsupported browser: every tile stays "unknown").
  const [installedByManifest, setInstalledByManifest] = useState(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    checkInstalledApps(TROVE_APPS).then((result) => {
      if (!cancelled) {
        setInstalledByManifest(result)
        setChecked(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const supported = installDetectionSupported()

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

        {checked && !supported && (
          <p className={styles.disclaimer}>
            This browser can't verify which apps are installed — every "Open" link
            below just opens the page; if you've added an app to your home screen,
            use that icon instead for the full installed-app experience.
          </p>
        )}

        <div className={styles.grid}>
          {TROVE_APPS.map((app) => (
            <AppTile
              key={app.file}
              app={app}
              installed={installedByManifest ? installedByManifest.get(app.manifest) ?? null : null}
            />
          ))}
        </div>

        <Diagnostics />
      </div>
    </div>
  )
}
