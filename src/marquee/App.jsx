import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, ConfirmModal, IconButton, ToastStack, useToastStack } from '../ds'
import {
  Settings as SettingsIcon, Search as SearchIcon, X as ClearIcon,
  RefreshCw as RefreshIcon, LayoutGrid as PostersIcon, List as ListIcon,
  Star as StarIcon, Drama as TheatreIcon, Clapperboard as MovieIcon,
  Music as ConcertIcon, Ticket as EventIcon, Image as ArtIcon, Landmark as CultureIcon,
} from 'lucide-react'
import VenueList from './VenueList.jsx'
import VenueForm from './VenueForm.jsx'
import Changes from './Changes.jsx'
import Programme, { FilterRow } from './Programme.jsx'
import WeekStrip from './WeekStrip.jsx'
import KeepSheet from './KeepSheet.jsx'
import SettingsModal from './SettingsModal.jsx'
import { sortVenues, scannable, togglePaused, searchVenues } from './venues.js'
import {
  toProductions, byDate, visibleProductions, searchProductions, dropStarted, productionId, domIdFor,
  changedKeyMap, TRIAGE, venueCategoryMap, categoriesInUse, hallsInUse, nextDayKeys, densityForDays,
  troubleByVenue, CATEGORY_LABEL,
} from './programme.js'
import { annotateSaved, buildFindingsIndex, EMPTY_INDEX } from './findings.js'
import { summarize, changeSignature, undismissedChanges } from './changes.js'
import { runScan, loadLastScan } from './scanClient.js'
import { getClient, loadTriage, saveTriage, loadPrefs, savePrefs, loadDismissedChanges, saveDismissedChanges } from './store.js'
import { formatDay } from './format.js'
import { writeNotifyPrefs, writeNotifyVenues, registerPeriodicSync, previewFromQuery } from './notify.js'

/** One icon per real category (venues.js's CATEGORIES, not a hardcoded set —
 *  a category with no icon here still renders, just without one). */
