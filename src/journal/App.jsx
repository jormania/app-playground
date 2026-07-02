import { useState, useEffect, useCallback, useMemo } from 'react'
import './journal.css'
import { getClient, isLive, clearDraft, listDrafts, discardDraft, getTheme, setTheme } from './store.js'
import { todayKey, findByDate } from './dates.js'
import { filterEntries } from './search.js'
import { downloadJournal } from './exportHtml.js'
import MenuBar from './MenuBar.jsx'
import ListView from './ListView.jsx'
import CalendarView from './CalendarView.jsx'
import YearView from './YearView.jsx'
import EntryView from './EntryView.jsx'
import EntryEditor from './EntryEditor.jsx'
import SettingsModal from './SettingsModal.jsx'
import StatsModal from './StatsModal.jsx'
import OnThisDayModal from './OnThisDayModal.jsx'

export default function App() {
  // List is the default landing every time the app opens; Calendar and Year are
  // secondary, reachable from the view menu but never the launch state.
  const [view, setView] = useState('list')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [focus, setFocus] = useState(null)      // null | {kind:'view', entry} | {kind:'edit', initial}
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [onThisDay, setOnThisDay] = useState(null) // null | dateKey
  const [live, setLive] = useState(isLive())
  const [offline, setOffline] = useState(false)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('all')
  const [theme, setThemeState] = useState(getTheme())
  const [draftTick, setDraftTick] = useState(0) // bump to re-read drafts from storage

  // Keep <html data-theme> and the mobile bar colour in sync with the choice.
  useEffect(() => { setTheme(theme) }, [theme])

  // Opening an entry (or the editor) swaps content in place — the page itself
  // never navigates, so without this the scroll position from wherever you were
  // in the list (or a previous entry) carries straight over. Most noticeable on
  // a photo entry, where the height differs enough to land mid-page instead of
  // at the top. Going back to null (the list) is left alone, so list scroll
  // position is preserved there.
  useEffect(() => {
    if (focus) window.scrollTo({ top: 0, behavior: 'instant' })
  }, [focus])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    const client = getClient()
    try {
      // Flush anything written while offline before reading, so a reconnect
      // reconciles first. No-op when the outbox is empty or we're still offline.
      if (client.sync && navigator.onLine !== false) { try { await client.sync() } catch { /* stays queued */ } }
      const list = await client.listEntries()
      setEntries(list)
      setOffline(Boolean(client.offline))
    } catch (err) {
      setLoadError(err.message || 'Could not load your journal.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Reconnecting flushes the outbox and refreshes; losing the connection flips the
  // banner immediately (the next read will confirm it's serving from cache).
  useEffect(() => {
    const onOnline = () => load()
    const onOffline = () => setOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [load])

  const filtered = useMemo(() => filterEntries(entries, query, scope), [entries, query, scope])
  const searching = query.trim().length > 0
  // Interrupted, not-yet-saved delights, re-read whenever entries change or a draft
  // is saved/discarded (draftTick). Hidden while searching to keep results clean.
  const drafts = useMemo(() => listDrafts(entries), [entries, draftTick]) // eslint-disable-line react-hooks/exhaustive-deps

  function resumeDraft(dateKey) {
    setSaveError('')
    setFocus({ kind: 'edit', initial: { date: dateKey } })
  }
  function removeDraft(dateKey) {
    discardDraft(dateKey)
    setDraftTick(t => t + 1)
  }

  function chooseView(v) {
    setView(v)
    setFocus(null)
  }

  function openToday() {
    const key = todayKey()
    const existing = findByDate(entries, key)
    setSaveError('')
    setFocus(existing ? { kind: 'view', entry: existing } : { kind: 'edit', initial: { date: key } })
  }

  // Tapping a tag/person chip filters the list by it.
  function filterByChip(chipScope, value) {
    setScope(chipScope)
    setQuery(value)
    setView('list')
    setFocus(null)
  }

  async function handleSave({ photoAction, ...entry }) {
    setSaving(true)
    setSaveError('')
    try {
      const client = getClient()
      let saved = entry.id ? await client.updateEntry(entry.id, entry) : await client.createEntry(entry)
      // Photo actions need a real page id, and Notion itself — skip if the text
      // save just got queued offline (saved.pending); nothing to attach to yet.
      if (photoAction && !saved.pending) {
        if (photoAction.type === 'set') saved = await client.attachPhoto(saved.id, { ref: photoAction.ref, name: photoAction.name })
        else if (photoAction.type === 'remove') saved = await client.removePhoto(saved.id)
      }
      clearDraft(entry.date) // saved safely — drop the local draft
      // Refresh from source so Word Count (a Notion formula) reflects the save.
      const list = await client.listEntries()
      setEntries(list)
      const fresh = findByDate(list, saved.date) || saved
      setFocus({ kind: 'view', entry: fresh })
    } catch (err) {
      // Draft is still in localStorage, so nothing is lost — the Save button retries.
      setSaveError(err.message || 'Could not save — your draft is kept locally; try again.')
    } finally {
      setSaving(false)
    }
  }

  function onSettingsChanged() {
    setLive(isLive())
    load()
  }

  return (
    <>
      <header className="masthead">
        <div className="container">
          <div className="eyebrow">a daily practice of attention</div>
          <h1>Journal of <em>Delights</em></h1>
          <p className="blurb">One small thing, noticed closely and written down. Not a good day required — just an act of attention.</p>
        </div>
      </header>

      <MenuBar
        view={view}
        onView={chooseView}
        query={query}
        scope={scope}
        onQuery={setQuery}
        onScope={setScope}
        onToday={openToday}
        onStats={() => setShowStats(true)}
        onExport={() => downloadJournal(entries)}
        onSettings={() => setShowSettings(true)}
        theme={theme}
        onToggleTheme={() => setThemeState(t => (t === 'dark' ? 'light' : 'dark'))}
      />

      <main>
        <div className="container">
          {!live && !focus && (
            <div className="banner">
              <span><b>Demo mode.</b> These are sample delights on this device. Connect Notion to keep your own.</span>
              <button onClick={() => setShowSettings(true)}>Connect</button>
            </div>
          )}
          {live && offline && !focus && (
            <div className="banner offline">
              <span><b>Offline.</b> Showing your last synced delights — anything you write now saves here and syncs to Notion when you’re back.</span>
            </div>
          )}
          {loadError && <div className="error-note" aria-live="polite">{loadError}</div>}

          {focus?.kind === 'edit' ? (
            <EntryEditor
              initial={focus.initial}
              entries={entries}
              saving={saving}
              error={saveError}
              offline={offline}
              onSave={handleSave}
              onSaveDraft={() => { setSaveError(''); setDraftTick(t => t + 1); setFocus(null) }}
              onCancel={() => { setSaveError(''); setDraftTick(t => t + 1); setFocus(null) }}
              onOpenExisting={(e) => { setSaveError(''); setFocus({ kind: 'view', entry: e }) }}
              onOnThisDay={(key) => setOnThisDay(key)}
            />
          ) : focus?.kind === 'view' ? (
            <EntryView
              entry={focus.entry}
              entries={entries}
              onBack={() => setFocus(null)}
              onEdit={(e) => setFocus({ kind: 'edit', initial: e })}
              onChip={filterByChip}
              onOnThisDay={(key) => setOnThisDay(key)}
            />
          ) : loading ? (
            <div className="loading"><p>Gathering your delights…</p></div>
          ) : view === 'list' ? (
            <ListView
              entries={filtered}
              total={entries.length}
              drafts={searching ? [] : drafts}
              onResumeDraft={resumeDraft}
              onDiscardDraft={removeDraft}
              onOpen={(e) => setFocus({ kind: 'view', entry: e })}
              onChip={filterByChip}
              emptyMessage={searching ? 'Nothing matches that search.' : undefined}
            />
          ) : view === 'calendar' ? (
            <CalendarView
              entries={filtered}
              onOpenEntry={(e) => setFocus({ kind: 'view', entry: e })}
              onNewOn={(key) => { setSaveError(''); setFocus({ kind: 'edit', initial: { date: key } }) }}
            />
          ) : (
            <YearView
              entries={filtered}
              onOpenEntry={(e) => setFocus({ kind: 'view', entry: e })}
              onNewOn={(key) => { setSaveError(''); setFocus({ kind: 'edit', initial: { date: key } }) }}
            />
          )}
        </div>
      </main>

      <footer className="foot">
        <div className="container">
          based on Ross Gay’s <a href="https://www.rossgay.net/the-book-of-delights" target="_blank" rel="noopener"><em>The Book of Delights</em></a>
        </div>
      </footer>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onChanged={onSettingsChanged} />}
      {showStats && <StatsModal entries={entries} onClose={() => setShowStats(false)} />}
      {onThisDay && <OnThisDayModal entries={entries} dateKey={onThisDay} onClose={() => setOnThisDay(null)} />}
    </>
  )
}
