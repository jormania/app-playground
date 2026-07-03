import { useEffect, useState } from 'react'
import { APPS } from '../apps-registry'
import { IconButton } from '../ds'
import { useTheme } from './lib/themeContext'
import { checkInstalledApps } from './lib/installState'
import { AppTile } from './components/AppTile'
import styles from './App.module.css'

const CABINET_APPS = APPS.filter((app) => app.kind === 'react-vite')

export default function App() {
  const { theme, toggle } = useTheme()
  // A confirmed install can still come back false — see AppTile's comment —
  // so this Map (or null before/without a check) only ever gets trusted for
  // its `true` values. Everything else renders identically to "unknown".
  const [installedByManifest, setInstalledByManifest] = useState(null)

  useEffect(() => {
    let cancelled = false
    checkInstalledApps(CABINET_APPS).then((result) => {
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
            <h1 className={styles.title}>ConeofCold's Cabinet of Tools</h1>
            <p className={styles.subtitle}>
              One shelf for the small, strange things — each tap opens the real app, not just another tab.
            </p>
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

        <div className={styles.grid}>
          {CABINET_APPS.map((app) => (
            <AppTile
              key={app.file}
              app={app}
              installed={installedByManifest?.get(app.manifest) === true}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