const CATEGORY_ICON = {
  play: TheatreIcon,
  movie: MovieIcon,
  concert: ConcertIcon,
  event: EventIcon,
  art: ArtIcon,
  culture: CultureIcon,
}

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
  // Distinct from `loading`: this stays false when a load FAILS, and that is
  // exactly what the notify mirror below keys on — see writeNotifyVenues.
  const [venuesLoaded, setVenuesLoaded] = useState(false)
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
  // Dismissing "What changed" hides those specific entries — persisted, so a
  // later check that finds nothing NEW doesn't resurface them. It reappears
  // only once a check produces an entry that isn't already in this set (see
  // visibleChanges below), not on every scan regardless of content.
  const [dismissedKeys, setDismissedKeys] = useState(() => loadDismissedChanges())

  const [triage, setTriageState] = useState(() => loadTriage())
  // Three tiers, each narrowing the one before it: a category (Theatre, Cinema, …)
  // reveals that category's venues, a venue reveals its own halls when it has more
  // than one. Picking a broader tier resets the narrower ones — there is no sense
  // in which a stale hall filter should survive switching venues out from under it.
  const [categoryFilter, setCategoryFilter] = useState(null)
  const [venueFilter, setVenueFilter] = useState(null)
  const [hallFilter, setHallFilter] = useState(null)
  const [search, setSearch] = useState('')
  // The Venues tab has its own query rather than sharing the programme's.
  // Sharing looked tidier and behaved badly: a leftover "Tomcat" would carry
  // across on a tab switch and empty the venue list with no visible cause —
  // the same trap that made a "What changed" row scroll to a card the search
  // was hiding (§9.29's finding).
  const [venueSearch, setVenueSearch] = useState('')
  const [keeping, setKeeping] = useState(null)

  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [findings, setFindings] = useState(EMPTY_INDEX)
  const [findingsError, setFindingsError] = useState(null)
  const [prefs, setPrefs] = useState(() => loadPrefs())
  const { toasts, push: pushToast, dismiss: dismissToast } = useToastStack()

  const load = useCallback(async (c) => {
    setLoading(true)
    setError(null)
    try {
      setVenues(await c.listVenues())
      setVenuesLoaded(true)
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

  // Prefs reach the worker unconditionally — not gated on notifyEnabled,
  // because a toggle flipped OFF has to stop a background wake that started
  // before this session opened.
  useEffect(() => { writeNotifyPrefs(prefs) }, [prefs])

  // The venue list, by contrast, is written only once a read has actually
  // succeeded. `venues` is `[]` on first render and stays `[]` if Notion
  // can't be reached, and mirroring that empty list would make the worker's
  // own "nothing to scan" guard a silent no-op until the app was next opened
  // successfully — invisible, for a feature that only matters while the app
  // is closed. See notify.js's writeNotifyVenues.
  useEffect(() => {
    if (venuesLoaded) writeNotifyVenues(venues)
  }, [venues, venuesLoaded])

  // Resume periodic sync on load if it was already granted — permission and a
  // service-worker registration both survive a reload, but the actual
  // registration call does not; without this, notifications silently stop the
  // next time the tab is closed and reopened even though Settings still shows
  // them as on.
  useEffect(() => {
    if (prefs.notifyEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      registerPeriodicSync()
    }
    // Preview hook: ?notify=preview fires one sample notification immediately,
    // for checking the format without waiting for a real background check.
    previewFromQuery()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onProgramme = tab === 'programme'

  const sorted = useMemo(() => sortVenues(venues), [venues])
  // What the Venues tab actually lists. `sorted` stays the full set — the
  // footnote below it counts your whole setup, not the current view.
  const visibleVenues = useMemo(() => searchVenues(sorted, venueSearch), [sorted, venueSearch])
  // Sorted, so the filter chips read in the same order as the Venues tab.
  const active = useMemo(() => sortVenues(scannable(venues)), [venues])

  const productions = useMemo(
    () => annotateSaved(
      toProductions(dropStarted(scan?.events ?? [], { keep: prefs.keepToday })),
      findings,
    ),
    [scan, prefs.keepToday, findings],
  )

  // name → category, built once from the active venue list rather than every
  // production carrying its own copy of something that lives on the venue row.
  const venueCategory = useMemo(() => venueCategoryMap(active), [active])
  // Only the categories something is actually watching — never a fixed list of
  // six chips regardless of what's active, and never reshuffled by how many
  // venues are in each.
  const categories = useMemo(() => categoriesInUse(active), [active])
  // Revealed only once a category is picked — this is the whole point: a
  // resting row of ~5 category chips instead of one flat row that grows with
  // every venue ever added.
  const venuesInCategory = useMemo(
    () => (categoryFilter ? active.filter((v) => v.category === categoryFilter) : []),
    [active, categoryFilter],
  )

  const byCategoryAndVenue = useMemo(() => visibleProductions(productions, {
    triage,
    venue: venueFilter,
    category: categoryFilter,
    venueCategory,
    hideIgnored: !prefs.showIgnored,
    hideSoldOut: prefs.hideSoldOut,
    hideKept: prefs.hideKept,
  }), [productions, triage, venueFilter, categoryFilter, venueCategory, prefs.showIgnored, prefs.hideSoldOut, prefs.hideKept])

  // Computed from the venue-filtered set, BEFORE any hall filter is applied —
  // otherwise picking a hall would immediately erase every other hall from the
  // options meant to let you switch back. Empty unless a single venue with more
  // than one hall is selected (see hallsInUse) — a venue with just one hall, or
  // none named at all, never grows a pointless third row.
  const hallOptions = useMemo(
    () => (venueFilter ? hallsInUse(byCategoryAndVenue, venueFilter) : []),
    [byCategoryAndVenue, venueFilter],
  )
  // Guards against a stale filter surviving a scan that no longer has that hall,
  // rather than trusting the state to always get cleared in time.
  const activeHallFilter = hallFilter && hallOptions.includes(hallFilter) ? hallFilter : null

  // The same filtered set feeds both the day list and the week strip below —
  // computed once so the two never disagree about what's currently visible.
  const visibleProductionsFlat = useMemo(() => searchProductions(
    activeHallFilter ? byCategoryAndVenue.filter((p) => p.hall === activeHallFilter) : byCategoryAndVenue,
    search,
  ), [byCategoryAndVenue, activeHallFilter, search])

  const days = useMemo(() => byDate(visibleProductionsFlat), [visibleProductionsFlat])

  // Today plus the next six, and how many productions land on each — cheap
  // enough (seven date constructions, one pass over the visible productions)
  // to recompute on every render rather than chase exactly when "today"
  // itself should invalidate a memo.
  const weekDensity = densityForDays(visibleProductionsFlat, nextDayKeys(new Date()))

  /** Category → venue → hall, each tier resetting the ones narrower than it —
   *  a stale hall filter surviving a venue switch, or a stale venue filter
   *  surviving a category switch, would silently hide productions you didn't
   *  mean to filter out. */
  const handleCategoryFilter = (category) => {
    setCategoryFilter(category)
    setVenueFilter(null)
    setHallFilter(null)
  }
  const handleVenueFilter = (venue) => {
    setVenueFilter(venue)
    setHallFilter(null)
  }

  // What "What changed" already said about this scan, keyed for a card to look
  // itself up in — so scrolling the programme shows you what's new in place,
  // not only in the strip at the top.
  const changedKeys = useMemo(() => changedKeyMap(scan?.changes), [scan])
  // Which venues the last check couldn't read, so the Venues tab can mark
  // them — the question Settings' old "Venue health" list was there to
  // answer, moved to the screen that already lists every venue.
  const venueTrouble = useMemo(() => troubleByVenue(scan?.venues), [scan])

  // See changes.js's undismissedChanges for what this filters and why.
  const visibleChanges = useMemo(() => undismissedChanges(scan?.changes, dismissedKeys), [scan, dismissedKeys])
  // Distinct from "this scan found nothing new" (scan.changes itself empty,
  // which Changes.jsx already renders its own message for) — this is "there
  // WAS something, and all of it is already dismissed", the case that used to
  // reset on every scan regardless of whether anything had actually changed.
  const changesDismissed = Boolean(scan?.changes?.length) && visibleChanges.length === 0

  const handleDismissChanges = () => {
    const signatures = visibleChanges.map(changeSignature)
    setDismissedKeys((current) => {
      const next = Array.from(new Set([...current, ...signatures]))
      saveDismissedChanges(next)
      return next
    })
  }

  const counts = useMemo(() => ({
    soldOut: productions.filter((p) => p.allSoldOut).length,
    ignored: productions.filter((p) => triage[p.id] === TRIAGE.IGNORED).length,
    kept: productions.filter((p) => p.savedAll).length,
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
    try {
      const result = await runScan(venues)
      if (result.nothingToScan) {
        setError('Every venue is paused, so there was nothing to read.')
        return
      }
      setScan(result)
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
    const saved = await client.saveToWanderlist(draft)
    // Re-read rather than patching the index by hand: whatever Notion actually
    // stored is what the next dedupe check has to match against.
    await loadFindings(client)
    // The only write this app makes, and until now there was no way back from
    // inside it short of finding the row in Wanderlist itself. Same undo shape
    // Radar-B's own dismissal toast uses: archive the page just created, which
    // Notion's trash can still recover even after the toast itself is gone.
    pushToast({
      message: `Kept “${draft.name}”.`,
      tone: 'success',
      actionLabel: 'Undo',
      onAction: async () => {
        try {
          await client.unsaveFromWanderlist(saved.id)
          await loadFindings(client)
        } catch {
          pushToast({ message: 'Could not undo — the row is still in Wanderlist.', tone: 'danger' })
        }
      },
    })
  }

  const keepVenue = keeping ? venues.find((v) => v.name === keeping.showing.venue) ?? null : null

  /** A "What changed" row is a claim about one production; clicking it should
   *  land you on that production, not just announce that it exists. Clears the
   *  venue filter first (a change can point at a production the current filter
   *  is hiding) and defers the scroll past that re-render before measuring the
   *  DOM — against last frame's layout, scrollIntoView would undershoot.
   *
   *  A deferred `setTimeout` rather than `requestAnimationFrame`: rAF is paused
   *  whenever the tab isn't in the foreground compositing frames, so a click
   *  right before switching away would silently never scroll. A macrotask still
   *  runs in the background (browsers throttle it, they don't stop it), and one
   *  tick is already enough for React to have committed the DOM by the time it
   *  fires. If the target is hidden for some other reason (ignored, sold-out
   *  with hideSoldOut on) this quietly does nothing rather than fighting those
   *  preferences too. */
  const handleOpenChange = (change) => {
    setCategoryFilter(null)
    setVenueFilter(null)
    setHallFilter(null)
    // The search narrows the programme exactly as the filters do, so a change
    // row pointing at something the current query excludes would scroll to a
    // card that isn't rendered — and quietly do nothing at all.
    setSearch('')
    const id = domIdFor(productionId({ venue: change.venue, title: change.title }))
    setTimeout(() => {
      const el = document.getElementById(id)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.remove('prod--flash')
      void el.offsetWidth // restart the animation even if this row was just flashed
      el.classList.add('prod--flash')
      el.setAttribute('tabindex', '-1')
      el.focus({ preventScroll: true })
    }, 0)
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__heading">
          <h1 className="topbar__title">Marquee</h1>
          <p className="topbar__sub">
            {client.mode === 'demo'
              ? 'demo · not connected to Notion'
              : scan?.scannedAt
                ? `last checked ${formatDay(scan.scannedAt.slice(0, 10), { relative: true })}`
                : `${active.length} venue${active.length === 1 ? '' : 's'} watched`}
          </p>
        </div>

        {/* Search moved up here from its old spot beside the tabs — one row
            for the title and every top-level control, search included, rather
            than search getting a row of its own below. Still the same box,
            still present on BOTH tabs and searching whatever the tab in front
            is actually showing (it used to vanish on the Venues tab, leaving
            that screen with no way to narrow it). On a phone this whole row
            wraps under the heading — deterministic, not "sit inline and hope
            it doesn't have to wrap": that approach was what let "Venues"
            growing to "Venues (8)" once venues finished loading nudge search
            onto a wrapped line mid-render, a jump with no user action behind
            it. Wrapping the row as a WHOLE never depends on that timing. */}
        <div className="topbar__bar">
          <div className="search">
            <SearchIcon size={14} aria-hidden="true" />
            <input
              type="search"
              value={onProgramme ? search : venueSearch}
              onChange={(e) => (onProgramme ? setSearch : setVenueSearch)(e.target.value)}
              placeholder="Search…"
              aria-label={onProgramme
                ? 'Search the programme by title or venue'
                : 'Search your venues by name, area or address'}
            />
            {(onProgramme ? search : venueSearch) && (
              <button
                type="button"
                className="search__clear"
                aria-label="Clear search"
                onClick={() => (onProgramme ? setSearch : setVenueSearch)('')}
              >
                <ClearIcon size={14} />
              </button>
            )}
          </div>

          <div className="topbar__actions">
            {/* Accent-filled via IconButton's own `selected` — the same
                background/foreground tokens `Check venues` used as a text
                Button, carried over rather than reinvented, so the primary
                action still reads as the one with weight even icon-only. */}
            <IconButton
              size="sm"
              selected
              aria-label={scanning ? 'Checking venues…' : 'Check venues'}
              title={scanning ? 'Checking venues…' : 'Check venues'}
              onClick={handleScan}
              disabled={scanning || loading || active.length === 0}
            >
              <RefreshIcon size={18} className={scanning ? 'topbar__scan-icon--spinning' : ''} />
            </IconButton>
            {/* A deliberately different, still theme-native colour (--color-success,
                already this palette's "positive" token) from Check venues' accent
                fill — distinct at a glance in the same row, never a third raw
                colour invented for this alone. Icon reflects the layout you'd
                SWITCH TO, matching the toggle Programme.jsx used to render inline
                before it moved up here to free the vertical space it took.

                Shown only where it does something: on the Programme tab, with a
                programme actually on screen. Moving it up here from inside
                Programme.jsx lost that gate — it kept rendering over the Venues
                list and before the first check, where pressing it silently
                changed a preference with nothing to show for it. */}
            {tab === 'programme' && days.length > 0 && (
              <IconButton
                size="sm"
                aria-label={prefs.viewMode === 'posters' ? 'Switch to list view' : 'Switch to poster view'}
                title={prefs.viewMode === 'posters' ? 'Switch to list view' : 'Switch to poster view'}
                onClick={() => setPrefs((p) => ({ ...p, viewMode: p.viewMode === 'posters' ? 'list' : 'posters' }))}
              >
                {prefs.viewMode === 'posters'
                  ? <ListIcon size={18} className="topbar__view-icon" />
                  : <PostersIcon size={18} className="topbar__view-icon" />}
              </IconButton>
            )}
            <IconButton size="sm" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
              <SettingsIcon size={18} />
            </IconButton>
          </div>
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
          Venues
        </button>
      </nav>

      {/* The first, most prominent filter tier — moved up here from deep
          inside Programme.jsx so it sits right beside the navigation it
          narrows, rather than below a "stale" banner and a Trouble list that
          may not even be there. Programme-tab only: the Venues tab has its
          own search, not a category split. */}
      {tab === 'programme' && categories.length > 1 && (
        <FilterRow
          className="category-filters"
          value={categoryFilter}
          onChange={handleCategoryFilter}
          options={categories}
          label={(c) => CATEGORY_LABEL[c] ?? c}
          icon={(c) => CATEGORY_ICON[c]}
          allIcon={StarIcon}
        />
      )}

      <main className={`main ${prefs.compactList ? 'main--compact' : ''}`}>
        {client.mode === 'demo' && (
          <p className="banner">
            Demo mode: real Bucharest venues, held in memory. Checking them really does read
            their pages, but venue edits and anything you keep never reach Notion.
          </p>
        )}

        {error && <p className="warn warn--stop" role="alert">{error}</p>}
        {findingsError && <p className="warn">{findingsError}</p>}

        {tab === 'programme' ? (
          <>
            {scan && <WeekStrip density={weekDensity} />}
            <Changes
              scan={scan ? { ...scan, changes: visibleChanges } : scan}
              dismissed={changesDismissed}
              onDismiss={handleDismissChanges}
              onOpen={handleOpenChange}
            />
            <Programme
              scan={scan}
              stale={scanStale}
              scanning={scanning}
              days={days}
              triage={triage}
              changedKeys={changedKeys}
              venues={active}
              search={search}
              categories={categories}
              categoryFilter={categoryFilter}
              venuesInCategory={venuesInCategory}
              venueFilter={venueFilter}
              onVenueFilter={handleVenueFilter}
              hallOptions={hallOptions}
              hallFilter={activeHallFilter}
              onHallFilter={setHallFilter}
              viewMode={prefs.viewMode}
              swipeEnabled={prefs.swipeEnabled}
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
              venues={visibleVenues}
              search={venueSearch}
              busyId={busyId}
              troubleByVenue={venueTrouble}
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

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
