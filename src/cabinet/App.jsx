import { useEffect, useMemo, useRef, useState } from 'react'
import { APPS } from '../apps-registry'
import { IconButton, SegmentedControl } from '../ds'
import { useTheme } from './lib/themeContext'
import { checkInstalledApps, checkInstalledFlags, reconcileInstallFlags } from './lib/installState'
import { newlyDeployedFiles } from './lib/deployed'
import { loadOrder, saveOrder, loadLastOpened, clearLastOpened, loadSort, saveSort, loadLinkHintDismissed, dismissLinkHint } from './lib/storage'
import { matchesSearch } from './lib/search'
import { isAndroid, isIos } from './lib/browserSupport'
import { AppTile } from './components/AppTile'
import { IconManual, IconPopular, IconRecent, IconReorder } from './components/icons'
import styles from './App.module.css'

// The Cabinet lists every app that has a `kind` — the Vite+React PWAs
// (kind: "react-vite") plus the hand-authored legacy HTML apps
// (kind: "static"), always, with no toggle to hide either group. Entries
// with no `kind` at all (e.g. ds-showcase.html) aren't Cabinet apps.
// (Deliberately not naming a count here — it goes stale the moment an app
// ships; REACT_VITE_APPS.length below is always the live number.)
const REACT_VITE_APPS = APPS.filter((app) => app.kind === 'react-vite')
const CABINET_APPS = APPS.filter((app) => app.kind === 'react-vite' || app.kind === 'static')

// "New" only ever applies to the real, actively-developed apps — a legacy
// HTML page reusing an old deploy date shouldn't read as freshly shipped.
const NEW_APP_FILES = newlyDeployedFiles(REACT_VITE_APPS)

// Below 560px the four words can't share a row with the search box, so each
// option shows its mark there instead. The word stays in the DOM either way —
// visually hidden, never `display: none`, so the radio keeps its accessible
// name at every width. A–Z is already as short as a mark and keeps its word.
function SortOption({ icon, children }) {
  return (
    <>
      <span className={styles.sortIcon} aria-hidden="true">{icon}</span>
      <span className={styles.sortWord}>{children}</span>
    </>
  )
}

