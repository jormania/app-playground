import { useCallback, useMemo, useState } from 'react'
import { useLoom } from './lib/useLoom.js'
import { loadViewPrefs, saveViewPrefs } from './lib/store.js'
import { weekDays, startOfWeek, addDays, dateKey, orderForMove, threadStats } from './lib/model.js'
import SkeinView from './components/SkeinView.jsx'
import WeekView from './components/WeekView.jsx'
import VerbBar from './components/VerbBar.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import styles from './App.module.css'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function weekLabel(anchor) {
  const start = startOfWeek(anchor)
  const end = addDays(start, 6)
  const sameMonth = start.getMonth() === end.getMonth()
  const left = sameMonth ? `${start.getDate()}` : `${start.getDate()} ${MONTHS[start.getMonth()]}`
  return `${left} – ${end.getDate()} ${MONTHS[end.getMonth()]}`
}

export default function App() {
  const loom = useLoom()
  const [prefs, setPrefs] = useState(loadViewPrefs)
  const [anchor, setAnchor] = useState(() => new Date())
  const [settingsOpen, setSettingsOpen] = useState(false)

  const setView = useCallback((view) => {
    setPrefs(p => { const next = { ...p, view }; saveViewPrefs(next); return next })
  }, [])
  const toggleWoven = useCallback(() => {
    setPrefs(p => { const next = { ...p, showWoven: !p.showWoven }; saveViewPrefs(next); return next })
  }, [])

  const days = useMemo(() => weekDays(anchor), [anchor])
  const isThisWeek = dateKey(startOfWeek(anchor)) === dateKey(startOfWeek(new Date()))

  const visible = useMemo(
    () => (prefs.showWoven ? loom.threads : loom.threads.filter(t => !t.done)),
    [loom.threads, prefs.showWoven],
  )
  const stats = useMemo(() => threadStats(loom.threads), [loom.threads])

  // The action surface both views share. reorderWithin turns a drop target index
  // into a fractional rank and persists it as a single Order write.
  const actions = useMemo(() => ({
    addThread: loom.addThread,
    patchThread: loom.patchThread,
    removeThread: loom.removeThread,
    toggleWoven: loom.toggleWoven,
    reorderWithin: (group, id, targetIndex) => {
      loom.patchThread(id, { order: orderForMove(group, id, targetIndex) })
    },
  }), [loom])

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.rule} aria-hidden="true"><span>✦</span></div>
        <h1 className={styles.wordmark}>Loom</h1>
        <p className={styles.tagline}>weave your week, thread by thread</p>
      </header>

      <main className={styles.main}>
        {loom.status === 'loading' && (
          <p className={styles.state}>Warping the loom…</p>
        )}

        {loom.status === 'error' && (
          <div className={styles.errorState}>
            <p>The loom is out of reach.</p>
            <p className={styles.errorMsg}>{loom.error}</p>
            <div className={styles.errorBtns}>
              <button className={styles.retry} onClick={loom.reload}>Try again</button>
              <button className={styles.retry} onClick={() => setSettingsOpen(true)}>Open the Guild</button>
            </div>
          </div>
        )}

        {loom.status === 'ready' && (
          prefs.view === 'skeins'
            ? <SkeinView threads={visible} actions={actions} />
            : <WeekView
                threads={visible}
                days={days}
                actions={actions}
                weekLabel={weekLabel(anchor)}
                isThisWeek={isThisWeek}
                onPrevWeek={() => setAnchor(a => addDays(startOfWeek(a), -7))}
                onNextWeek={() => setAnchor(a => addDays(startOfWeek(a), 7))}
                onThisWeek={() => setAnchor(new Date())}
              />
        )}
      </main>

      {/* Live error toast (a failed background write) — distinct from the load error. */}
      {loom.status === 'ready' && loom.error && (
        <div className={styles.toast} role="status" onClick={loom.dismissError}>{loom.error}</div>
      )}

      <VerbBar
        view={prefs.view}
        onView={setView}
        showWoven={prefs.showWoven}
        onToggleWoven={toggleWoven}
        stats={stats}
        mode={loom.mode}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <SettingsModal
        open={settingsOpen}
        mode={loom.mode}
        onClose={() => setSettingsOpen(false)}
        onSaved={loom.reload}
      />
    </div>
  )
}
