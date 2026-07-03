import { useEffect, useMemo, useState } from 'react'
import { APPS } from '../apps-registry'
import { Button, IconButton, SegmentedControl } from '../ds'
import { useTheme } from './lib/themeContext'
import { checkInstalledApps } from './lib/installState'
import { newlyDeployedFiles } from './lib/deployed'
import { loadOrder, saveOrder, loadLastOpened, loadSort, saveSort, loadShowLegacy, saveShowLegacy } from './lib/storage'
import { AppTile } from './components/AppTile'
import { IconReorder } from './components/icons'
import styles from './App.module.css'

// react-vite apps (real PWAs) always show; static apps (hand-authored legacy
// HTML, no manifest) only show when the "Legacy apps" toggle is on — off by
// default, since they're old artifacts rather than the everyday six.
const REACT_VITE_APPS = APPS.filter((app) => app.kind === 'react-vite')
const STATIC_APPS = APPS.filter((app) => app.kind === 'static')
const ALL_CABINET_APPS = [...REACT_VITE_APPS, ...STATIC_APPS]

// "New" only ever applies to the real, actively-developed apps — a legacy
// HTML page reusing an old deploy date shouldn't read as freshly shipped.
const NEW_APP_FILES = newlyDeployedFiles(REACT_VITE_APPS)

const SORT_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'recent', label: 'Recent' },
  { value: 'az', label: 'A–Z' },
]

function isVisible(app, showLegacy) {
  return app.kind === 'react-vite' || showLegacy
}

// Keep a saved order in step with the registry: drop ids no longer listed
// there, and append any added since the order was last saved. Static apps
// are included even while hidden, so their manual position survives toggling
// "Legacy apps" off and back on.
function reconcileOrder(saved) {
  const ids = ALL_CABINET_APPS.map((app) => app.file)
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
  const [showLegacy, setShowLegacy] = useState(() => loadShowLegacy())
  const [editing, setEditing] = useState(false)
  // Read once at mount: a tap navigates away immediately, so there's no
  // in-page moment where a fresher value would ever be shown.
  const [lastOpened] = useState(() => loadLastOpened())

  useEffect(() => {
    let cancelled = false
    checkInstalledApps(REACT_VITE_APPS).then((result) => {
      if (!cancelled) setInstalledByManifest(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const appsById = new Map(ALL_CABINET_APPS.map((app) => [app.file, app]))
  const visibleApps = ALL_CABINET_APPS.filter((app) => isVisible(app, showLegacy))

  // Swaps by file id rather than raw index: hidden legacy apps can sit
  // between two visible ones in the stored order, so swapping the visible
  // neighbours' absolute positions (not adjacent array slots) is what keeps
  // a reorder from also dragging a hidden app along with it.
  function move(file, dir) {
    setOrder((prev) => {
      const visibleIds = prev.filter((id) => isVisible(appsById.get(id), showLegacy))
      const idx = visibleIds.indexOf(file)
      const targetIdx = idx + dir
      if (idx < 0 || targetIdx < 0 || targetIdx >= visibleIds.length) return prev
      const otherFile = visibleIds[targetIdx]
      const next = [...prev]
      const i = next.indexOf(file)
      const j = next.indexOf(otherFile)
      ;[next[i], next[j]] = [next[j], next[i]]
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

  function changeShowLegacy(next) {
    setShowLegacy(next)
    saveShowLegacy(next)
  }

  const manualOrderedApps = order.map((id) => appsById.get(id)).filter((app) => app && isVisible(app, showLegacy))

  const orderedApps = useMemo(() => {
    if (sort === 'az') return [...visibleApps].sort((a, b) => a.title.localeCompare(b.title))
    if (sort === 'recent') {
      return [...visibleApps].sort((a, b) => (lastOpened[b.file]?.last || 0) - (lastOpened[a.file]?.last || 0))
    }
    return manualOrderedApps
    // manualOrderedApps is derived fresh each render from `order`/`showLegacy`, so depend on those instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, order, showLegacy, lastOpened])

  return (
    <div className={styles.shell}>
      <div className={styles.content}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Cabinet of Tools</h1>
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
          <Button
            size="sm"
            variant={showLegacy ? 'primary' : 'secondary'}
            aria-pressed={showLegacy}
            title={
              showLegacy
                ? 'Hide legacy apps (old hand-authored HTML, no install)'
                : 'Show legacy apps — old hand-authored HTML pages with no PWA install; each opens as a plain page'
            }
            onClick={() => changeShowLegacy(!showLegacy)}
          >
            Legacy apps
          </Button>
        </div>

        <div className={styles.grid}>
          {orderedApps.map((app, index) => (
            <AppTile
              key={app.file}
              app={app}
              installed={installedByManifest?.get(app.manifest) === true}
              isNew={NEW_APP_FILES.has(app.file)}
              openStats={lastOpened[app.file]}
              editing={editing}
              onMoveUp={() => move(app.file, -1)}
              onMoveDown={() => move(app.file, 1)}
              disableUp={index === 0}
              disableDown={index === orderedApps.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
