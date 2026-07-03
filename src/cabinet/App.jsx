import { useEffect, useMemo, useState } from 'react'
import { APPS } from '../apps-registry'
import { IconButton, SegmentedControl } from '../ds'
import { useTheme } from './lib/themeContext'
import { checkInstalledApps, checkInstalledFlags } from './lib/installState'
import { newlyDeployedFiles } from './lib/deployed'
import { loadOrder, saveOrder, loadLastOpened, clearLastOpened, loadSort, saveSort } from './lib/storage'
import { matchesSearch } from './lib/search'
import { AppTile } from './components/AppTile'
import { IconReorder } from './components/icons'
import styles from './App.module.css'

// The Cabinet lists every app that has a `kind` — the six Vite+React PWAs
// (kind: "react-vite") plus the hand-authored legacy HTML apps
// (kind: "static"), always, with no toggle to hide either group. Entries
// with no `kind` at all (e.g. ds-showcase.html) aren't Cabinet apps.
const REACT_VITE_APPS = APPS.filter((app) => app.kind === 'react-vite')
const CABINET_APPS = APPS.filter((app) => app.kind === 'react-vite' || app.kind === 'static')

// "New" only ever applies to the real, actively-developed apps — a legacy
// HTML page reusing an old deploy date shouldn't read as freshly shipped.
const NEW_APP_FILES = newlyDeployedFiles(REACT_VITE_APPS)

const SORT_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'recent', label: 'Recent' },
  { value: 'popular', label: 'Popular' },
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
  // so this Map only ever gets trusted for its `true` values. Everything
  // else renders identically to "unknown". Seeded synchronously from each
  // app's own install flag (src/shared/installFlag.ts — set from standalone
  // display-mode or `appinstalled`), then only ever upgraded (never
  // downgraded) by the async, less-reliable getInstalledRelatedApps() check.
  const [installedByManifest, setInstalledByManifest] = useState(() => checkInstalledFlags(REACT_VITE_APPS))
  const [order, setOrder] = useState(() => reconcileOrder(loadOrder()))
  const [sort, setSort] = useState(() => loadSort())
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  // Read once at mount: a tap navigates away immediately, so there's no
  // in-page moment where a fresher value would ever be shown. `?resetStats=1`
  // wipes the open-count/last-opened map only (order and sort untouched)
  // before that read — a one-off escape hatch for clearing noise built up
  // during testing, matching Touch Grass's own `?` query-param convention.
  const [lastOpened] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      if (p.get('resetStats') === '1') {
        clearLastOpened()
        p.delete('resetStats')
        const qs = p.toString()
        window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
        return {}
      }
    } catch (_) {}
    return loadLastOpened()
  })

  useEffect(() => {
    let cancelled = false
    checkInstalledApps(REACT_VITE_APPS).then((detected) => {
      if (cancelled || !detected) return
      setInstalledByManifest((prev) => {
        const merged = new Map(prev)
        for (const [manifest, isInstalled] of detected) {
          if (isInstalled) merged.set(manifest, true)
        }
        return merged
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const appsById = new Map(CABINET_APPS.map((app) => [app.file, app]))

  function move(file, dir) {
    setOrder((prev) => {
      const idx = prev.indexOf(file)
      const targetIdx = idx + dir
      if (idx < 0 || targetIdx < 0 || targetIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[targetIdx]] = [next[targetIdx], next[idx]]
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

  const manualOrderedApps = order.map((id) => appsById.get(id)).filter(Boolean)

  const orderedApps = useMemo(() => {
    if (sort === 'az') return [...CABINET_APPS].sort((a, b) => a.title.localeCompare(b.title))
    if (sort === 'recent') {
      return [...CABINET_APPS].sort((a, b) => (lastOpened[b.file]?.last || 0) - (lastOpened[a.file]?.last || 0))
    }
    if (sort === 'popular') {
      return [...CABINET_APPS].sort((a, b) => (lastOpened[b.file]?.count || 0) - (lastOpened[a.file]?.count || 0))
    }
    return manualOrderedApps
    // manualOrderedApps is derived fresh each render from `order`, so depend on that instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, order, lastOpened])

  // Search is hidden and ignored while reordering — move() and the
  // disableUp/disableDown bounds below both walk the full, unfiltered
  // manual order, so filtering it here would desync a tap's target index
  // from what's actually on screen.
  const visibleApps = editing ? orderedApps : orderedApps.filter((app) => matchesSearch(app, query))

  return (
    <div className={styles.shell}>
      <div className={styles.content}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>A cabinet of small, <em>strange</em> tools.</h1>
          <div className={styles.titleActions}>
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
          {!editing && (
            <input
              type="search"
              className={styles.searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search apps by name or tag"
            />
          )}
        </div>

        <div className={styles.grid}>
          {visibleApps.map((app, index) => (
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
              disableDown={index === visibleApps.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