const SORT_OPTIONS = [
  { value: 'manual', label: <SortOption icon={<IconManual />}>Manual</SortOption> },
  { value: 'recent', label: <SortOption icon={<IconRecent />}>Recent</SortOption> },
  { value: 'popular', label: <SortOption icon={<IconPopular />}>Popular</SortOption> },
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
  // display-mode or `appinstalled`), then upgraded by the async, less-reliable
  // getInstalledRelatedApps() check — which can also downgrade an app, but
  // only on a conclusive answer (see reconcileInstallFlags).
  const [installedByManifest, setInstalledByManifest] = useState(() => checkInstalledFlags(REACT_VITE_APPS))
  const [order, setOrder] = useState(() => reconcileOrder(loadOrder()))
  const [sort, setSort] = useState(() => loadSort())
  const [editing, setEditing] = useState(false)
  const [linkHintDismissed, setLinkHintDismissed] = useState(() => loadLinkHintDismissed())
  const [query, setQuery] = useState('')
  const searchRef = useRef(null)
  // `?resetStats=1` wipes the open-count/last-opened map only (order and
  // sort untouched) before the first read — a one-off escape hatch for
  // clearing noise built up during testing, matching Touch Grass's own `?`
  // query-param convention.
  const [lastOpened, setLastOpened] = useState(() => {
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

  function refreshInstalledByManifest() {
    // Synchronous pass: an install flag only ever adds confidence here, so
    // this merges upward and never takes an app back out of "installed".
    setInstalledByManifest((prev) => {
      const flags = checkInstalledFlags(REACT_VITE_APPS)
      const merged = new Map(prev)
      for (const [manifest, isInstalled] of flags) {
        if (isInstalled) merged.set(manifest, true)
      }
      return merged
    })
    checkInstalledApps(REACT_VITE_APPS).then((detected) => {
      if (!detected) return
      // The only thing allowed to downgrade an app is a *conclusive* answer —
      // see reconcileInstallFlags, which also prunes the now-disproven flags.
      // After one, rebuild from the pruned flags rather than merging onto a
      // map still carrying the app we just established isn't installed.
      const conclusive = reconcileInstallFlags(REACT_VITE_APPS, detected)
      setInstalledByManifest((prev) => {
        const merged = conclusive ? checkInstalledFlags(REACT_VITE_APPS) : new Map(prev)
        for (const [manifest, isInstalled] of detected) {
          if (isInstalled) merged.set(manifest, true)
        }
        return merged
      })
    })
  }

  useEffect(() => {
    refreshInstalledByManifest()
  }, [])

  // A tile tap navigates away, but the Cabinet page itself often isn't
  // discarded — Android's back button (and desktop's) typically restores it
  // from the back/forward cache with whatever state it had before the tap,
  // and an installed Cabinet PWA just resumes rather than reloading. Without
  // this, the open-count/last-opened stats (and therefore Recent/Popular
  // order) only ever caught up on a manual refresh. `pageshow` catches the
  // bfcache-restore case specifically; `visibilitychange`/`focus` catch
  // resuming a backgrounded tab or standalone PWA more generally — cheap and
  // idempotent, so no harm running all three.
  useEffect(() => {
    function refresh() {
      setOrder(reconcileOrder(loadOrder()))
      setLastOpened(loadLastOpened())
      refreshInstalledByManifest()
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') refresh()
    }
    function onPageShow(e) {
      if (e.persisted) refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])



  // "/" jumps straight to search, the standard launcher/inbox convention —
  // useful once there are enough tiles that scanning by eye isn't the
  // fastest way to find one. Ignored while typing into any field (so a "/"
  // meant for that field doesn't get hijacked) and while reordering, where
  // the search box isn't even rendered.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== '/' || editing) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editing])

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

  const orderedApps = useMemo(() => {
    if (sort === 'az') return [...CABINET_APPS].sort((a, b) => a.title.localeCompare(b.title))
    if (sort === 'recent') {
      return [...CABINET_APPS].sort((a, b) => (lastOpened[b.file]?.last || 0) - (lastOpened[a.file]?.last || 0))
    }
    if (sort === 'popular') {
      return [...CABINET_APPS].sort((a, b) => (lastOpened[b.file]?.count || 0) - (lastOpened[a.file]?.count || 0))
    }
    const appsById = new Map(CABINET_APPS.map((app) => [app.file, app]))
    return order.map((id) => appsById.get(id)).filter(Boolean)
  }, [sort, order, lastOpened])

  // Search is hidden and ignored while reordering — move() and the
  // disableUp/disableDown bounds below both walk the full, unfiltered
  // manual order, so filtering it here would desync a tap's target index
  // from what's actually on screen.
  const visibleApps = editing ? orderedApps : orderedApps.filter((app) => matchesSearch(app, query))

  // Only true once something is genuinely known to be installed — the hint
  // below is useless advice to someone with nothing installed to set it on.
  const anyInstalled = REACT_VITE_APPS.some((app) => installedByManifest?.get(app.manifest) === true)

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
          <div className={styles.sortControl}>
            <SegmentedControl size="sm" options={SORT_OPTIONS} value={sort} onChange={changeSort} />
          </div>
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
              ref={searchRef}
              type="search"
              className={styles.searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.stopPropagation(); setQuery('') } }}
              placeholder="Search"
              aria-label="Search apps by name or tag"
            />
          )}
        </div>

        {/* Launching an installed app goes through an OS-level intent, and
            Android offers every app that claims the URL — so with a second
            browser on the phone you get an "Open with" sheet listing Chrome,
            Edge and the app itself. Nothing here can suppress it: that needs
            the WebAPK to be a verified link handler, and its package and
            signing key belong to Google's minting server, not to us (see
            browserSupport.js). The per-app toggle is the real fix, so say so
            once — and only to someone who has an installed app to say it
            about. Dismissed for good on read. */}
        {isAndroid() && anyInstalled && !linkHintDismissed && (
          <p className={styles.iosHint}>
            Android asking which app to open? <strong>Settings → Apps →</strong> the app{' '}
            <strong>→ Open by default → Open supported links</strong> stops it asking.{' '}
            <button
              type="button"
              className={styles.hintDismiss}
              onClick={() => { dismissLinkHint(); setLinkHintDismissed(true) }}
            >
              Got it
            </button>
          </p>
        )}

        {/* Tiles say "Open" rather than "Install" on iOS, because a tap there
            genuinely can't install anything (see AppTile). This is the one
            place that says how it's actually done, once, instead of repeating
            it on all nineteen tiles. */}
        {isIos() && (
          <p className={styles.iosHint}>
            To keep an app on your home screen: open it, then <strong>Share</strong> → <strong>Add to Home Screen</strong>.
          </p>
        )}

        {!editing && query && visibleApps.length === 0 ? (
          <p className={styles.noResults}>Nothing matches "{query}".</p>
        ) : (
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
        )}
      </div>
    </div>
  )
}
