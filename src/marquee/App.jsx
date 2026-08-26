import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, ConfirmModal } from '../ds'
import VenueList from './VenueList.jsx'
import VenueForm from './VenueForm.jsx'
import Changes from './Changes.jsx'
import Programme from './Programme.jsx'
import KeepSheet from './KeepSheet.jsx'
import SettingsModal from './SettingsModal.jsx'
import { sortVenues, scannable, togglePaused } from './venues.js'
import { toProductions, byDate, visibleProductions, dropStarted, TRIAGE } from './programme.js'
import { annotateSaved, buildFindingsIndex, EMPTY_INDEX } from './findings.js'
import { summarize } from './changes.js'
import { runScan, loadLastScan, loadSnapshot } from './scanClient.js'
import { getClient, loadTriage, saveTriage, loadPrefs, savePrefs } from './store.js'
import { formatDay } from './format.js'

/** Marquee.
 *
 *  Two screens: the programme (what's on, and what changed since you last looked)
 *  and the venues (what gets read). The programme is the default because the
 *  venues are a thing you set up once and the programme is the thing you check.
 */
export default function App() {
  const [client, setClient] = useState(() => getClient())
  const [tab, setTab] = useState('programme')

  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const [scan, setScan] = useState(() => loadLastScan())
  const [scanning, setScanning] = useState(false)
  // The programme on screen is always the LAST check, not a live view. Editing a
  // venue (or pausing one) does not re-read anything, so a result — including a
  // failure notice — can outlive the reason it happened. This flag is what makes
  // the app say so instead of leaving you to wonder why the old error is still
  // there.
  const [scanStale, setScanStale] = useState(false)

  const [triage, setTriageState] = useState(() => loadTriage())
  const [venueFilter, setVenueFilter] = useState(null)
  const [keeping, setKeeping] = useState(null)

  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [findings, setFindings] = useState(EMPTY_INDEX)
  const [findingsError, setFindingsError] = useState(null)
  const [prefs, setPrefs] = useState(() => loadPrefs())

  const load = useCallback(async (c) => {
    setLoading(true)
    setError(null)
    try {
      setVenues(await c.listVenues())
    } catch (err) {
      setError(err?.message || 'Could not load your venues.')
    } finally {
      setLoading(false)
    }
  }, [])

  /** What Wanderlist already holds. Deliberately NOT fatal: if Findings can't be
   *  read (no access on the integration, a bad database id), Marquee still works
   *  — it just can't tell you what you already have, and says so quietly rather
   *  than blocking the programme. */
  const loadFindings = useCallback(async (c) => {
    try {
      setFindings(buildFindingsIndex(await c.listFindings()))
      setFindingsError(null)
    } catch (err) {
      setFindings(EMPTY_INDEX)
      // Deliberately blunt: the same database is what keeping WRITES to, so a
      // read failure means saves will fail too. The old copy said only that
      // "already kept" was unknown, which let someone discover the real problem
      // by losing a save.
      setFindingsError(err?.message
        ? `Wanderlist’s Findings can’t be read: ${err.message} Until that’s fixed, keeping a night will fail too — check Settings → Notion.`
        : 'Wanderlist’s Findings can’t be read, so keeping a night will fail and Marquee can’t tell what you already have. Check Settings → Notion.')
    }
  }, [])

  useEffect(() => { load(client) }, [client, load])
  useEffect(() => { loadFindings(client) }, [client, loadFindings])

  // Theme. "system" clears the attribute entirely so the stylesheet's own
  // prefers-color-scheme block takes over — and keeps following the OS when it
  // changes, which a stored 'light'/'dark' never would. The <meta theme-color>
  // that tints browser chrome can't be driven from CSS, so it is set here too.
  useEffect(() => {
    const root = document.documentElement
    if (prefs.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', prefs.theme)

    const dark = prefs.theme === 'dark'
      || (prefs.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1a141a' : '#f6f2ee')
  }, [prefs.theme])

  // Follow the OS while on "system": without this the chrome tint goes stale the
  // moment the device flips at sunset.
  useEffect(() => {
    if (prefs.theme !== 'system') return undefined
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', mq.matches ? '#1a141a' : '#f6f2ee')
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [prefs.theme])

  useEffect(() => { savePrefs(prefs) }, [prefs])

  const sorted = useMemo(() => sortVenues(venues), [venues])
  // Sorted, so the filter chips read in the same order as the Venues tab.
  const active = useMemo(() => sortVenues(scannable(venues)), [venues])

  const productions = useMemo(
    () => annotateSaved(
      toProductions(dropStarted(scan?.events ?? [], { keep: prefs.keepToday })),
      findings,
    ),
    [scan, prefs.keepToday, findings],
  )

  const days = useMemo(() => byDate(visibleProductions(productions, {
    triage,
    venue: venueFilter,
    hideIgnored: !prefs.showIgnored,
    hideSoldOut: prefs.hideSoldOut,
  })), [productions, triage, venueFilter, prefs.showIgnored, prefs.hideSoldOut])

  const counts = useMemo(() => ({
    soldOut: productions.filter((p) => p.allSoldOut).length,
    ignored: productions.filter((p) => triage[p.id] === TRIAGE.IGNORED).length,
  }), [productions, triage])

  function setTriage(id, state) {
    setTriageState((current) => {
      const next = { ...current }
      if (state) next[id] = state
      else delete next[id]
      saveTriage(next)
      return next
    })
  }

  async function withBusy(id, fn) {
    setBusyId(id)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err?.message || 'That didn’t work.')
    } finally {
      setBusyId(null)
    }
  }

  const handleScan = async () => {
    setScanning(true)
    setError(null)
    const previousScanAt = loadSnapshot()?.scannedAt ?? null
    try {
      const result = await runScan(venues)
      if (result.nothingToScan) {
        setError('Every venue is paused, so there was nothing to read.')
        return
      }
      setScan({ ...result, previousScanAt })
      setScanStale(false)
      setTab('programme')
      // Write each venue's outcome back to its Notion row, so Settings can show
      // when it was last read without a fresh scan. Best-effort: a failed
      // bookkeeping write must not look like a failed scan.
      for (const venueResult of result.venues) {
        if (!venueResult.venueId) continue
        try {
          const saved = await client.recordScan(venueResult.venueId, {
            checkedAt: venueResult.checkedAt,
            result: summarize(venueResult),
          })
          setVenues((list) => list.map((v) => (v.id === saved.id ? saved : v)))
        } catch { /* bookkeeping only */ }
      }
    } catch (err) {
      setError(err?.message || 'The scan failed.')
    } finally {
      setScanning(false)
    }
  }

  const handleSave = async (venue) => {
    const saved = venue.id ? await client.updateVenue(venue) : await client.addVenue(venue)
    setVenues((list) => (venue.id ? list.map((v) => (v.id === saved.id ? saved : v)) : [...list, saved]))
    if (scan) setScanStale(true)
  }

  const handleTogglePause = (venue) =>
    withBusy(venue.id, async () => {
      const next = togglePaused(venue)
      const saved = await client.setStatus(venue.id, next.status)
      setVenues((list) => list.map((v) => (v.id === saved.id ? saved : v)))
      if (scan) setScanStale(true)
    })

  const handleRemove = () =>
    withBusy(removing.id, async () => {
      await client.removeVenue(removing.id)
      setVenues((list) => list.filter((v) => v.id !== removing.id))
      setRemoving(null)
      if (scan) setScanStale(true)
    })

  const handleKeep = async (draft) => {
    await client.saveToWanderlist(draft)
    // Re-read rather than patching the index by hand: whatever Notion actually
    // stored is what the next dedupe check has to match against.
    await loadFindings(client)
  }

  const keepVenue = keeping ? venues.find((v) => v.name === keeping.showing.venue) ?? null : null

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1 className="topbar__title">Marquee</h1>
          <p className="topbar__sub">
            {client.mode === 'demo'
              ? 'demo · not connected to Notion'
              : scan?.scannedAt
                ? `last checked ${formatDay(scan.scannedAt.slice(0, 10), { relative: true })}`
                : `${active.length} venue${active.length === 1 ? '' : 's'} watched`}
          </p>
        </div>
        <div className="topbar__actions">
          <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
            Settings
          </Button>
          <Button size="sm" onClick={handleScan} disabled={scanning || loading || active.length === 0}>
            {scanning ? 'Checking…' : 'Check venues'}
          </Button>
        </div>
      </header>

      <nav className="tabs" aria-label="Views">
        <button
          type="button"
          className={`tab ${tab === 'programme' ? 'tab--on' : ''}`}
          onClick={() => setTab('programme')}
          aria-current={tab === 'programme'}
        >
          Programme
        </button>
        <button
          type="button"
          className={`tab ${tab === 'venues' ? 'tab--on' : ''}`}
          onClick={() => setTab('venues')}
          aria-current={tab === 'venues'}
        >
          Venues{venues.length ? ` (${venues.length})` : ''}
        </button>
      </nav>

      <main className="main">
        {client.mode === 'demo' && (
          <p className="banner">
            Demo mode: seven real Bucharest venues, held in memory. Checking them really does read
            their pages, but venue edits and anything you keep never reach Notion.
          </p>
        )}

        {error && <p className="warn warn--stop" role="alert">{error}</p>}
        {findingsError && <p className="warn">{findingsError}</p>}

        {tab === 'programme' ? (
          <>
            <Changes scan={scan} onOpen={() => setTab('programme')} />
            <Programme
              scan={scan}
              stale={scanStale}
              scanning={scanning}
              days={days}
              triage={triage}
              venues={active}
              venueFilter={venueFilter}
              onVenueFilter={setVenueFilter}
              onKeep={(showing, production) => setKeeping({ showing, production })}
              onIgnore={(production) =>
                setTriage(production.id, triage[production.id] === TRIAGE.IGNORED ? null : TRIAGE.IGNORED)}
            />
          </>
        ) : loading ? (
          <p className="empty">Loading venues…</p>
        ) : (
          <>
            <VenueList
              venues={sorted}
              busyId={busyId}
              onTogglePause={handleTogglePause}
              onEdit={(v) => { setEditing(v); setFormOpen(true) }}
              onRemove={(v) => setRemoving(v)}
            />
            <div className="venues__foot">
              <Button variant="secondary" size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}>
                Add venue
              </Button>
              {sorted.length > 0 && (
                <p className="footnote">
                  {active.length === 0
                    ? 'Every venue is paused — a check would have nothing to read.'
                    : `${active.length} of ${sorted.length} read on each check.`}
                </p>
              )}
            </div>
          </>
        )}
      </main>

      <VenueForm
        open={formOpen}
        venue={editing}
        existing={venues}
        onSave={handleSave}
        onClose={() => { setFormOpen(false); setEditing(null) }}
      />

      <KeepSheet
        open={Boolean(keeping)}
        showing={keeping?.showing}
        production={keeping?.production}
        venue={keepVenue}
        demo={client.mode === 'demo'}
        findings={findings}
        findingsUnavailable={Boolean(findingsError)}
        onSave={handleKeep}
        onClose={() => setKeeping(null)}
      />

      <ConfirmModal
        isOpen={Boolean(removing)}
        title={`Remove ${removing?.name ?? 'this venue'}?`}
        message="Its Notion row is archived, not deleted — you can restore it from Notion’s trash if you change your mind. To stop checking it without losing anything, pause it instead."
        confirmText="Remove"
        variant="danger"
        onConfirm={handleRemove}
        onCancel={() => setRemoving(null)}
      />

      <SettingsModal
        open={settingsOpen}
        prefs={prefs}
        onPrefs={setPrefs}
        counts={counts}
        onClose={() => setSettingsOpen(false)}
        onChanged={() => setClient(getClient())}
      />
    </div>
  )
}
