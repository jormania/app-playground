import { useEffect, useMemo, useState } from 'react'
import { APPS } from '../apps-registry'
import { IconButton, SegmentedControl } from '../ds'
import { useTheme } from './lib/themeContext'
import { checkInstalledApps } from './lib/installState'
import { newlyDeployedFiles } from './lib/deployed'
import { loadOrder, saveOrder, loadLastOpened, loadSort, saveSort } from './lib/storage'
import { AppTile } from './components/AppTile'
import { IconReorder } from './components/icons'
import styles from './App.module.css'

const CABINET_APPS = APPS.filter((app) => app.kind === 'react-vite')
const NEW_APP_FILES = newlyDeployedFiles(CABINET_APPS)

const SORT_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'recent', label: 'Recent' },
  { value: 'az', label: 'A–Z' },
]

// Keep a saved order in step with the registry: drop ids no longer listed
// there, and append any added since the order was last saved.
function reconcileOrder(saved) {
  const ids = CABINET_APPS.map((app) => app.file)
  const known = new Set(ids)
  const kept = (saved || []).filter((id) => known.has(id))
  const missing = ids.filter((id) => !kept.includes(id))
  return [...kept, ...missing]
}

export default function App() {
  const { theme, toggle } = useTheme()
  // A confirmed install can still come back false — see AppTile's comment —
  // so this Map (or null before/without a check) only ever gets trusted for
  // its `true` values. Everything else renders identically to "unknown".
  const [installedByManifest, setInstalledByManifest] = useState(null)
  const [order, setOrder] = useState(() => reconcileOrder(loadOrder()))
  const [sort, setSort] = useState(() => loadSort())
  const [editing, setEditing] = useState(false)
  // Read once at mount: a tap navigates away immediately, so there's no
  // in-page moment where a fresher value would ever be shown.
  const [lastOpened] = useState(() => loadLastOpened())

  useEffect(() => {
    let cancelled = false
    checkInstalledApps(CABINET_APPS).then((result) => {
      if (!cancelled) setInstalledByManifest(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function move(index, dir) {
    setOrder((prev) => {
      const target = index + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      saveOrder(next)
      return next
    })
  }

  function changeSort(next) {
    setSort(next)
    saveSort(next)
    // Reordering only means something in manual mode — leaving it active
    // under an automatic sort would let a drag silently do nothing useful.
    if (next !== 'manual') setEditing(false)
  }

  const appsById = new Map(CABINET_APPS.map((app) => [app.file, app]))
  const manualOrderedApps = order.map((id) => appsById.get(id)).filter(Boolean)

  const orderedApps = useMemo(() => {
    if (sort === 'az') return [...CABINET_APPS].sort((a, b) => a.title.localeCompare(b.title))
    if (sort === 'recent') {
      return [...CABINET_APPS].sort((a, b) => (lastOpened[b.file] || 0) - (lastOpened[a.file] || 0))
    }
    return manualOrderedApps
    // manualOrderedApps is derived fresh each render from `order`, so depend on that instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, order, lastOpened])

  // installedByManifest only ever has trustworthy `true` values (see
  // AppTile's comment) — this count can only under-report real installs,
  // never over-report, so it's framed as a floor rather than a fact.
  const confirmedInstalled = installedByManifest
    ? CABINET_APPS.filter((app) => installedByManifest.get(app.manifest) === true).length
    : null

  return (
    <div className={styles.shell}>
      <div className={styles.content}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>Cabinet of Tools</h1>
            <p className={styles.subtitle}>
              One shelf for the small, strange things — each tap opens the real app, not just another tab.
            </p>
          </div>
          <div className={styles.titleActions}>
            <IconButton
              size="sm"
              selected={editing}
              disabled={sort !== 'manual'}
              aria-label={editing ? 'Done reordering' : 'Reorder apps'}
              title={sort !== 'manual' ? 'Switch to Manual sort to reorder' : editing ? 'Done' : 'Reorder'}
              onClick={() => setEditing((e) => !e)}
            >
              <IconReorder />
            </IconButton>
            <IconButton
              size="sm"
              aria-label={`Theme: ${theme === 'dark' ? 'Dark' : 'Light'} (tap to switch)`}
              title={`Theme: ${theme === 'dark' ? 'Dark' : 'Light'}`}
              onClick={toggle}
            >
              {theme === 'dark' ? '☾' : '☀'}
            </IconButton>
          </div>
        </div>

        <div className={styles.controlsRow}>
          <SegmentedControl size="sm" options={SORT_OPTIONS} value={sort} onChange={changeSort} />
          {confirmedInstalled !== null && (
            <p
              className={styles.installSummary}
              title="Chrome under-reports installs by design (see CABINET.md) — a low count doesn't mean the rest aren't installed."
            >
              {confirmedInstalled} of {CABINET_APPS.length} confirmed installed
            </p>
          )}
        </div>

        <div className={styles.grid}>
          {orderedApps.map((app, index) => (
            <AppTile
              key={app.file}
              app={app}
              installed={installedByManifest?.get(app.manifest) === true}
              isNew={NEW_APP_FILES.has(app.file)}
              lastOpenedAt={lastOpened[app.file]}
              editing={editing}
              onMoveUp={() => move(index, -1)}
              onMoveDown={() => move(index, 1)}
              disableUp={index === 0}
              disableDown={index === orderedApps.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
