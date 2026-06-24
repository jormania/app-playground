import { useState, useEffect, useCallback, useMemo } from 'react'
import './journal.css'
import { getClient, isLive } from './store.js'
import { todayKey, findByDate } from './dates.js'
import { filterEntries } from './search.js'
import MenuBar from './MenuBar.jsx'
import ListView from './ListView.jsx'
import CalendarView from './CalendarView.jsx'
import EntryView from './EntryView.jsx'
import EntryEditor from './EntryEditor.jsx'
import SettingsModal from './SettingsModal.jsx'
import StatsModal from './StatsModal.jsx'

const VIEW_KEY = 'jod_view' // remember list/calendar preference

export default function App() {
  const [view, setView] = useState(() => {
    try { return localStorage.getItem(VIEW_KEY) || 'list' } catch { return 'list' }
  })
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [focus, setFocus] = useState(null)      // null | {kind:'view', entry} | {kind:'edit', initial}
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [live, setLive] = useState(isLive())
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const list = await getClient().listEntries()
      setEntries(list)
    } catch (err) {
      setLoadError(err.message || 'Could not load your journal.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => filterEntries(entries, query, scope), [entries, query, scope])
  const searching = query.trim().length > 0

  function chooseView(v) {
    setView(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* ignore */ }
    setFocus(null)
  }

  function openToday() {
    const key = todayKey()
    const existing = findByDate(entries, key)
    setSaveError('')
    setFocus(existing ? { kind: 'view', entry: existing } : { kind: 'edit', initial: { date: key } })
  }

  async function handleSave(entry) {
    setSaving(true)
    setSaveError('')
    try {
      const client = getClient()
      const saved = entry.id ? await client.updateEntry(entry.id, entry) : await client.createEntry(entry)
      // Refresh from source so Word Count (a Notion formula) reflects the save.
      const list = await client.listEntries()
      setEntries(list)
      const fresh = findByDate(list, saved.date) || saved
      setFocus({ kind: 'view', entry: fresh })
    } catch (err) {
      setSaveError(err.message || 'Could not save. Check your connection and token.')
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
        onSettings={() => setShowSettings(true)}
      />

      <main>
        <div className="container">
          {!live && !focus && (
            <div className="banner">
              <span><b>Demo mode.</b> These are sample delights on this device. Connect Notion to keep your own.</span>
              <button onClick={() => setShowSettings(true)}>Connect</button>
            </div>
          )}
          {loadError && <div className="error-note">{loadError}</div>}

          {focus?.kind === 'edit' ? (
            <EntryEditor
              initial={focus.initial}
              entries={entries}
              saving={saving}
              error={saveError}
              onSave={handleSave}
              onCancel={() => { setSaveError(''); setFocus(null) }}
              onOpenExisting={(e) => { setSaveError(''); setFocus({ kind: 'view', entry: e }) }}
            />
          ) : focus?.kind === 'view' ? (
            <EntryView
              entry={focus.entry}
              onBack={() => setFocus(null)}
              onEdit={(e) => setFocus({ kind: 'edit', initial: e })}
            />
          ) : loading ? (
            <div className="loading"><p>Gathering your delights…</p></div>
          ) : view === 'list' ? (
            <ListView
              entries={filtered}
              onOpen={(e) => setFocus({ kind: 'view', entry: e })}
              emptyMessage={searching ? 'Nothing matches that search.' : undefined}
            />
          ) : (
            <CalendarView
              entries={filtered}
              onOpenEntry={(e) => setFocus({ kind: 'view', entry: e })}
              onNewOn={(key) => { setSaveError(''); setFocus({ kind: 'edit', initial: { date: key } }) }}
            />
          )}
        </div>
      </main>

      <footer className="foot">
        <div className="container">
          after Ross Gay’s <a href="https://www.rossgay.net/the-book-of-delights" target="_blank" rel="noopener"><em>The Book of Delights</em></a> · <a href="/">Cone of Cold</a>
        </div>
      </footer>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onChanged={onSettingsChanged} />}
      {showStats && <StatsModal entries={entries} onClose={() => setShowStats(false)} />}
    </>
  )
}
