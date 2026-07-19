import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLoom } from './lib/useLoom.js'
import { useTheme } from './lib/themeContext.jsx'
import { useLexicon } from './lib/lexiconContext.jsx'
import { loadViewPrefs, saveViewPrefs } from './lib/store.js'
import {
  weekDays, startOfWeek, addDays, dateKey, orderForMove,
  carryThreads, threadsForDraftWeek, rhythmThreadsForWeek,
} from './lib/model.js'
import { loadRhythmSkein, loadRhythmDays, saveRhythm } from './lib/rhythm.js'
import SkeinView from './components/SkeinView.jsx'
import WeekView from './components/WeekView.jsx'
import Tapestry from './components/Tapestry.jsx'
import Toolbar from './components/Toolbar.jsx'
import VerbBar from './components/VerbBar.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import RewarpRitual from './components/RewarpRitual.jsx'
import DraftsModal from './components/DraftsModal.jsx'
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
  const theme = useTheme()
  const { t } = useLexicon()
  const [prefs, setPrefs] = useState(loadViewPrefs)
  const [query, setQuery] = useState('')
  const [anchor, setAnchor] = useState(() => new Date())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rewarpOpen, setRewarpOpen] = useState(false)
  const [draftsOpen, setDraftsOpen] = useState(false)
  const [rhythmSkein, setRhythmSkein] = useState(loadRhythmSkein)  // the skein name
  const [rhythmDays, setRhythmDays] = useState(loadRhythmDays)    // null = all 7, or [0..6]
  const [focusedSkein, setFocusedSkein] = useState(null)          // "Edit in rhythm" target
  const [undo, setUndo] = useState(null)
  const undoTimer = useRef(null)

  const setView = useCallback((view) => {
    setPrefs(p => { const next = { ...p, view }; saveViewPrefs(next); return next })
  }, [])
  const setFilter = useCallback((key, val) => {
    if (key === 'query') { setQuery(val); return }
    setPrefs(p => { const next = { ...p, [key]: val }; saveViewPrefs(next); return next })
  }, [])

  const days = useMemo(() => weekDays(anchor), [anchor])
  const isThisWeek = dateKey(startOfWeek(anchor)) === dateKey(startOfWeek(new Date()))

  // The re-warp ritual always targets the real current week, whatever week the
  // planner is currently scrolled to.
  const thisWeekDays = useMemo(() => weekDays(new Date()), [])
  const thisMondayKey = dateKey(startOfWeek(new Date()))
  const carried = useMemo(() => carryThreads(loom.threads, thisMondayKey), [loom.threads, thisMondayKey])

  const filters = useMemo(
    () => ({ query, showWoven: prefs.showWoven, topOnly: prefs.topOnly, collapseWoven: prefs.collapseWoven, skeinSort: prefs.skeinSort }),
    [query, prefs.showWoven, prefs.topOnly, prefs.collapseWoven, prefs.skeinSort],
  )

  // Undo (re-ravel): a deleted thread is held for 5s and can be re-woven back.
  const removeWithUndo = useCallback((id) => {
    const thread = loom.threads.find(x => x.id === id)
    loom.removeThread(id)
    if (!thread) return
    setUndo({ title: thread.title, skein: thread.skein, day: thread.day, order: thread.order, done: thread.done })
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setUndo(null), 5000)
  }, [loom])
  const reravel = useCallback(() => {
    setUndo(cur => { if (cur) loom.addThread(cur); return null })
    if (undoTimer.current) clearTimeout(undoTimer.current)
  }, [loom])
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current) }, [])

  // Cast a draft's threads onto the given week.
  const castDraft = useCallback((draft, weekStartDate) => {
    threadsForDraftWeek(draft, weekStartDate).forEach(th => loom.addThread(th))
  }, [loom])

  // Cast the rhythm: place each canonical thread onto selected days of the given week,
  // skipping any that already exist (duplication guard in rhythmThreadsForWeek).
  const castRhythm = useCallback((weekStartDate) => {
    const wDays = weekDays(weekStartDate)
    rhythmThreadsForWeek(loom.threads, rhythmSkein, wDays, rhythmDays).forEach(th => loom.addThread(th))
  }, [loom, rhythmSkein, rhythmDays])

  // Set or unset the rhythm skein + days. Accepts null to clear, or { skeinName, days }.
  const handleSetRhythm = useCallback(({ skeinName, days = null } = {}) => {
    saveRhythm(skeinName ? { skeinName, days } : {})
    setRhythmSkein(skeinName || null)
    setRhythmDays(days)
  }, [])

  // Long-press a rhythm thread in WeekView → jump to Skeins with that skein focused.
  const handleEditInRhythm = useCallback((skeinName) => {
    setFocusedSkein(skeinName)
    setView('skeins')
  }, [setView])

  const actions = useMemo(() => ({
    addThread: loom.addThread,
    patchThread: loom.patchThread,
    removeThread: removeWithUndo,
    toggleWoven: loom.toggleWoven,
    castDraft,
    castRhythm,
    reorderWithin: (group, id, targetIndex) => {
      loom.patchThread(id, { order: orderForMove(group, id, targetIndex) })
    },
  }), [loom, removeWithUndo, castDraft, castRhythm])

  const showToolbar = loom.status === 'ready' && prefs.view !== 'tapestry'

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.rule} aria-hidden="true"><span>✦</span></div>
        <h1 className={styles.wordmark}>Loom</h1>
        <p className={styles.tagline}>weave your week, thread by thread</p>
      </header>

      <main className={styles.main}>
        {loom.status === 'loading' && (
          <p className={styles.state}>{t('loadingLoom')}</p>
        )}

        {loom.status === 'error' && (
          <div className={styles.errorState}>
            <p>The loom is out of reach.</p>
            <p className={styles.errorMsg}>{loom.error}</p>
            <div className={styles.errorBtns}>
              <button className={styles.retry} onClick={loom.reload}>Try again</button>
              <button className={styles.retry} onClick={() => setSettingsOpen(true)}>Open {t('guild')}</button>
            </div>
          </div>
        )}

        {showToolbar && (
          <Toolbar
            filters={filters}
            setFilter={setFilter}
            carryCount={carried.length}
            onRewarp={() => setRewarpOpen(true)}
            onDrafts={() => setDraftsOpen(true)}
          />
        )}

        {loom.status === 'ready' && (
          prefs.view === 'skeins'
            ? <SkeinView
                threads={loom.threads}
                actions={actions}
                filters={filters}
                onSkeinSort={id => setFilter('skeinSort', id)}
                rhythmSkein={rhythmSkein}
                rhythmDays={rhythmDays}
                onSetRhythm={handleSetRhythm}
                focusedSkein={focusedSkein}
                onFocusedSkeinClear={() => setFocusedSkein(null)}
              />
            : prefs.view === 'tapestry'
              ? <Tapestry threads={loom.threads} />
              : <WeekView
                  threads={loom.threads}
                  days={days}
                  actions={actions}
                  filters={filters}
                  weekLabel={weekLabel(anchor)}
                  isThisWeek={isThisWeek}
                  rhythmSkein={rhythmSkein}
                  rhythmDays={rhythmDays}
                  onEditInRhythm={handleEditInRhythm}
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

      {/* Re-ravel — the 5-second undo after an unravel. */}
      {undo && (
        <div className={`${styles.toast} ${styles.undoToast}`} role="status">
          <span>{t('Thread')} unravelled.</span>
          <button type="button" className={styles.undoBtn} onClick={reravel}>{t('reravel')}</button>
        </div>
      )}

      <VerbBar
        view={prefs.view}
        onView={setView}
        mode={loom.mode}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <SettingsModal
        open={settingsOpen}
        mode={loom.mode}
        onClose={() => setSettingsOpen(false)}
        onSaved={loom.reload}
      />

      <RewarpRitual
        open={rewarpOpen}
        carried={carried}
        threads={loom.threads}
        days={thisWeekDays}
        actions={actions}
        onClose={() => setRewarpOpen(false)}
      />

      <DraftsModal
        open={draftsOpen}
        onClose={() => setDraftsOpen(false)}
        threads={loom.threads}
        days={days}
        weekStartDate={days[0].date}
        weekLabel={weekLabel(anchor)}
        actions={actions}
        rhythmSkein={rhythmSkein}
      />
    </div>
  )
}
