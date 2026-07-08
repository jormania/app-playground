import { useState, useEffect, useCallback, useMemo } from 'react'
import './wanderlist.css'
import { getClient, isLive, loadPreset, savePreset, applyPreset, nextPreset, presetById, modeOf, THEME_KEY } from './store.js'
import { todayKey } from './dates.js'
import { triage, filterByStatus, filterBySearch } from './search.js'
import MenuBar from './MenuBar.jsx'
import ListView from './ListView.jsx'
import CalendarView from './CalendarView.jsx'
import EntryView from './EntryView.jsx'
import EntryEditor from './EntryEditor.jsx'
import SettingsModal from './SettingsModal.jsx'

export default function App() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [focus, setFocus] = useState(null)      // null | {kind:'view', entry} | {kind:'edit', initial}
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [live, setLive] = useState(isLive())
  const [offline, setOffline] = useState(false)

  const [view, setView] = useState('list') // 'list' | 'calendar'
  const [status, setStatus] = useState('todo')
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('all')
  const [sort, setSort] = useState('expiring')
  const [preset, setPresetState] = useState(loadPreset())

  const today = todayKey()

  // Apply <html data-theme> + mobile bar colour and persist whenever the preset changes.
  useEffect(() => { applyPreset(preset); savePreset(preset) }, [preset])

  // Live-sync the palette with the guide (and other tabs) via the shared theme key.
  useEffect(() => {
    const onStorage = (e) => { if (e.key === THEME_KEY) setPresetState(loadPreset()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Opening an item or the editor swaps content in place — the page never navigates, so
  // scroll to the top so a long detail/editor doesn't land mid-page.
  useEffect(() => { if (focus) window.scrollTo({ top: 0, behavior: 'instant' }) }, [focus])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    const client = getClient()
    try {
      if (client.sync && navigator.onLine !== false) { try { await client.sync() } catch { /* stays queued */ } }
      const list = await client.listEntries()
      setEntries(list)
      setOffline(Boolean(client.offline))
    } catch (err) {
      setLoadError(err.message || 'Could not load your list.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Reconnecting flushes the outbox and refreshes; losing the connection flips the banner.
  useEffect(() => {
    const onOnline = () => load()
    const onOffline = () => setOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [load])

  const filtered = useMemo(
    () => triage(entries, { status, query, scope, sort, today }),
    [entries, status, query, scope, sort, today]
  )
  // Calendar uses the same status + search filter (so markers respect To-do/Attended and
  // any search), but not the list sort — the grid places entries by their dates.
  const calendarEntries = useMemo(
    () => filterBySearch(filterByStatus(entries, status), query, scope),
    [entries, status, query, scope]
  )
  const searching = query.trim().length > 0

  function openAdd() {
    setSaveError('')
    setFocus({ kind: 'edit', initial: {} })
  }

  // Tapping a chip filters by it across the whole list (status → all so nothing is hidden;
  // returns to the list so the results are visible).
  function filterByChip(chipScope, value) {
    setScope(chipScope)
    setQuery(value)
    setStatus('all')
    setView('list')
    setFocus(null)
  }

  async function handleSave(entry) {
    setSaving(true)
    setSaveError('')
    try {
      const client = getClient()
      const saved = entry.id ? await client.updateEntry(entry.id, entry) : await client.createEntry(entry)
      const list = await client.listEntries()
      setEntries(list)
      setOffline(Boolean(client.offline))
      const fresh = list.find(e => e.id === saved.id) || saved
      setFocus({ kind: 'view', entry: fresh })
    } catch (err) {
      setSaveError(err.message || 'Could not save — try again.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleAttended(entry) {
    const updated = { ...entry, attended: !entry.attended }
    setEntries(list => list.map(e => (e.id === entry.id ? updated : e)))
    setFocus(f => (f?.kind === 'view' && f.entry.id === entry.id ? { kind: 'view', entry: updated } : f))
    try {
      const client = getClient()
      await client.updateEntry(entry.id, updated)
      const list = await client.listEntries()
      setEntries(list)
      setOffline(Boolean(client.offline))
      setFocus(f => (f?.kind === 'view' && f.entry.id === entry.id ? { kind: 'view', entry: list.find(e => e.id === entry.id) || updated } : f))
    } catch (err) {
      setSaveError(err.message || 'Could not update — reloading.')
      load()
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
          <div className="eyebrow">a city worth wandering</div>
          <h1>Wander<em>list</em></h1>
          <p className="blurb">Everything you mean to go and see — kept in one place, triaged when you like, checked off as you go.</p>
        </div>
      </header>

      <MenuBar
        status={status}
        onStatus={(s) => { setStatus(s); setFocus(null) }}
        query={query}
        scope={scope}
        onQuery={setQuery}
        onScope={setScope}
        sort={sort}
        onSort={setSort}
        view={view}
        onToggleView={() => { setFocus(null); setView(v => (v === 'list' ? 'calendar' : 'list')) }}
        onAdd={openAdd}
        onSettings={() => setShowSettings(true)}
        themeMode={modeOf(preset)}
        themeName={presetById(preset).name}
        onCycleTheme={() => setPresetState(nextPreset(preset))}
      />

      <main>
        <div className="container">
          {!live && !focus && (
            <div className="banner">
              <span><b>Demo mode.</b> These are sample things to do on this device. Connect Notion to keep your own.</span>
              <button onClick={() => setShowSettings(true)}>Connect</button>
            </div>
          )}
          {live && offline && !focus && (
            <div className="banner offline">
              <span><b>Offline.</b> Showing your last synced list — anything you add now saves here and syncs to Notion when you’re back.</span>
            </div>
          )}
          {loadError && <div className="error-note" aria-live="polite">{loadError}</div>}

          {focus?.kind === 'edit' ? (
            <EntryEditor
              initial={focus.initial}
              entries={entries}
              saving={saving}
              error={saveError}
              onSave={handleSave}
              onCancel={() => { setSaveError(''); setFocus(null) }}
            />
          ) : focus?.kind === 'view' ? (
            <EntryView
              entry={focus.entry}
              onBack={() => setFocus(null)}
              onEdit={(e) => setFocus({ kind: 'edit', initial: e })}
              onChip={filterByChip}
              onToggleAttended={toggleAttended}
              saving={saving}
              today={today}
            />
          ) : loading ? (
            <div className="loading"><p>Gathering your list…</p></div>
          ) : view === 'calendar' ? (
            <CalendarView
              entries={calendarEntries}
              today={today}
              onOpen={(e) => setFocus({ kind: 'view', entry: e })}
              onChip={filterByChip}
            />
          ) : (
            <ListView
              entries={filtered}
              total={entries.length}
              onOpen={(e) => setFocus({ kind: 'view', entry: e })}
              onChip={filterByChip}
              onToggleAttended={toggleAttended}
              today={today}
              emptyMessage={searching ? 'Nothing matches that search.' : (status === 'attended' ? 'Nothing marked attended yet.' : undefined)}
            />
          )}
        </div>
      </main>

      <footer className="foot">
        <div className="container">
          Wanderlist · a backlog of city things to do, kept in your own Notion
        </div>
      </footer>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onChanged={onSettingsChanged} />}
    </>
  )
}
