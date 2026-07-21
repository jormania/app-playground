import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLoom } from './lib/useLoom.js'
import { useLexicon } from './lib/lexiconContext.jsx'
import { loadViewPrefs, saveViewPrefs } from './lib/store.js'
import {
  weekDays, startOfWeek, addDays, dateKey, orderForMove,
  carryThreads, threadsForDraftWeek, rhythmThreadsForWeek,
} from './lib/model.js'
import { loadRhythms } from './lib/rhythm.js'
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
  const { t } = useLexicon()
  const [prefs, setPrefs] = useState(loadViewPrefs)
  const [query, setQuery] = useState('')
  const [anchor, setAnchor] = useState(() => new Date())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rewarpOpen, setRewarpOpen] = useState(false)
  const [draftsOpen, setDraftsOpen] = useState(false)
  // rhythms: Array<{ skeinName, days }> — any number of rhythm skeins
  const [rhythms, setRhythms] = useState(loadRhythms)
  const [focusedSkein, setFocusedSkein] = useState(null) // "Edit in rhythm" target
  const [undo, setUndo] = useState(null)
  const undoTimer = useRef(null)

  // Derived: set of rhythm skein names for fast membership checks.
  const rhythmSkeinNames = useMemo(() => new Set(rhythms.map(r => r.skeinName)), [rhythms])

  const setView = useCallback((view) => {
    setPrefs(p => { const next = { ...p, view }; saveViewPrefs(next); return next })
  }, [])
  const setFilter = useCallback((key, val) => {
    if (key === 'query') { setQuery(val); return }
    setPrefs(p => { const next = { ...p, [key]: val }; saveViewPrefs(next); return next })
  }, [])

  const days = useMemo(() => weekDays(anchor), [anchor])
  const isThisWeek = dateKey(startOfWeek(anchor)) === dateKey(startOfWeek(new Date()))

  const thisWeekDays = useMemo(() => weekDays(new Date()), [])
  const thisMondayKey = dateKey(startOfWeek(new Date()))
  const carried = useMemo(() => carryThreads(loom.threads, thisMondayKey), [loom.threads, thisMondayKey])

  const filters = useMemo(
    () => ({ query, showWoven: prefs.showWoven, rhythmSort: prefs.rhythmSort, collapseWoven: prefs.collapseWoven, skeinOrder: prefs.skeinOrder }),
    [query, prefs.showWoven, prefs.rhythmSort, prefs.collapseWoven, prefs.skeinOrder],
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

  const castDraft = useCallback((draft, weekStartDate) => {
    threadsForDraftWeek(draft, weekStartDate).forEach(th => loom.addThread(th))
  }, [loom])

  // Cast all rhythms: place each rhythm skein's canonical threads onto their
  // allowed days, skipping existing threads (duplication guard in model).
  const castRhythm = useCallback((weekStartDate) => {
    const wDays = weekDays(weekStartDate)
    rhythmThreadsForWeek(loom.threads, rhythms, wDays).forEach(th => loom.addThread(th))
  }, [loom, rhythms])

  // Toggle a skein in/out of the rhythm list (persists to localStorage).
  const handleToggleRhythm = useCallback((skeinName) => {
    import('./lib/rhythm.js').then(({ addRhythm, removeRhythm, loadRhythms: lr }) => {
      if (rhythmSkeinNames.has(skeinName)) removeRhythm(skeinName)
      else addRhythm(skeinName, null)
      setRhythms(lr())
    })
  }, [rhythmSkeinNames])

  // Update the day mask for an existing rhythm skein.
  const handleSetRhythmDays = useCallback((skeinName, days) => {
    import('./lib/rhythm.js').then(({ setRhythmDays, loadRhythms: lr }) => {
      setRhythmDays(skeinName, days)
      setRhythms(lr())
    })
  }, [])

  // Long-press a rhythm thread in WeekView → jump to Skeins with that skein focused.
  const handleEditInRhythm = useCallback((skeinName) => {
    setFocusedSkein(skeinName)
    setView('skeins')
  }, [setView])

  // A rhythm template row in the Skeins view stands for every cast instance of
  // a recurring thread at once (see rhythmTemplateGroups) — renaming or
  // deleting it should act on all of them together, not just one day's copy.
  const patchRhythmTemplate = useCallback((skeinName, title, patch) => {
    loom.threads
      .filter(th => th.skein === skeinName && th.title === title)
      .forEach(th => loom.patchThread(th.id, patch))
  }, [loom])
  const removeRhythmTemplate = useCallback((skeinName, title) => {
    loom.threads
      .filter(th => th.skein === skeinName && th.title === title)
      .forEach(th => loom.removeThread(th.id))
  }, [loom])

  const actions = useMemo(() => ({
    addThread: loom.addThread,
    patchThread: loom.patchThread,
    removeThread: removeWithUndo,
    toggleWoven: loom.toggleWoven,
    castDraft,
    castRhythm,
    patchRhythmTemplate,
    removeRhythmTemplate,
    reorderWithin: (group, id, targetIndex) => {
      loom.patchThread(id, { order: orderForMove(group, id, targetIndex) })
    },
  }), [loom, removeWithUndo, castDraft, castRhythm, patchRhythmTemplate, removeRhythmTemplate])

  // Save a new manual drag order for skeins.
  const handleSkeinReorder = useCallback((newOrder) => {
    setPrefs(p => { const next = { ...p, skeinOrder: newOrder }; saveViewPrefs(next); return next })
  }, [])

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
                onSkeinReorder={handleSkeinReorder}
                rhythms={rhythms}
                rhythmSkeinNames={rhythmSkeinNames}
                onToggleRhythm={handleToggleRhythm}
                onSetRhythmDays={handleSetRhythmDays}
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
                  rhythms={rhythms}
                  rhythmSkeinNames={rhythmSkeinNames}
                  onEditInRhythm={handleEditInRhythm}
                  onPrevWeek={() => setAnchor(a => addDays(startOfWeek(a), -7))}
                  onNextWeek={() => setAnchor(a => addDays(startOfWeek(a), 7))}
                  onThisWeek={() => setAnchor(new Date())}
                />
        )}
      </main>

      {loom.status === 'ready' && loom.error && (
        <div className={styles.toast} role="status" onClick={loom.dismissError}>{loom.error}</div>
      )}

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
        rhythmSkeinNames={rhythmSkeinNames}
      />
    </div>
  )
}
